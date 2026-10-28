/** Operaciones sobre turnos que comparten el panel, la reserva online y WhatsApp. */
import type { AppointmentStatus, AppointmentSource } from "@prisma/client";
import { prisma } from "./db";
import { randomToken } from "./password";
import { buildDaySlots, type Slot } from "./availability";
import { dayRangeUtc, utcToZoned } from "./tz";
import { audit } from "./audit";

export { STATUS_LABEL } from "./labels";

/** El error que tira PostgreSQL cuando dos turnos se pisan (regla Appointment_no_overlap). */
export function isOverlapError(e: unknown): boolean {
  const text = e instanceof Error ? e.message : String(e);
  return text.includes("Appointment_no_overlap") || text.includes("23P01") || text.includes("exclusion constraint");
}

export const OVERLAP_MESSAGE =
  "Ese horario ya está ocupado para este profesional. Elegí otro o marcá el turno como sobreturno.";

/** ¿Hay un turno activo (no sobreturno) del profesional que pise este rango? */
export async function findOverlap(params: {
  professionalId: string;
  startsAt: Date;
  endsAt: Date;
  excludeId?: string;
}) {
  return prisma.appointment.findFirst({
    where: {
      professionalId: params.professionalId,
      status: { not: "CANCELADO" },
      overbook: false,
      startsAt: { lt: params.endsAt },
      endsAt: { gt: params.startsAt },
      ...(params.excludeId ? { id: { not: params.excludeId } } : {}),
    },
    include: { patient: true },
  });
}

/** Bloqueo (del profesional o de todo el consultorio) que pise el rango. */
export async function findBlock(params: { clinicId: string; professionalId: string; startsAt: Date; endsAt: Date }) {
  return prisma.block.findFirst({
    where: {
      clinicId: params.clinicId,
      OR: [{ professionalId: params.professionalId }, { professionalId: null }],
      startsAt: { lt: params.endsAt },
      endsAt: { gt: params.startsAt },
    },
  });
}

export type CreateResult = { ok: true; id: string; publicToken: string } | { ok: false; error: string };

export async function createAppointment(data: {
  clinicId: string;
  professionalId: string;
  patientId: string;
  startsAt: Date;
  endsAt: Date;
  status: AppointmentStatus;
  source: AppointmentSource;
  overbook?: boolean;
  note?: string | null;
  createdById?: string | null;
}): Promise<CreateResult> {
  if (!(data.endsAt > data.startsAt)) return { ok: false, error: "El horario de fin tiene que ser posterior al de inicio." };
  if (!data.overbook) {
    const clash = await findOverlap(data);
    if (clash) return { ok: false, error: OVERLAP_MESSAGE };
  }
  try {
    const appt = await prisma.appointment.create({
      data: {
        clinicId: data.clinicId,
        professionalId: data.professionalId,
        patientId: data.patientId,
        startsAt: data.startsAt,
        endsAt: data.endsAt,
        status: data.status,
        source: data.source,
        overbook: data.overbook ?? false,
        note: data.note ?? null,
        createdById: data.createdById ?? null,
        publicToken: randomToken(18),
      },
    });
    await audit({
      clinicId: data.clinicId,
      userId: data.createdById ?? null,
      action: data.source === "ONLINE" ? "reserva_online" : "turno_creado",
      entity: "Appointment",
      entityId: appt.id,
      detail: { startsAt: data.startsAt.toISOString(), status: data.status },
    });
    return { ok: true, id: appt.id, publicToken: appt.publicToken };
  } catch (e) {
    if (isOverlapError(e)) return { ok: false, error: OVERLAP_MESSAGE };
    throw e;
  }
}

/** Cambia el estado de un turno y deja registro. Devuelve un error legible si no se puede. */
export async function changeStatus(params: {
  clinicId: string;
  appointmentId: string;
  status: AppointmentStatus;
  userId: string | null;
  via?: string;
}): Promise<string | null> {
  const appt = await prisma.appointment.findFirst({ where: { id: params.appointmentId, clinicId: params.clinicId } });
  if (!appt) return "No se encontró el turno.";
  if (appt.status === params.status) return null;
  try {
    await prisma.appointment.update({
      where: { id: appt.id },
      data: {
        status: params.status,
        cancelledAt: params.status === "CANCELADO" ? new Date() : appt.status === "CANCELADO" ? null : appt.cancelledAt,
      },
    });
  } catch (e) {
    if (isOverlapError(e)) return "No se puede reactivar: ese horario ya lo ocupa otro turno.";
    throw e;
  }
  await audit({
    clinicId: params.clinicId,
    userId: params.userId,
    action: "estado",
    entity: "Appointment",
    entityId: appt.id,
    detail: { from: appt.status, to: params.status, via: params.via ?? "panel" },
  });
  return null;
}

/** Grilla de un día para varios profesionales, con los turnos (incluidos sobreturnos) y bloqueos. */
export async function loadDay(params: {
  clinicId: string;
  timeZone: string;
  ymd: string;
  professionalIds: string[];
  now?: Date;
}) {
  const { from, to } = dayRangeUtc(params.ymd, params.timeZone);
  const [schedules, appointments, blocks] = await Promise.all([
    prisma.schedule.findMany({ where: { clinicId: params.clinicId, professionalId: { in: params.professionalIds } } }),
    prisma.appointment.findMany({
      where: {
        clinicId: params.clinicId,
        professionalId: { in: params.professionalIds },
        startsAt: { lt: to },
        endsAt: { gt: from },
      },
      include: { patient: { include: { insurance: true } } },
      orderBy: { startsAt: "asc" },
    }),
    prisma.block.findMany({
      where: {
        clinicId: params.clinicId,
        OR: [{ professionalId: { in: params.professionalIds } }, { professionalId: null }],
        startsAt: { lt: to },
        endsAt: { gt: from },
      },
    }),
  ]);
  return { schedules, appointments, blocks };
}

export function slotsForProfessional(params: {
  ymd: string;
  timeZone: string;
  professional: { id: string; slotMinutes: number };
  schedules: { professionalId: string; weekday: number; startMinute: number; endMinute: number }[];
  appointments: { id: string; professionalId: string; startsAt: Date; endsAt: Date; status: AppointmentStatus; overbook: boolean }[];
  blocks: { professionalId: string | null; startsAt: Date; endsAt: Date; reason: string }[];
  now?: Date;
}): Slot[] {
  const p = params.professional;
  return buildDaySlots({
    ymd: params.ymd,
    timeZone: params.timeZone,
    slotMinutes: p.slotMinutes,
    schedules: params.schedules.filter((s) => s.professionalId === p.id),
    appointments: params.appointments.filter(
      (a) => a.professionalId === p.id && a.status !== "CANCELADO" && !a.overbook,
    ),
    blocks: params.blocks.filter((b) => b.professionalId === null || b.professionalId === p.id),
    now: params.now,
  });
}

/** Minutos locales de inicio de un turno (para ubicarlo en la grilla). */
export function localMinutes(date: Date, timeZone: string): number {
  return utcToZoned(date, timeZone).minutes;
}
