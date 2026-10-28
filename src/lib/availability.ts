/**
 * Cálculo de horarios de un profesional para un día. Lógica pura (sin base de datos),
 * así se puede probar sola y la usan tanto la agenda como la reserva online.
 */
import { weekdayOf, zonedToUtc, utcToZoned } from "./tz";

export type ScheduleRange = { weekday: number; startMinute: number; endMinute: number };
export type TimeRange = { startsAt: Date; endsAt: Date };
export type BusyRange = TimeRange & { id?: string; reason?: string };

export type Slot = {
  startsAt: Date;
  endsAt: Date;
  /** minutos locales desde las 00:00 */
  minutes: number;
  state: "libre" | "ocupado" | "bloqueado" | "pasado";
  appointmentId?: string;
  blockReason?: string;
};

export function overlaps(a: TimeRange, b: TimeRange): boolean {
  return a.startsAt < b.endsAt && b.startsAt < a.endsAt;
}

/**
 * Arma la grilla de turnos del día a partir de los horarios semanales y la duración de turno.
 * - appointments: turnos activos (no cancelados) que ocupan lugar.
 * - blocks: bloqueos del profesional o del consultorio entero.
 * - now: para marcar como "pasado" lo que ya ocurrió.
 */
export function buildDaySlots(params: {
  ymd: string;
  timeZone: string;
  slotMinutes: number;
  schedules: ScheduleRange[];
  appointments: BusyRange[];
  blocks: BusyRange[];
  now?: Date;
}): Slot[] {
  const { ymd, timeZone, schedules, appointments, blocks } = params;
  const slotMinutes = Math.max(5, Math.floor(params.slotMinutes));
  const now = params.now ?? new Date();
  const weekday = weekdayOf(ymd);
  const ranges = schedules
    .filter((s) => s.weekday === weekday && s.endMinute > s.startMinute)
    .sort((a, b) => a.startMinute - b.startMinute);

  const slots: Slot[] = [];
  const seen = new Set<number>();
  for (const r of ranges) {
    for (let m = r.startMinute; m + slotMinutes <= r.endMinute; m += slotMinutes) {
      if (seen.has(m)) continue; // franjas que se pisan en la configuración
      seen.add(m);
      const startsAt = zonedToUtc(ymd, m, timeZone);
      const endsAt = new Date(startsAt.getTime() + slotMinutes * 60000);
      const slot: Slot = { startsAt, endsAt, minutes: m, state: "libre" };
      const appt = appointments.find((a) => overlaps(a, slot));
      const block = blocks.find((b) => overlaps(b, slot));
      if (appt) {
        slot.state = "ocupado";
        slot.appointmentId = appt.id;
      } else if (block) {
        slot.state = "bloqueado";
        slot.blockReason = block.reason;
      } else if (startsAt <= now) {
        slot.state = "pasado";
      }
      slots.push(slot);
    }
  }
  return slots.sort((a, b) => a.minutes - b.minutes);
}

/** Solo los horarios que se pueden reservar. */
export function freeSlots(slots: Slot[]): Slot[] {
  return slots.filter((s) => s.state === "libre");
}

/**
 * ¿El rango pedido cae dentro del horario de atención del profesional?
 * Se usa para validar una reserva online (que no se puede salir de la grilla).
 */
export function isWithinSchedule(range: TimeRange, schedules: ScheduleRange[], timeZone: string): boolean {
  const start = utcToZoned(range.startsAt, timeZone);
  const end = utcToZoned(range.endsAt, timeZone);
  const endMinutes = end.ymd === start.ymd ? end.minutes : 1440;
  if (end.ymd !== start.ymd && end.minutes !== 0) return false;
  return schedules.some(
    (s) => s.weekday === start.weekday && s.startMinute <= start.minutes && endMinutes <= s.endMinute,
  );
}
