/** Disponibilidad para la reserva online: varios días de un profesional con pocas consultas. */
import { prisma } from "./db";
import { buildDaySlots, freeSlots, type Slot } from "./availability";
import { addDays, dayRangeUtc, todayYmd } from "./tz";

export async function publicClinic(slug: string) {
  return prisma.clinic.findUnique({
    where: { slug },
    include: {
      professionals: { where: { active: true, bookable: true }, orderBy: { name: "asc" } },
      insurances: { where: { active: true }, orderBy: { name: "asc" } },
    },
  });
}

/** Horarios libres por día, desde hoy hasta "daysAhead" días. */
export async function freeSlotsWindow(params: {
  clinicId: string;
  timeZone: string;
  professional: { id: string; slotMinutes: number };
  daysAhead: number;
  now?: Date;
  /** Margen mínimo para reservar (no se puede pedir un turno para dentro de 30 minutos). */
  leadMinutes?: number;
}): Promise<{ ymd: string; slots: Slot[] }[]> {
  const now = params.now ?? new Date();
  const lead = new Date(now.getTime() + (params.leadMinutes ?? 60) * 60000);
  const first = todayYmd(params.timeZone, now);
  const days = Array.from({ length: params.daysAhead + 1 }, (_, i) => addDays(first, i));
  const from = dayRangeUtc(days[0], params.timeZone).from;
  const to = dayRangeUtc(days[days.length - 1], params.timeZone).to;

  const [schedules, appointments, blocks] = await Promise.all([
    prisma.schedule.findMany({ where: { professionalId: params.professional.id } }),
    prisma.appointment.findMany({
      where: {
        professionalId: params.professional.id,
        status: { not: "CANCELADO" },
        overbook: false,
        startsAt: { lt: to },
        endsAt: { gt: from },
      },
      select: { id: true, startsAt: true, endsAt: true },
    }),
    prisma.block.findMany({
      where: {
        clinicId: params.clinicId,
        OR: [{ professionalId: params.professional.id }, { professionalId: null }],
        startsAt: { lt: to },
        endsAt: { gt: from },
      },
    }),
  ]);

  return days.map((ymd) => ({
    ymd,
    slots: freeSlots(
      buildDaySlots({
        ymd,
        timeZone: params.timeZone,
        slotMinutes: params.professional.slotMinutes,
        schedules,
        appointments,
        blocks,
        now: lead,
      }),
    ),
  }));
}
