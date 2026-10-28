"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Role } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { type ActionState, bool, int, isEmail, optStr, slugify, str } from "@/lib/forms";
import { hashPassword, passwordProblem } from "@/lib/password";
import { checkAccount } from "@/lib/whatsapp";
import { decryptSecret, encryptSecret, randomToken, secretsConfigured } from "@/lib/secrets";
import { ARGENTINA_TIMEZONES, hhmmToMinutes, isYmd, addDays, zonedToUtc } from "@/lib/tz";

const admin = () => requireUser(["ADMIN"]);

// ---------- Consultorio ----------

export async function updateClinicAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await admin();
  const name = str(fd, "name");
  const slug = slugify(str(fd, "slug"));
  const timezone = str(fd, "timezone");
  const areaCode = str(fd, "defaultAreaCode").replace(/\D/g, "").replace(/^0/, "");
  const daysAhead = int(fd, "bookingDaysAhead", 14);
  if (name.length < 3) return { error: "Escribí el nombre del consultorio." };
  if (slug.length < 3) return { error: "El link de reservas tiene que tener al menos 3 letras." };
  if (!ARGENTINA_TIMEZONES.includes(timezone)) return { error: "Elegí una zona horaria de la lista." };
  if (areaCode.length < 2 || areaCode.length > 4) return { error: "La característica tiene 2 a 4 dígitos (ej.: 381)." };
  if (daysAhead < 1 || daysAhead > 90) return { error: "Los días para reservar online van de 1 a 90." };
  const taken = await prisma.clinic.findFirst({ where: { slug, id: { not: user.clinic.id } } });
  if (taken) return { error: "Ese link de reservas ya lo usa otro consultorio. Probá con otro." };

  await prisma.clinic.update({
    where: { id: user.clinic.id },
    data: {
      name,
      slug,
      timezone,
      defaultAreaCode: areaCode,
      address: optStr(fd, "address"),
      phone: optStr(fd, "phone"),
      reminderTemplate: optStr(fd, "reminderTemplate"),
      hideSpecialtyInMessages: bool(fd, "hideSpecialtyInMessages"),
      bookingEnabled: bool(fd, "bookingEnabled"),
      bookingAutoConfirm: bool(fd, "bookingAutoConfirm"),
      bookingDaysAhead: daysAhead,
    },
  });
  revalidatePath("/panel", "layout");
  return { ok: "Cambios guardados." };
}

// ---------- Profesionales ----------

async function ownProfessional(clinicId: string, id: string) {
  const p = await prisma.professional.findFirst({ where: { id, clinicId } });
  if (!p) throw new Error("Profesional inexistente");
  return p;
}

function readProfessional(fd: FormData): { error: string } | { data: { name: string; specialty: string; color: string; slotMinutes: number; bookable: boolean } } {
  const name = str(fd, "name");
  const specialty = str(fd, "specialty");
  const color = /^#[0-9a-fA-F]{6}$/.test(str(fd, "color")) ? str(fd, "color") : "#1f6b5c";
  const slotMinutes = int(fd, "slotMinutes", 20);
  if (name.length < 3) return { error: "Escribí el nombre del profesional." };
  if (specialty.length < 2) return { error: "Escribí la especialidad." };
  if (slotMinutes < 5 || slotMinutes > 240) return { error: "La duración del turno va de 5 a 240 minutos." };
  return { data: { name, specialty, color, slotMinutes, bookable: bool(fd, "bookable") } };
}

export async function createProfessionalAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await admin();
  const r = readProfessional(fd);
  if ("error" in r) return r;
  const p = await prisma.professional.create({ data: { ...r.data, clinicId: user.clinic.id } });
  // Horario inicial de lunes a viernes, 9 a 13, para que la agenda no arranque vacía.
  await prisma.schedule.createMany({
    data: [1, 2, 3, 4, 5].map((weekday) => ({
      clinicId: user.clinic.id, professionalId: p.id, weekday, startMinute: 540, endMinute: 780,
    })),
  });
  redirect(`/panel/ajustes/profesionales/${p.id}?nuevo=1`);
}

export async function updateProfessionalAction(id: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await admin();
  await ownProfessional(user.clinic.id, id);
  const r = readProfessional(fd);
  if ("error" in r) return r;
  await prisma.professional.update({ where: { id }, data: { ...r.data, active: bool(fd, "active") } });
  revalidatePath("/panel", "layout");
  return { ok: "Datos guardados." };
}

export async function saveSchedulesAction(professionalId: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await admin();
  await ownProfessional(user.clinic.id, professionalId);
  const days = fd.getAll("weekday").map(String);
  const starts = fd.getAll("start").map(String);
  const ends = fd.getAll("end").map(String);
  const rows: { weekday: number; startMinute: number; endMinute: number }[] = [];
  for (let i = 0; i < days.length; i++) {
    const weekday = Number(days[i]);
    if (!weekday) continue; // fila vacía
    const s = hhmmToMinutes(starts[i]);
    const e = hhmmToMinutes(ends[i]);
    if (weekday < 1 || weekday > 7 || s === null || e === null) {
      return { error: `Revisá la fila ${i + 1}: falta el día o alguna hora.` };
    }
    if (e <= s) return { error: `En la fila ${i + 1}, la hora de fin tiene que ser posterior a la de inicio.` };
    rows.push({ weekday, startMinute: s, endMinute: e });
  }
  for (const a of rows) {
    const clash = rows.find((b) => b !== a && b.weekday === a.weekday && a.startMinute < b.endMinute && b.startMinute < a.endMinute);
    if (clash) return { error: "Hay dos franjas del mismo día que se pisan." };
  }
  await prisma.$transaction([
    prisma.schedule.deleteMany({ where: { professionalId } }),
    prisma.schedule.createMany({
      data: rows.map((r) => ({ ...r, clinicId: user.clinic.id, professionalId })),
    }),
  ]);
  revalidatePath(`/panel/ajustes/profesionales/${professionalId}`);
  return { ok: "Horarios guardados." };
}

// ---------- Bloqueos y feriados ----------

export async function addBlockAction(professionalId: string | null, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await admin();
  if (professionalId) await ownProfessional(user.clinic.id, professionalId);
  const tz = user.clinic.timezone;
  const fromYmd = str(fd, "from");
  const toYmd = str(fd, "to") || fromYmd;
  const reason = str(fd, "reason") || (professionalId ? "Bloqueado" : "Feriado");
  if (!isYmd(fromYmd) || !isYmd(toYmd)) return { error: "Elegí las fechas." };
  if (toYmd < fromYmd) return { error: "La fecha final no puede ser anterior a la inicial." };
  const startTime = str(fd, "startTime");
  const endTime = str(fd, "endTime");
  let startsAt: Date;
  let endsAt: Date;
  if (startTime || endTime) {
    const s = hhmmToMinutes(startTime);
    const e = hhmmToMinutes(endTime);
    if (s === null || e === null) return { error: "Completá las dos horas, o dejalas vacías para bloquear días completos." };
    startsAt = zonedToUtc(fromYmd, s, tz);
    endsAt = zonedToUtc(toYmd, e, tz);
  } else {
    startsAt = zonedToUtc(fromYmd, 0, tz);
    endsAt = zonedToUtc(addDays(toYmd, 1), 0, tz);
  }
  if (endsAt <= startsAt) return { error: "El final tiene que ser posterior al inicio." };
  await prisma.block.create({ data: { clinicId: user.clinic.id, professionalId, startsAt, endsAt, reason } });
  revalidatePath("/panel", "layout");
  return { ok: "Bloqueo agregado. Los turnos ya dados en ese rango siguen en la agenda: revisalos." };
}

export async function deleteBlockAction(id: string): Promise<void> {
  const user = await admin();
  await prisma.block.deleteMany({ where: { id, clinicId: user.clinic.id } });
  revalidatePath("/panel", "layout");
}

// ---------- Obras sociales ----------

export async function addInsuranceAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await admin();
  const name = str(fd, "name");
  if (name.length < 2) return { error: "Escribí el nombre." };
  const exists = await prisma.insurance.findUnique({ where: { clinicId_name: { clinicId: user.clinic.id, name } } });
  if (exists) {
    await prisma.insurance.update({ where: { id: exists.id }, data: { active: true } });
  } else {
    await prisma.insurance.create({ data: { clinicId: user.clinic.id, name } });
  }
  revalidatePath("/panel/ajustes/obras-sociales");
  return { ok: `“${name}” agregada.` };
}

export async function toggleInsuranceAction(id: string): Promise<void> {
  const user = await admin();
  const ins = await prisma.insurance.findFirst({ where: { id, clinicId: user.clinic.id } });
  if (ins) await prisma.insurance.update({ where: { id }, data: { active: !ins.active } });
  revalidatePath("/panel/ajustes/obras-sociales");
}

// ---------- Usuarios ----------

const ROLES: Role[] = ["ADMIN", "SECRETARIA", "PROFESIONAL"];

async function validProfessionalLink(clinicId: string, professionalId: string | null, exceptMembershipId?: string) {
  if (!professionalId) return null;
  const p = await prisma.professional.findFirst({ where: { id: professionalId, clinicId } });
  if (!p) return "El profesional elegido no existe.";
  const used = await prisma.membership.findFirst({
    where: { professionalId, ...(exceptMembershipId ? { id: { not: exceptMembershipId } } : {}) },
  });
  if (used) return "Ese profesional ya está vinculado a otro usuario.";
  return null;
}

export async function createUserAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const me = await admin();
  const email = str(fd, "email").toLowerCase();
  const name = str(fd, "name");
  const role = str(fd, "role") as Role;
  const password = str(fd, "password");
  const professionalId = optStr(fd, "professionalId");
  if (!isEmail(email)) return { error: "El email no es válido." };
  if (name.length < 3) return { error: "Escribí el nombre." };
  if (!ROLES.includes(role)) return { error: "Elegí un rol." };
  if (role === "PROFESIONAL" && !professionalId) return { error: "Un usuario profesional tiene que estar vinculado a su agenda." };
  const linkProblem = await validProfessionalLink(me.clinic.id, professionalId);
  if (linkProblem) return { error: linkProblem };

  let user = await prisma.user.findUnique({ where: { email } });
  if (user) {
    const member = await prisma.membership.findUnique({ where: { userId_clinicId: { userId: user.id, clinicId: me.clinic.id } } });
    if (member) return { error: "Ese usuario ya pertenece al consultorio." };
  } else {
    const problem = passwordProblem(password);
    if (problem) return { error: problem };
    user = await prisma.user.create({ data: { email, name, passwordHash: await hashPassword(password) } });
  }
  await prisma.membership.create({ data: { userId: user.id, clinicId: me.clinic.id, role, professionalId } });
  await audit({ clinicId: me.clinic.id, userId: me.userId, action: "usuario_creado", entity: "User", entityId: user.id, detail: { role } });
  revalidatePath("/panel/ajustes/usuarios");
  return { ok: `Listo. ${name} ya puede ingresar con ${email}.` };
}

export async function updateMembershipAction(membershipId: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const me = await admin();
  const m = await prisma.membership.findFirst({ where: { id: membershipId, clinicId: me.clinic.id } });
  if (!m) return { error: "No se encontró el usuario." };
  const role = str(fd, "role") as Role;
  const professionalId = optStr(fd, "professionalId");
  if (!ROLES.includes(role)) return { error: "Elegí un rol." };
  if (m.userId === me.userId && role !== "ADMIN") return { error: "No podés quitarte el rol de administración a vos mismo." };
  if (role === "PROFESIONAL" && !professionalId) return { error: "Un usuario profesional tiene que estar vinculado a su agenda." };
  const linkProblem = await validProfessionalLink(me.clinic.id, professionalId, m.id);
  if (linkProblem) return { error: linkProblem };
  await prisma.membership.update({ where: { id: m.id }, data: { role, professionalId } });
  const newPassword = str(fd, "newPassword");
  if (newPassword) {
    const problem = passwordProblem(newPassword);
    if (problem) return { error: problem };
    await prisma.user.update({ where: { id: m.userId }, data: { passwordHash: await hashPassword(newPassword), failedLogins: 0, lockedUntil: null } });
    await prisma.session.deleteMany({ where: { userId: m.userId } });
  }
  revalidatePath("/panel/ajustes/usuarios");
  return { ok: newPassword ? "Guardado. La contraseña nueva ya funciona." : "Guardado." };
}

export async function removeMembershipAction(membershipId: string): Promise<void> {
  const me = await admin();
  const m = await prisma.membership.findFirst({ where: { id: membershipId, clinicId: me.clinic.id } });
  if (!m || m.userId === me.userId) return;
  await prisma.$transaction([
    prisma.membership.delete({ where: { id: m.id } }),
    prisma.session.deleteMany({ where: { userId: m.userId, clinicId: me.clinic.id } }),
  ]);
  revalidatePath("/panel/ajustes/usuarios");
}

// ---------- WhatsApp automático ----------

const WA_MODES = ["MANUAL", "PACK"] as const;

/** Elige "con un toque" (manual) o "packs de TurnoClaro". La cuenta propia se elige al conectarla. */
export async function setWhatsappModeAction(mode: (typeof WA_MODES)[number]): Promise<void> {
  const user = await admin();
  if (!WA_MODES.includes(mode)) return;
  await prisma.clinic.update({ where: { id: user.clinic.id }, data: { waMode: mode } });
  await audit({ clinicId: user.clinic.id, userId: user.userId, action: "whatsapp_modo", entity: "Clinic", entityId: user.clinic.id, detail: { mode } });
  revalidatePath("/panel", "layout");
}

/** Conecta la cuenta propia de WhatsApp del consultorio (Meta le cobra a él). */
export async function saveOwnWhatsappAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await admin();
  if (!secretsConfigured()) {
    return { error: "Falta la clave SECRETS_KEY en el archivo .env del servidor. Pedile a soporte que la cargue." };
  }
  const current = await prisma.clinic.findUniqueOrThrow({ where: { id: user.clinic.id } });
  const phoneNumberId = str(fd, "waPhoneNumberId").replace(/\D/g, "");
  const tokenInput = str(fd, "waToken");
  const secretInput = str(fd, "waAppSecret");
  const templateName = str(fd, "waTemplateName") || "recordatorio_turno";
  const templateLang = str(fd, "waTemplateLang") || "es_AR";
  const token = tokenInput || decryptSecret(current.waTokenEnc);
  const appSecret = secretInput || decryptSecret(current.waAppSecretEnc);

  if (phoneNumberId.length < 8) return { error: "Pegá el “Identificador del número de teléfono” que aparece en Meta (son solo números)." };
  if (!token) return { error: "Pegá el token de acceso de Meta." };
  if (!appSecret) return { error: "Pegá la clave secreta de la app de Meta." };
  if (!/^[a-z0-9_]{1,512}$/.test(templateName)) return { error: "El nombre de la plantilla va en minúsculas, sin espacios (ej.: recordatorio_turno)." };
  if (!/^[a-z]{2}(_[A-Z]{2})?$/.test(templateLang)) return { error: "El idioma de la plantilla tiene el formato es_AR." };

  const other = await prisma.clinic.findFirst({ where: { waPhoneNumberId: phoneNumberId, id: { not: user.clinic.id } }, select: { id: true } });
  if (other) return { error: "Ese número de WhatsApp ya está conectado a otro consultorio." };

  const check = await checkAccount({ phoneNumberId, token });
  if (!check.ok) return { error: `Meta no aceptó los datos: ${check.error}. Revisá el identificador y el token.` };

  await prisma.clinic.update({
    where: { id: user.clinic.id },
    data: {
      waMode: "PROPIA",
      waPhoneNumberId: phoneNumberId,
      waTokenEnc: encryptSecret(token),
      waAppSecretEnc: encryptSecret(appSecret),
      waTemplateName: templateName,
      waTemplateLang: templateLang,
      waVerifyToken: current.waVerifyToken ?? randomToken(),
    },
  });
  await audit({ clinicId: user.clinic.id, userId: user.userId, action: "whatsapp_cuenta_propia", entity: "Clinic", entityId: user.clinic.id, detail: { phoneNumberId } });
  revalidatePath("/panel", "layout");
  return { ok: `¡Conectado! Número verificado: ${check.phone}. Falta un paso: configurar el webhook en Meta (abajo).` };
}

/** Desconecta la cuenta propia y vuelve al envío con un toque. */
export async function disconnectOwnWhatsappAction(): Promise<void> {
  const user = await admin();
  await prisma.clinic.update({
    where: { id: user.clinic.id },
    data: { waMode: "MANUAL", waPhoneNumberId: null, waTokenEnc: null, waAppSecretEnc: null },
  });
  await audit({ clinicId: user.clinic.id, userId: user.userId, action: "whatsapp_desconectar", entity: "Clinic", entityId: user.clinic.id });
  revalidatePath("/panel", "layout");
}
