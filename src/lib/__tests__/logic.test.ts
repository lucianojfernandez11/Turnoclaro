/**
 * Pruebas de la lógica pura. Correr con: npm test
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  zonedToUtc, utcToZoned, addDays, weekdayOf, dayRangeUtc, hhmmToMinutes, minutesToHHMM, formatYmdLong, isYmd,
} from "../tz";
import { buildDaySlots, freeSlots, isWithinSchedule } from "../availability";
import { normalizeArPhone, prettyPhone } from "../phone";
import { renderTemplate, parseReplyText, firstName } from "../template";
import { hashPassword, verifyPassword } from "../password";
import { parseCsv, rowsToPatients } from "../csv";

const TZ = "America/Argentina/Tucuman";

test("zona horaria: hora local de Tucumán ↔ UTC", () => {
  const d = zonedToUtc("2026-11-02", 9 * 60, TZ);
  assert.equal(d.toISOString(), "2026-11-02T12:00:00.000Z");
  const back = utcToZoned(d, TZ);
  assert.deepEqual(back, { ymd: "2026-11-02", minutes: 540, weekday: 1 });
  // 22:30 local del 2/11 es 01:30 UTC del 3/11
  assert.equal(zonedToUtc("2026-11-02", 22 * 60 + 30, TZ).toISOString(), "2026-11-03T01:30:00.000Z");
  assert.equal(utcToZoned(new Date("2026-11-03T01:30:00Z"), TZ).ymd, "2026-11-02");
});

test("zona horaria: funciona con zonas con cambio de horario", () => {
  // Madrid en verano UTC+2, en invierno UTC+1
  assert.equal(zonedToUtc("2026-07-01", 600, "Europe/Madrid").toISOString(), "2026-07-01T08:00:00.000Z");
  assert.equal(zonedToUtc("2026-12-01", 600, "Europe/Madrid").toISOString(), "2026-12-01T09:00:00.000Z");
});

test("fechas: días, semana y formato", () => {
  assert.equal(addDays("2026-12-31", 1), "2027-01-01");
  assert.equal(addDays("2026-03-01", -1), "2026-02-28");
  assert.equal(weekdayOf("2026-11-01"), 7); // domingo
  assert.equal(weekdayOf("2026-11-02"), 1); // lunes
  const r = dayRangeUtc("2026-11-02", TZ);
  assert.equal(r.from.toISOString(), "2026-11-02T03:00:00.000Z");
  assert.equal(r.to.toISOString(), "2026-11-03T03:00:00.000Z");
  assert.equal(hhmmToMinutes("08:30"), 510);
  assert.equal(hhmmToMinutes("8:05"), 485);
  assert.equal(hhmmToMinutes("25:00"), null);
  assert.equal(hhmmToMinutes("abc"), null);
  assert.equal(minutesToHHMM(510), "08:30");
  assert.equal(formatYmdLong("2026-11-02"), "lunes 2 de noviembre");
  assert.equal(isYmd("2026-02-30"), false);
  assert.equal(isYmd("2026-02-28"), true);
});

test("agenda: arma la grilla y marca ocupados, bloqueados y pasados", () => {
  const ymd = "2026-11-02"; // lunes
  const schedules = [
    { weekday: 1, startMinute: 8 * 60 + 30, endMinute: 10 * 60 },
    { weekday: 1, startMinute: 16 * 60, endMinute: 17 * 60 },
    { weekday: 2, startMinute: 8 * 60, endMinute: 12 * 60 },
  ];
  const appt = { id: "a1", startsAt: zonedToUtc(ymd, 9 * 60, TZ), endsAt: zonedToUtc(ymd, 9 * 60 + 30, TZ) };
  const block = { reason: "Congreso", startsAt: zonedToUtc(ymd, 16 * 60, TZ), endsAt: zonedToUtc(ymd, 16 * 60 + 30, TZ) };
  const slots = buildDaySlots({
    ymd, timeZone: TZ, slotMinutes: 30, schedules, appointments: [appt], blocks: [block],
    now: zonedToUtc(ymd, 8 * 60 + 45, TZ),
  });
  assert.deepEqual(slots.map((s) => minutesToHHMM(s.minutes)), ["08:30", "09:00", "09:30", "16:00", "16:30"]);
  assert.deepEqual(slots.map((s) => s.state), ["pasado", "ocupado", "libre", "bloqueado", "libre"]);
  assert.equal(slots[1].appointmentId, "a1");
  assert.equal(slots[3].blockReason, "Congreso");
  assert.equal(freeSlots(slots).length, 2);
});

test("agenda: un turno largo ocupa todos los horarios que pisa", () => {
  const ymd = "2026-11-02";
  const slots = buildDaySlots({
    ymd, timeZone: TZ, slotMinutes: 20,
    schedules: [{ weekday: 1, startMinute: 600, endMinute: 720 }],
    appointments: [{ id: "x", startsAt: zonedToUtc(ymd, 610, TZ), endsAt: zonedToUtc(ymd, 650, TZ) }],
    blocks: [], now: new Date("2026-01-01T00:00:00Z"),
  });
  assert.deepEqual(slots.map((s) => s.state), ["ocupado", "ocupado", "ocupado", "libre", "libre", "libre"]);
});

test("agenda: un día sin horario no tiene turnos", () => {
  const slots = buildDaySlots({
    ymd: "2026-11-01", timeZone: TZ, slotMinutes: 20,
    schedules: [{ weekday: 1, startMinute: 600, endMinute: 720 }], appointments: [], blocks: [],
  });
  assert.equal(slots.length, 0);
});

test("reserva online: solo dentro del horario de atención", () => {
  const schedules = [{ weekday: 1, startMinute: 540, endMinute: 720 }];
  const ok = { startsAt: zonedToUtc("2026-11-02", 690, TZ), endsAt: zonedToUtc("2026-11-02", 720, TZ) };
  const late = { startsAt: zonedToUtc("2026-11-02", 700, TZ), endsAt: zonedToUtc("2026-11-02", 730, TZ) };
  const tuesday = { startsAt: zonedToUtc("2026-11-03", 600, TZ), endsAt: zonedToUtc("2026-11-03", 630, TZ) };
  assert.equal(isWithinSchedule(ok, schedules, TZ), true);
  assert.equal(isWithinSchedule(late, schedules, TZ), false);
  assert.equal(isWithinSchedule(tuesday, schedules, TZ), false);
});

test("teléfonos: formatos argentinos comunes", () => {
  assert.equal(normalizeArPhone("381 15 586-7891"), "5493815867891");
  assert.equal(normalizeArPhone("0381 155867891"), "5493815867891");
  assert.equal(normalizeArPhone("3815867891"), "5493815867891");
  assert.equal(normalizeArPhone("+54 9 381 586 7891"), "5493815867891");
  assert.equal(normalizeArPhone("54 381 586 7891"), "5493815867891");
  assert.equal(normalizeArPhone("5867891"), "5493815867891"); // sin característica: usa la del consultorio
  assert.equal(normalizeArPhone("15 5867891"), "5493815867891");
  assert.equal(normalizeArPhone("11 15 2345 6789"), "5491123456789");
  assert.equal(normalizeArPhone("1123456789"), "5491123456789");
  assert.equal(normalizeArPhone("23456789", "11"), "5491123456789");
  assert.equal(normalizeArPhone("0388 15 412 3456"), "5493884123456");
  assert.equal(normalizeArPhone("123"), null);
  assert.equal(normalizeArPhone(""), null);
  assert.equal(prettyPhone("5493815867891"), "+54 9 381 586-7891");
});

test("mensajes: plantilla, nombre y respuestas", () => {
  const text = renderTemplate("Hola {paciente}, turno {fecha} {hora} {desconocida}", {
    paciente: "Ana", profesional: "Dra. R", fecha: "lunes 2", hora: "09:00", consultorio: "C", direccion: "", link: "L",
  });
  assert.equal(text, "Hola Ana, turno lunes 2 09:00 {desconocida}");
  assert.match(renderTemplate("", { paciente: "Ana", profesional: "P", fecha: "f", hora: "h", consultorio: "C", direccion: "", link: "https://x" }), /https:\/\/x/);
  assert.equal(firstName("Pérez, Juan Carlos"), "Juan");
  assert.equal(firstName("María López"), "María");
  assert.equal(parseReplyText("Sí, confirmo"), "CONFIRMA");
  assert.equal(parseReplyText("si"), "CONFIRMA");
  assert.equal(parseReplyText("NO puedo ir"), "CANCELA");
  assert.equal(parseReplyText("Confirmo"), "CONFIRMA");
  assert.equal(parseReplyText("hola, a qué hora era?"), null);
});

test("contraseñas: hash y verificación", async () => {
  const h = await hashPassword("clave-segura-1");
  assert.match(h, /^scrypt\$/);
  assert.equal(await verifyPassword("clave-segura-1", h), true);
  assert.equal(await verifyPassword("otra", h), false);
  assert.equal(await verifyPassword("x", "basura"), false);
});

test("CSV: importa pacientes desde Excel", () => {
  const csv = '﻿Apellido y nombre;DNI;Celular;Obra social\n"Pérez; Juan";30.123.456;381 155867891;OSDE\n\nLópez Ana;;3814000000;\n';
  const { patients, missing } = rowsToPatients(parseCsv(csv));
  assert.deepEqual(missing, []);
  assert.equal(patients.length, 2);
  assert.deepEqual(patients[0], { fullName: "Pérez; Juan", dni: "30123456", phone: "381 155867891", email: "", insurance: "OSDE", affiliateNumber: "" });
  assert.deepEqual(rowsToPatients(parseCsv("foo,bar\n1,2")).missing, ["nombre", "telefono"]);
});
