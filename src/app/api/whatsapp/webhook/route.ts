/**
 * Webhook de WhatsApp Cloud API.
 * GET: verificación inicial que hace Meta al configurar el webhook.
 * POST: estados de entrega y respuestas de los pacientes (botones o texto).
 */
import { NextResponse } from "next/server";
import type { MessageStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { verifyWebhookSignature } from "@/lib/whatsapp";
import { applyPatientReply } from "@/lib/reminders";
import { decryptSecret } from "@/lib/secrets";
import { parseReplyText } from "@/lib/template";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");
  if (mode === "subscribe" && token) {
    // Vale el token de TurnoClaro o el que se le generó a cada consultorio en Ajustes > WhatsApp.
    const ok =
      token === process.env.WHATSAPP_VERIFY_TOKEN ||
      Boolean(await prisma.clinic.findUnique({ where: { waVerifyToken: token }, select: { id: true } }));
    if (ok) return new Response(challenge ?? "", { status: 200 });
  }
  return new Response("Forbidden", { status: 403 });
}

type WaMessage = {
  from: string;
  id: string;
  type: string;
  text?: { body: string };
  button?: { payload?: string; text?: string };
  interactive?: { button_reply?: { id: string; title: string } };
  context?: { id?: string };
};
type WaStatus = { id: string; status: string; errors?: { title?: string; message?: string }[] };
type WaValue = { metadata?: { phone_number_id?: string }; messages?: WaMessage[]; statuses?: WaStatus[] };
type WaPayload = { entry?: { changes?: { value?: WaValue }[] }[] };

const STATUS_MAP: Record<string, MessageStatus> = {
  sent: "ENVIADO",
  delivered: "ENTREGADO",
  read: "LEIDO",
  failed: "FALLIDO",
};

async function handleMessage(m: WaMessage, clinicId: string | null) {
  // 1) Botón de la plantilla: el payload trae "CONFIRMA:<id>" o "CANCELA:<id>".
  const payload = m.button?.payload ?? m.interactive?.button_reply?.id;
  if (payload) {
    const [reply, appointmentId] = payload.split(":");
    if ((reply === "CONFIRMA" || reply === "CANCELA") && appointmentId) {
      // Si el mensaje llegó al número de un consultorio, el turno tiene que ser de ese consultorio.
      if (clinicId) {
        const own = await prisma.appointment.findFirst({ where: { id: appointmentId, clinicId }, select: { id: true } });
        if (!own) return;
      }
      await applyPatientReply({ appointmentId, reply, via: "whatsapp" });
    }
    return;
  }
  // 2) Respuesta escrita ("sí", "no puedo"): se busca el último recordatorio enviado a ese número.
  const text = m.text?.body ?? m.button?.text;
  if (!text) return;
  const reply = parseReplyText(text);
  if (!reply) return;
  const since = new Date(Date.now() - 3 * 24 * 3600 * 1000);
  const last = await prisma.message.findFirst({
    where: {
      toPhone: m.from,
      kind: "RECORDATORIO",
      channel: "API",
      createdAt: { gt: since },
      reply: null,
      ...(clinicId ? { clinicId } : {}),
      ...(m.context?.id ? { waMessageId: m.context.id } : {}),
    },
    orderBy: { createdAt: "desc" },
  });
  if (last) await applyPatientReply({ appointmentId: last.appointmentId, reply, via: "whatsapp" });
}

export async function POST(req: Request) {
  const raw = await req.text();
  let body: WaPayload;
  try {
    body = JSON.parse(raw) as WaPayload;
  } catch {
    return new Response("Bad request", { status: 400 });
  }

  // ¿A qué número llegó? Si es el de un consultorio con cuenta propia, se usa su clave para validar.
  const phoneIds = new Set<string>();
  for (const entry of body.entry ?? []) for (const ch of entry.changes ?? []) {
    const id = ch.value?.metadata?.phone_number_id;
    if (id) phoneIds.add(id);
  }
  const clinics = phoneIds.size
    ? await prisma.clinic.findMany({
        where: { waPhoneNumberId: { in: [...phoneIds] }, waMode: "PROPIA" },
        select: { id: true, waPhoneNumberId: true, waAppSecretEnc: true },
      })
    : [];
  const header = req.headers.get("x-hub-signature-256");
  // Firmado por la app de TurnoClaro: se procesa todo. Firmado por la app de un consultorio:
  // solo se procesan los cambios de su propio número.
  let onlyClinic: string | null = null;
  if (!verifyWebhookSignature(raw, header)) {
    const signer = clinics.find((c) => {
      const secret = decryptSecret(c.waAppSecretEnc);
      return secret ? verifyWebhookSignature(raw, header, [secret]) : false;
    });
    if (!signer) return new Response("Invalid signature", { status: 401 });
    onlyClinic = signer.id;
  }
  const clinicByPhone = new Map(clinics.map((c) => [c.waPhoneNumberId, c.id]));

  for (const entry of body.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const value = change.value ?? {};
      const clinicId = clinicByPhone.get(value.metadata?.phone_number_id ?? "") ?? null;
      if (onlyClinic && clinicId !== onlyClinic) continue;
      for (const s of value.statuses ?? []) {
        const status = STATUS_MAP[s.status];
        if (!status) continue;
        await prisma.message.updateMany({
          where: { waMessageId: s.id, ...(clinicId ? { clinicId } : {}) },
          data: { status, ...(status === "FALLIDO" ? { error: s.errors?.[0]?.message ?? s.errors?.[0]?.title ?? "Falló el envío" } : {}) },
        });
      }
      for (const m of value.messages ?? []) {
        try {
          await handleMessage(m, clinicId);
        } catch (e) {
          console.error("webhook message", e);
        }
      }
    }
  }
  // Meta reintenta si no recibe 200, así que siempre respondemos OK.
  return NextResponse.json({ ok: true });
}
