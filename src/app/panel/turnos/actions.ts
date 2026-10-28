"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { AppointmentStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireUser, professionalScope, canSeeAllAgendas, type CurrentUser } from "@/lib/auth";
import { type ActionState, bool, int, str } from "@/lib/forms";
import { hhmmToMinutes, isYmd, zonedToUtc, formatInstant } from "@/lib/tz";
import {
  changeStatus, createAppointment, findBlock, findOverlap, isOverlapError, OVERLAP_MESSAGE,
} from "@/lib/appointments";
import { cleanPatientInput, findOrCreatePatient } from "@/lib/patients";
import { normalizeArPhone } from "@/lib/phone";
import { sendRemindersForClinic } from "@/lib/reminders";
import { audit } from "@/lib/audit";

async function scopedProfessional(user: CurrentUser, professionalId: string) {
  return prisma.professional.findFirst({ where: { ...professionalScope(user), id: professionalId } });
}

async function scopedAppointment(user: CurrentUser, id: string) {
  const appt = await prisma.appointment.findFirst({ where: { id, clinicId: user.clinic.id } });
  if (!appt) return null;
  if (!canSeeAllAgendas(user) && appt.professionalId !== user.professionalId) return null;
  return appt;
}

/** Lee fecha, hora y duración del formulario y arma el rango UTC. */
function readRange(fd: FormData, timeZone: string, defaultMinutes: number) {
  const ymd = str(fd, "fecha");
  const start = hhmmToMinutes(str(fd, "hora"));
  const duration = int(fd, "duracion", defaultMinutes);
  if (!isYmd(ymd)) return { error: "Elegí la fecha." } as const;
  if (start === null) return { error: "Elegí la hora." } as const;
  if (duration < 5 || duration > 480) return { error: "La duración va de 5 a 480 minutos." } as const;
  const startsAt = zonedToUtc(ymd, start, timeZone);
  return { ymd, startsAt, endsAt: new Date(startsAt.getTime() + duration * 60000) } as const;
}

export async function createAppointmentAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser();
  const pro = await scopedProfessional(user, str(fd, "professionalId"));
  if (!pro) return { error: "Elegí el profesional." };
  const range = readRange(fd, user.clinic.timezone, pro.slotMinutes);
  if ("error" in range) return { error: range.error };
  const overbook = bool(fd, "overbook");

  // Paciente: existente o nuevo.
  let patientId = str(fd, "patientId");
  if (patientId) {
    const ok = await prisma.patient.findFirst({ where: { id: patientId, clinicId: user.clinic.id } });
    if (!ok) return { error: "El paciente no existe." };
  } else {
    const cleaned = await cleanPatientInput(user.clinic, {
      fullName: str(fd, "p_fullName"),
      dni: str(fd, "p_dni"),
      phone: str(fd, "p_phone"),
      email: str(fd, "p_email"),
      insuranceId: str(fd, "p_insuranceId"),
      affiliateNumber: str(fd, "p_affiliateNumber"),
    });
    if ("error" in cleaned) return { error: cleaned.error };
    patientId = (await findOrCreatePatient(user.clinic.id, cleaned.data)).id;
  }

  if (!overbook) {
    const block = await findBlock({ clinicId: user.clinic.id, professionalId: pro.id, ...range });
    if (block) return { error: `Ese horario está bloqueado (${block.reason}). Para darlo igual, marcá “sobreturno”.` };
  }

  const status: AppointmentStatus = str(fd, "estado") === "CONFIRMADO" ? "CONFIRMADO" : "PENDIENTE";
  const res = await createAppointment({
    clinicId: user.clinic.id,
    professionalId: pro.id,
    patientId,
    startsAt: range.startsAt,
    endsAt: range.endsAt,
    status,
    source: "PANEL",
    overbook,
    note: str(fd, "nota") || null,
    createdById: user.userId,
  });
  if (!res.ok) return { error: res.error };
  revalidatePath("/panel", "layout");
  redirect(`/panel/agenda?fecha=${range.ymd}&nuevo=${res.id}`);
}

const ALLOWED: AppointmentStatus[] = ["PENDIENTE", "CONFIRMADO", "ATENDIDO", "AUSENTE", "CANCELADO"];

/** Botones de estado (Confirmado, Atendido, Ausente, Cancelar, Reactivar). */
export async function setStatusAction(id: string, status: AppointmentStatus): Promise<void> {
  const user = await requireUser();
  if (!ALLOWED.includes(status)) return;
  const appt = await scopedAppointment(user, id);
  if (!appt) return;
  const error = await changeStatus({ clinicId: user.clinic.id, appointmentId: id, status, userId: user.userId });
  revalidatePath("/panel", "layout");
  if (error) redirect(`/panel/turnos/${id}?error=${encodeURIComponent(error)}`);
}

export async function rescheduleAction(id: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser();
  const appt = await scopedAppointment(user, id);
  if (!appt) return { error: "No se encontró el turno." };
  if (appt.status === "CANCELADO") return { error: "El turno está cancelado. Reactivalo o dá uno nuevo." };
  const pro = await scopedProfessional(user, str(fd, "professionalId"));
  if (!pro) return { error: "Elegí el profesional." };
  const range = readRange(fd, user.clinic.timezone, pro.slotMinutes);
  if ("error" in range) return { error: range.error };
  const overbook = bool(fd, "overbook");
  if (!overbook) {
    const clash = await findOverlap({ professionalId: pro.id, startsAt: range.startsAt, endsAt: range.endsAt, excludeId: id });
    if (clash) return { error: OVERLAP_MESSAGE };
    const block = await findBlock({ clinicId: user.clinic.id, professionalId: pro.id, ...range });
    if (block) return { error: `Ese horario está bloqueado (${block.reason}). Para darlo igual, marcá “sobreturno”.` };
  }
  try {
    await prisma.$transaction([
      prisma.appointment.update({
        where: { id },
        data: {
          professionalId: pro.id,
          startsAt: range.startsAt,
          endsAt: range.endsAt,
          overbook,
          // Cambió el horario: hay que volver a confirmar.
          status: appt.status === "SOLICITADO" ? "SOLICITADO" : "PENDIENTE",
        },
      }),
      // El recordatorio anterior ya no vale: así sale uno nuevo para el horario nuevo.
      prisma.message.deleteMany({ where: { appointmentId: id, kind: "RECORDATORIO", reply: null } }),
    ]);
  } catch (e) {
    if (isOverlapError(e)) return { error: OVERLAP_MESSAGE };
    throw e;
  }
  await audit({
    clinicId: user.clinic.id, userId: user.userId, action: "reprogramado", entity: "Appointment", entityId: id,
    detail: { from: appt.startsAt.toISOString(), to: range.startsAt.toISOString() },
  });
  revalidatePath("/panel", "layout");
  return { ok: `Turno movido al ${formatInstant(range.startsAt, user.clinic.timezone)}. Avisale al paciente.` };
}

export async function updateNoteAction(id: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser();
  const appt = await scopedAppointment(user, id);
  if (!appt) return { error: "No se encontró el turno." };
  await prisma.appointment.update({ where: { id }, data: { note: str(fd, "nota") || null } });
  revalidatePath(`/panel/turnos/${id}`);
  return { ok: "Nota guardada." };
}

/** Registra que la secretaría mandó un mensaje a mano por WhatsApp. */
export async function markManualMessageAction(id: string, kind: "RECORDATORIO" | "RESERVA" | "CAMBIO"): Promise<void> {
  const user = await requireUser();
  const appt = await prisma.appointment.findFirst({ where: { id, clinicId: user.clinic.id }, include: { patient: true } });
  if (!appt) return;
  await prisma.message.create({
    data: {
      clinicId: user.clinic.id,
      appointmentId: id,
      kind,
      channel: "MANUAL",
      status: "MANUAL",
      toPhone: normalizeArPhone(appt.patient.phone, user.clinic.defaultAreaCode) ?? appt.patient.phone,
    },
  });
  revalidatePath("/panel", "layout");
}

// ---------- Solicitudes online ----------

export async function acceptRequestAction(id: string): Promise<void> {
  const user = await requireUser(["ADMIN", "SECRETARIA"]);
  const appt = await scopedAppointment(user, id);
  if (!appt || appt.status !== "SOLICITADO") return;
  await changeStatus({ clinicId: user.clinic.id, appointmentId: id, status: "CONFIRMADO", userId: user.userId, via: "solicitud" });
  revalidatePath("/panel", "layout");
}

export async function rejectRequestAction(id: string): Promise<void> {
  const user = await requireUser(["ADMIN", "SECRETARIA"]);
  const appt = await scopedAppointment(user, id);
  if (!appt || appt.status !== "SOLICITADO") return;
  await changeStatus({ clinicId: user.clinic.id, appointmentId: id, status: "CANCELADO", userId: user.userId, via: "solicitud" });
  revalidatePath("/panel", "layout");
}

// ---------- Recordatorios ----------

export async function sendRemindersNowAction(ymd: string, _prev: ActionState, _fd: FormData): Promise<ActionState> {
  const user = await requireUser(["ADMIN", "SECRETARIA"]);
  if (!isYmd(ymd)) return { error: "Fecha inválida." };
  const r = await sendRemindersForClinic(user.clinic.id, ymd);
  revalidatePath("/panel/recordatorios");
  if (r.mode === "manual") return { error: "El envío automático no está configurado. Usá los botones de cada paciente." };
  const parts = [`Enviados: ${r.sent}.`];
  if (r.alreadyConfirmed) parts.push(`${r.alreadyConfirmed} ya habían confirmado (no se les escribió).`);
  if (r.skipped) parts.push(`${r.skipped} ya tenían recordatorio o no aceptan WhatsApp.`);
  if (r.failed) parts.push(`${r.failed} con error.`);
  if (r.noCredits) parts.push(`${r.noCredits} sin enviar porque se terminó el saldo de recordatorios.`);
  return r.noCredits && !r.sent ? { error: parts.join(" ") } : { ok: parts.join(" ") };
}
