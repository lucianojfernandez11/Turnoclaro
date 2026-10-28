"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { createSession, destroySession } from "@/lib/auth";
import { hashPassword, passwordProblem, verifyPassword } from "@/lib/password";
import { type ActionState, isEmail, slugify, str } from "@/lib/forms";

const MAX_FAILS = 5;
const LOCK_MINUTES = 15;

export async function loginAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const email = str(fd, "email").toLowerCase();
  const password = str(fd, "password");
  if (!email || !password) return { error: "Completá email y contraseña." };

  const user = await prisma.user.findUnique({
    where: { email },
    include: { memberships: { include: { clinic: true }, orderBy: { id: "asc" } } },
  });
  const generic = { error: "Email o contraseña incorrectos." };
  if (!user) {
    await hashPassword(password); // mismo tiempo de respuesta exista o no el usuario
    return generic;
  }
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    return { error: "Demasiados intentos fallidos. Probá de nuevo en unos minutos." };
  }
  if (!(await verifyPassword(password, user.passwordHash))) {
    const fails = user.failedLogins + 1;
    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedLogins: fails >= MAX_FAILS ? 0 : fails,
        lockedUntil: fails >= MAX_FAILS ? new Date(Date.now() + LOCK_MINUTES * 60000) : null,
      },
    });
    return generic;
  }

  const membership = user.memberships.find((m) => m.clinic.active) ?? user.memberships[0];
  if (!membership && !user.isSuperadmin) return { error: "Tu usuario no está asignado a ningún consultorio." };

  await prisma.user.update({
    where: { id: user.id },
    data: { failedLogins: 0, lockedUntil: null, lastLoginAt: new Date() },
  });

  if (!membership) {
    // Superadmin sin consultorio propio: necesita uno cualquiera para la sesión.
    const any = await prisma.clinic.findFirst({ orderBy: { createdAt: "asc" } });
    if (!any) return { error: "Todavía no hay consultorios creados." };
    await createSession(user.id, any.id);
    redirect("/plataforma");
  }
  if (!membership.clinic.active) return { error: "El consultorio está suspendido. Escribinos para reactivarlo." };
  await createSession(user.id, membership.clinicId);
  redirect("/panel/agenda");
}

export async function logoutAction(): Promise<void> {
  await destroySession();
  redirect("/login");
}

const DEFAULT_INSURANCES = ["Particular", "Subsidio de Salud", "PAMI", "OSDE", "Swiss Medical", "Galeno", "OSPE", "Otra"];

export async function signupAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  if (process.env.SIGNUP_ENABLED === "false") return { error: "El registro está cerrado. Escribinos para darte de alta." };
  const clinicName = str(fd, "clinicName");
  const name = str(fd, "name");
  const email = str(fd, "email").toLowerCase();
  const password = str(fd, "password");
  const phone = str(fd, "phone");
  if (clinicName.length < 3) return { error: "Escribí el nombre del consultorio." };
  if (name.length < 3) return { error: "Escribí tu nombre." };
  if (!isEmail(email)) return { error: "El email no es válido." };
  const pwProblem = passwordProblem(password);
  if (pwProblem) return { error: pwProblem };
  if (await prisma.user.findUnique({ where: { email } })) {
    return { error: "Ya existe una cuenta con ese email. Ingresá desde “Ingresar”." };
  }

  const base = slugify(clinicName) || "consultorio";
  let slug = base;
  for (let i = 2; await prisma.clinic.findUnique({ where: { slug } }); i++) slug = `${base}-${i}`;

  const passwordHash = await hashPassword(password);
  const { user, clinic } = await prisma.$transaction(async (tx) => {
    const clinic = await tx.clinic.create({
      data: {
        name: clinicName,
        slug,
        phone: phone || null,
        trialEndsAt: new Date(Date.now() + 14 * 24 * 3600 * 1000),
        insurances: { create: DEFAULT_INSURANCES.map((n) => ({ name: n })) },
      },
    });
    const user = await tx.user.create({ data: { email, name, passwordHash } });
    await tx.membership.create({ data: { userId: user.id, clinicId: clinic.id, role: "ADMIN" } });
    return { user, clinic };
  });

  await createSession(user.id, clinic.id);
  redirect("/panel/ajustes/profesionales?bienvenida=1");
}
