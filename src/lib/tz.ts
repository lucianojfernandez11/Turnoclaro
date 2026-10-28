/**
 * Fechas y zonas horarias, sin dependencias.
 *
 * Convenciones:
 * - "ymd" es una fecha local del consultorio en formato "2026-11-02".
 * - "minutos" son minutos desde las 00:00 locales (510 = 08:30).
 * - En la base todo se guarda en UTC; acá se convierte ida y vuelta.
 */

const partsCache = new Map<string, Intl.DateTimeFormat>();

function formatterFor(timeZone: string): Intl.DateTimeFormat {
  let f = partsCache.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    partsCache.set(timeZone, f);
  }
  return f;
}

export type ZonedParts = {
  ymd: string;
  minutes: number;
  /** 1 = lunes … 7 = domingo */
  weekday: number;
};

function rawParts(date: Date, timeZone: string) {
  const out: Record<string, number> = {};
  for (const p of formatterFor(timeZone).formatToParts(date)) {
    if (p.type !== "literal") out[p.type] = Number(p.value);
  }
  return out as { year: number; month: number; day: number; hour: number; minute: number; second: number };
}

/** Diferencia en minutos entre la hora local de la zona y UTC en ese instante (Argentina: -180). */
export function tzOffsetMinutes(date: Date, timeZone: string): number {
  const p = rawParts(date, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return Math.round((asUtc - Math.floor(date.getTime() / 1000) * 1000) / 60000);
}

export function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

export function isYmd(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

/** Instante UTC que corresponde a una fecha y hora locales del consultorio. */
export function zonedToUtc(ymd: string, minutes: number, timeZone: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  const guess = Date.UTC(y, m - 1, d, 0, minutes);
  let offset = tzOffsetMinutes(new Date(guess), timeZone);
  let result = guess - offset * 60000;
  // Segundo ajuste por si hubo cambio de horario entre el "guess" y el resultado.
  const offset2 = tzOffsetMinutes(new Date(result), timeZone);
  if (offset2 !== offset) {
    offset = offset2;
    result = guess - offset * 60000;
  }
  return new Date(result);
}

export function utcToZoned(date: Date, timeZone: string): ZonedParts {
  const p = rawParts(date, timeZone);
  const ymd = `${p.year}-${pad2(p.month)}-${pad2(p.day)}`;
  return { ymd, minutes: p.hour * 60 + p.minute, weekday: weekdayOf(ymd) };
}

/** 1 = lunes … 7 = domingo */
export function weekdayOf(ymd: string): number {
  const [y, m, d] = ymd.split("-").map(Number);
  const js = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0 = domingo
  return js === 0 ? 7 : js;
}

export function addDays(ymd: string, days: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return `${dt.getUTCFullYear()}-${pad2(dt.getUTCMonth() + 1)}-${pad2(dt.getUTCDate())}`;
}

export function todayYmd(timeZone: string, now: Date = new Date()): string {
  return utcToZoned(now, timeZone).ymd;
}

/** Rango UTC [desde, hasta) que cubre un día local completo. */
export function dayRangeUtc(ymd: string, timeZone: string): { from: Date; to: Date } {
  return { from: zonedToUtc(ymd, 0, timeZone), to: zonedToUtc(addDays(ymd, 1), 0, timeZone) };
}

export function minutesToHHMM(minutes: number): string {
  return `${pad2(Math.floor(minutes / 60))}:${pad2(minutes % 60)}`;
}

/** "08:30" → 510. Devuelve null si no es una hora válida. */
export function hhmmToMinutes(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 24 || min > 59 || (h === 24 && min > 0)) return null;
  return h * 60 + min;
}

const WEEKDAYS = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"];
const WEEKDAYS_SHORT = ["lun", "mar", "mié", "jue", "vie", "sáb", "dom"];
const MONTHS = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

export function weekdayName(weekday: number): string {
  return WEEKDAYS[weekday - 1] ?? "";
}

export function weekdayShort(weekday: number): string {
  return WEEKDAYS_SHORT[weekday - 1] ?? "";
}

/** "lunes 2 de noviembre" */
export function formatYmdLong(ymd: string): string {
  const [, m, d] = ymd.split("-").map(Number);
  return `${weekdayName(weekdayOf(ymd))} ${d} de ${MONTHS[m - 1]}`;
}

/** "2/11" */
export function formatYmdShort(ymd: string): string {
  const [, m, d] = ymd.split("-").map(Number);
  return `${d}/${m}`;
}

/** Fecha y hora local legible de un instante UTC: "lunes 2 de noviembre, 09:20" */
export function formatInstant(date: Date, timeZone: string): string {
  const z = utcToZoned(date, timeZone);
  return `${formatYmdLong(z.ymd)}, ${minutesToHHMM(z.minutes)}`;
}

export function formatTime(date: Date, timeZone: string): string {
  return minutesToHHMM(utcToZoned(date, timeZone).minutes);
}

/** Zonas horarias de Argentina que se ofrecen en Ajustes. */
export const ARGENTINA_TIMEZONES = [
  "America/Argentina/Buenos_Aires",
  "America/Argentina/Catamarca",
  "America/Argentina/Cordoba",
  "America/Argentina/Jujuy",
  "America/Argentina/La_Rioja",
  "America/Argentina/Mendoza",
  "America/Argentina/Rio_Gallegos",
  "America/Argentina/Salta",
  "America/Argentina/San_Juan",
  "America/Argentina/San_Luis",
  "America/Argentina/Tucuman",
  "America/Argentina/Ushuaia",
];
