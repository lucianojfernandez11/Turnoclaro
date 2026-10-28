/** Recordatorios: armado del mensaje, envío automático y respuestas del paciente. */
import type { ReminderReply } from "@prisma/client";
import { prisma } from "./db";
import { addDays, dayRangeUtc, formatYmdLong, formatTime, todayYmd, utcToZoned } from "./tz";
import { normalizeArPhone } from "./phone";
import { renderTemplate, firstName } from "./template";
import { platformAccount, sendReminderTemplate, type WaAccount } from "./whatsapp";
import { decryptSecret } from "./secrets";
import { changeStatus } from "./appointments";
import { audit } from "./audit";

export function appUrl(): string {
  return (process.env.APP_URL || "http://localhost:3000").replace(/\/+$/, "");
}

export function patientLink(publicToken: string): string {
  return `${appUrl()}/c/${publicToken}`;
}

type ApptForMessage = {
  id: string;
  startsAt: Date;
  publicToken: string;
  patient: { fullName: string; phone: string };
  professional: { name: string; specialty: string };
  clinic: {
    name: string;
    address: string | null;
    timezone: string;
    reminderTemplate: string | null;
    hideSpecialtyInMessages: boolean;
    defaultAreaCode: string;
  };
};

export function professionalLabel(a: ApptForMessage): string {
  return a.clinic.hideSpecialtyInMessages
    ? a.professional.name
    : `${a.professional.name} (${a.professional.specialty})`;
}

/** Texto del recordatorio para el modo manual (abre WhatsApp con esto escrito). */
export function reminderText(a: ApptForMessage): string {
  const tz = a.clinic.timezone;
  return renderTemplate(a.clinic.reminderTemplate, {
    paciente: firstName(a.patient.fullName),
    profesional: professionalLabel(a),
    fecha: formatYmdLong(utcToZoned(a.startsAt, tz).ymd),
    hora: formatTime(a.startsAt, tz),
    consultorio: a.clinic.name,
    direccion: a.clinic.address ? ` (${a.clinic.address})` : "",
    link: patientLink(a.publicToken),
  });
}

/** Aviso al paciente cuando la secretaría acepta una reserva online o cambia el turno. */
export function bookingNoticeText(a: ApptForMessage, kind: "aceptada" | "cambio" | "cancelado"): string {
  const tz = a.clinic.timezone;
  const when = `${formatYmdLong(utcToZoned(a.startsAt, tz).ymd)} a las ${formatTime(a.startsAt, tz)}`;
  const who = professionalLabel(a);
  const hola = `Hola ${firstName(a.patient.fullName)}`;
  if (kind === "cancelado") {
    return `${hola}, te escribimos de ${a.clinic.name}: tu turno con ${who} del ${when} quedó cancelado. Si querés otro horario, respondé este mensaje.`;
  }
  const intro = kind === "aceptada" ? "tu turno quedó confirmado" : "cambiamos tu turno";
  return `${hola}, te escribimos de ${a.clinic.name}: ${intro} con ${who} el ${when}.\n\nSi no podés asistir, cancelalo desde acá: ${patientLink(a.publicToken)}`;
}

const reminderInclude = { patient: true, professional: true, clinic: true } as const;

/** Turnos de un día que necesitan recordatorio, con el estado de su mensaje. */
export async function remindersForDay(clinicId: string, ymd: string, timeZone: string) {
  const { from, to } = dayRangeUtc(ymd, timeZone);
  return prisma.appointment.findMany({
    where: {
      clinicId,
      startsAt: { gte: from, lt: to },
      status: { in: ["PENDIENTE", "CONFIRMADO"] },
    },
    include: {
      ...reminderInclude,
      messages: { where: { kind: "RECORDATORIO" }, orderBy: { createdAt: "desc" } },
    },
    orderBy: { startsAt: "asc" },
  });
}

export type SendSummary = {
  sent: number;
  failed: number;
  skipped: number;
  /** Ya confirmados: no se les manda recordatorio (no hace falta y cuesta plata). */
  alreadyConfirmed: number;
  /** Quedaron sin enviar porque se terminó el saldo del pack. */
  noCredits: number;
  mode: "api" | "manual";
};

type ClinicWa = {
  waMode: string;
  waPhoneNumberId: string | null;
  waTokenEnc: string | null;
  waTemplateName: string | null;
  waTemplateLang: string | null;
  reminderCredits: number;
};

export type WaSetup =
  | { mode: "MANUAL"; account: null; problem?: string }
  | { mode: "PROPIA"; account: WaAccount }
  | { mode: "PACK"; account: WaAccount; credits: number };

/**
 * Con qué cuenta manda recordatorios automáticos un consultorio.
 * Si algo no está completo, cae al modo manual (nunca se cobra sin querer).
 */
export function clinicWhatsapp(c: ClinicWa): WaSetup {
  if (c.waMode === "PROPIA") {
    const token = decryptSecret(c.waTokenEnc);
    if (!c.waPhoneNumberId || !token) return { mode: "MANUAL", account: null, problem: "Falta conectar la cuenta de WhatsApp del consultorio." };
    return {
      mode: "PROPIA",
      account: {
        phoneNumberId: c.waPhoneNumberId,
        token,
        templateName: c.waTemplateName || "recordatorio_turno",
        templateLang: c.waTemplateLang || "es_AR",
      },
    };
  }
  if (c.waMode === "PACK") {
    const account = platformAccount();
    if (!account) return { mode: "MANUAL", account: null, problem: "El envío automático de TurnoClaro todavía no está activado." };
    return { mode: "PACK", account, credits: c.reminderCredits };
  }
  return { mode: "MANUAL", account: null };
}

/** Descuenta 1 recordatorio del saldo. Devuelve false si no quedaba saldo (nunca queda negativo). */
async function takeCredit(clinicId: string): Promise<boolean> {
  const r = await prisma.clinic.updateMany({
    where: { id: clinicId, reminderCredits: { gt: 0 } },
    data: { reminderCredits: { decrement: 1 } },
  });
  return r.count === 1;
}

async function refundCredit(clinicId: string): Promise<void> {
  await prisma.clinic.update({ where: { id: clinicId }, data: { reminderCredits: { increment: 1 } } });
}

/**
 * Envía por la API los recordatorios del día indicado (por defecto, mañana) de un consultorio.
 * No reenvía a quien ya tiene un recordatorio enviado o registrado a mano,
 * ni le escribe a quien ya confirmó su turno.
 */
export async function sendRemindersForClinic(clinicId: string, ymd?: string): Promise<SendSummary> {
  const summary: SendSummary = { sent: 0, failed: 0, skipped: 0, alreadyConfirmed: 0, noCredits: 0, mode: "api" };
  const clinic = await prisma.clinic.findUnique({ where: { id: clinicId } });
  if (!clinic || !clinic.active) return summary;
  const wa = clinicWhatsapp(clinic);
  if (wa.mode === "MANUAL") return { ...summary, mode: "manual" };

  const day = ymd ?? addDays(todayYmd(clinic.timezone), 1);
  const appts = await remindersForDay(clinicId, day, clinic.timezone);

  for (const a of appts) {
    if (a.status === "CONFIRMADO") {
      summary.alreadyConfirmed++;
      continue;
    }
    const already = a.messages.some((m) => m.status !== "FALLIDO");
    if (already || !a.patient.whatsappOptIn || a.patient.deletedAt) {
      summary.skipped++;
      continue;
    }
    const to = normalizeArPhone(a.patient.phone, clinic.defaultAreaCode);
    if (!to) {
      await prisma.message.create({
        data: {
          clinicId, appointmentId: a.id, kind: "RECORDATORIO", channel: "API", status: "FALLIDO",
          toPhone: a.patient.phone, error: "Teléfono inválido",
        },
      });
      summary.failed++;
      continue;
    }
    if (wa.mode === "PACK" && !(await takeCredit(clinicId))) {
      summary.noCredits++;
      continue;
    }
    const tz = clinic.timezone;
    const result = await sendReminderTemplate(wa.account, {
      to,
      appointmentId: a.id,
      bodyValues: [
        firstName(a.patient.fullName),
        professionalLabel(a),
        formatYmdLong(utcToZoned(a.startsAt, tz).ymd),
        formatTime(a.startsAt, tz),
        clinic.name,
      ],
    });
    if (!result.ok && wa.mode === "PACK") await refundCredit(clinicId);
    await prisma.message.create({
      data: {
        clinicId,
        appointmentId: a.id,
        kind: "RECORDATORIO",
        channel: "API",
        status: result.ok ? "ENVIADO" : "FALLIDO",
        toPhone: to,
        waMessageId: result.ok ? result.waMessageId : null,
        error: result.ok ? null : result.error,
      },
    });
    if (result.ok) summary.sent++;
    else summary.failed++;
  }
  return summary;
}

/** Tarea nocturna: recordatorios de mañana para todos los consultorios activos. */
export async function runAllReminders(): Promise<Record<string, SendSummary>> {
  const clinics = await prisma.clinic.findMany({ where: { active: true }, select: { id: true, slug: true } });
  const out: Record<string, SendSummary> = {};
  for (const c of clinics) out[c.slug] = await sendRemindersForClinic(c.id);
  return out;
}

/**
 * Aplica la respuesta del paciente (botón de WhatsApp, texto o link).
 * CONFIRMA: pendiente → confirmado. CANCELA: libera el horario.
 */
export async function applyPatientReply(params: {
  appointmentId: string;
  reply: ReminderReply;
  via: "whatsapp" | "link";
}): Promise<{ ok: boolean; message: string }> {
  const appt = await prisma.appointment.findUnique({ where: { id: params.appointmentId } });
  if (!appt) return { ok: false, message: "No encontramos el turno." };
  if (appt.startsAt <= new Date()) return { ok: false, message: "Este turno ya pasó." };
  if (appt.status === "CANCELADO") return { ok: false, message: "Este turno ya estaba cancelado." };

  let error: string | null = null;
  if (params.reply === "CONFIRMA") {
    if (appt.status === "PENDIENTE") {
      error = await changeStatus({
        clinicId: appt.clinicId, appointmentId: appt.id, status: "CONFIRMADO", userId: null, via: params.via,
      });
    }
  } else {
    error = await changeStatus({
      clinicId: appt.clinicId, appointmentId: appt.id, status: "CANCELADO", userId: null, via: params.via,
    });
  }
  if (error) return { ok: false, message: error };

  const last = await prisma.message.findFirst({
    where: { appointmentId: appt.id, kind: "RECORDATORIO" },
    orderBy: { createdAt: "desc" },
  });
  if (last) {
    await prisma.message.update({ where: { id: last.id }, data: { reply: params.reply, repliedAt: new Date() } });
  }
  await audit({
    clinicId: appt.clinicId, userId: null, action: "respuesta_paciente", entity: "Appointment", entityId: appt.id,
    detail: { reply: params.reply, via: params.via },
  });

  if (params.reply === "CONFIRMA") {
    return {
      ok: true,
      message: appt.status === "SOLICITADO"
        ? "Recibimos tu respuesta. El consultorio todavía tiene que aceptar la reserva."
        : "¡Listo! Tu turno quedó confirmado.",
    };
  }
  return { ok: true, message: "Tu turno quedó cancelado. ¡Gracias por avisar!" };
}
