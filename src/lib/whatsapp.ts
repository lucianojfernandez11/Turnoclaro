/**
 * WhatsApp Cloud API (la oficial de Meta).
 * Si faltan las variables de entorno, el sistema trabaja en modo manual.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

const GRAPH_VERSION = process.env.WHATSAPP_GRAPH_VERSION || "v23.0";

/** Cuenta de WhatsApp con la que se envía: la de TurnoClaro (.env) o la propia de un consultorio. */
export type WaAccount = {
  phoneNumberId: string;
  token: string;
  templateName: string;
  templateLang: string;
};

/** La cuenta de TurnoClaro (variables de entorno). Se usa para los packs de recordatorios. */
export function platformAccount(): WaAccount | null {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !phoneNumberId) return null;
  return {
    token,
    phoneNumberId,
    templateName: process.env.WHATSAPP_TEMPLATE_RECORDATORIO || "recordatorio_turno",
    templateLang: process.env.WHATSAPP_TEMPLATE_LANG || "es_AR",
  };
}

export function isWhatsappApiConfigured(): boolean {
  return platformAccount() !== null;
}

export type SendResult = { ok: true; waMessageId: string } | { ok: false; error: string };

async function callApi(account: WaAccount, body: unknown): Promise<SendResult> {
  const url = `https://graph.facebook.com/${GRAPH_VERSION}/${encodeURIComponent(account.phoneNumberId)}/messages`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${account.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    const json = (await res.json().catch(() => ({}))) as {
      messages?: { id: string }[];
      error?: { message?: string; code?: number };
    };
    if (!res.ok || !json.messages?.[0]?.id) {
      return { ok: false, error: json.error?.message ?? `Error HTTP ${res.status}` };
    }
    return { ok: true, waMessageId: json.messages[0].id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error de red" };
  }
}

/**
 * Comprueba que el número y el token de una cuenta funcionen (consulta el número en Meta).
 * Devuelve el número verificado, por ejemplo "+54 9 381 555-0000".
 */
export async function checkAccount(account: Pick<WaAccount, "phoneNumberId" | "token">): Promise<{ ok: true; phone: string } | { ok: false; error: string }> {
  try {
    const res = await fetch(
      `https://graph.facebook.com/${GRAPH_VERSION}/${encodeURIComponent(account.phoneNumberId)}?fields=display_phone_number,verified_name`,
      { headers: { Authorization: `Bearer ${account.token}` }, cache: "no-store" },
    );
    const json = (await res.json().catch(() => ({}))) as { display_phone_number?: string; verified_name?: string; error?: { message?: string } };
    if (!res.ok || !json.display_phone_number) return { ok: false, error: json.error?.message ?? `Error HTTP ${res.status}` };
    return { ok: true, phone: `${json.display_phone_number}${json.verified_name ? ` (${json.verified_name})` : ""}` };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error de red" };
  }
}

/**
 * Envía la plantilla de recordatorio aprobada por Meta.
 * Variables del cuerpo: {{1}} paciente, {{2}} profesional, {{3}} fecha, {{4}} hora, {{5}} consultorio.
 * Botones de respuesta rápida: 0 = "Confirmo", 1 = "No puedo ir".
 */
export function sendReminderTemplate(account: WaAccount, params: {
  to: string;
  appointmentId: string;
  bodyValues: [string, string, string, string, string];
}): Promise<SendResult> {
  return callApi(account, {
    messaging_product: "whatsapp",
    to: params.to,
    type: "template",
    template: {
      name: account.templateName,
      language: { code: account.templateLang },
      components: [
        { type: "body", parameters: params.bodyValues.map((text) => ({ type: "text", text })) },
        {
          type: "button",
          sub_type: "quick_reply",
          index: "0",
          parameters: [{ type: "payload", payload: `CONFIRMA:${params.appointmentId}` }],
        },
        {
          type: "button",
          sub_type: "quick_reply",
          index: "1",
          parameters: [{ type: "payload", payload: `CANCELA:${params.appointmentId}` }],
        },
      ],
    },
  });
}

/** Texto libre: solo se puede mandar dentro de las 24 h desde que el paciente escribió. */
export function sendText(account: WaAccount, to: string, text: string): Promise<SendResult> {
  return callApi(account, { messaging_product: "whatsapp", to, type: "text", text: { body: text } });
}

/**
 * Valida que el webhook realmente venga de Meta (encabezado X-Hub-Signature-256).
 * Se prueba con la clave de la app de TurnoClaro o con la de un consultorio con cuenta propia.
 */
export function verifyWebhookSignature(rawBody: string, header: string | null, clinicSecrets?: string[]): boolean {
  // Sin lista: se valida con la clave de la app de TurnoClaro. Con lista: solo con esas claves.
  const secrets = (clinicSecrets ?? [process.env.WHATSAPP_APP_SECRET]).filter((s): s is string => Boolean(s));
  if (clinicSecrets && secrets.length === 0) return false;
  if (secrets.length === 0) return process.env.NODE_ENV !== "production"; // en desarrollo se permite sin clave
  if (!header?.startsWith("sha256=")) return false;
  const given = header.slice("sha256=".length);
  if (!/^[0-9a-f]+$/i.test(given)) return false;
  return secrets.some((secret) => {
    const expected = createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
    return given.length === expected.length && timingSafeEqual(Buffer.from(given, "hex"), Buffer.from(expected, "hex"));
  });
}
