/**
 * Sesiones y permisos.
 * La cookie guarda un token al azar; en la base se guarda solo su hash (SHA-256),
 * así una copia de la base no alcanza para entrar como otro usuario.
 */
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import type { Role } from "@prisma/client";
import { prisma } from "./db";
import { randomToken, sha256 } from "./password";

const COOKIE = "tc_session";
const SESSION_DAYS = 7;

export type CurrentUser = {
  sessionId: string;
  userId: string;
  name: string;
  email: string;
  isSuperadmin: boolean;
  role: Role;
  professionalId: string | null;
  clinic: {
    id: string;
    name: string;
    slug: string;
    timezone: string;
    address: string | null;
    phone: string | null;
    defaultAreaCode: string;
    active: boolean;
    plan: string;
    trialEndsAt: Date | null;
  };
};

export async function createSession(userId: string, clinicId: string): Promise<void> {
  const token = randomToken();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 3600 * 1000);
  await prisma.session.create({ data: { id: sha256(token), userId, clinicId, expiresAt } });
  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) await prisma.session.deleteMany({ where: { id: sha256(token) } });
  jar.delete(COOKIE);
}

/** Usuario de la sesión actual, o null. Se calcula una sola vez por pedido. */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;
  const session = await prisma.session.findUnique({
    where: { id: sha256(token) },
    include: { user: true, clinic: true },
  });
  if (!session || session.expiresAt < new Date()) return null;

  const membership = await prisma.membership.findUnique({
    where: { userId_clinicId: { userId: session.userId, clinicId: session.clinicId } },
  });
  if (!membership && !session.user.isSuperadmin) return null;

  const c = session.clinic;
  return {
    sessionId: session.id,
    userId: session.userId,
    name: session.user.name,
    email: session.user.email,
    isSuperadmin: session.user.isSuperadmin,
    // El superadmin que entra a dar soporte actúa como administrador.
    role: membership?.role ?? "ADMIN",
    professionalId: membership?.professionalId ?? null,
    clinic: {
      id: c.id,
      name: c.name,
      slug: c.slug,
      timezone: c.timezone,
      address: c.address,
      phone: c.phone,
      defaultAreaCode: c.defaultAreaCode,
      active: c.active,
      plan: c.plan,
      trialEndsAt: c.trialEndsAt,
    },
  };
});

/** Exige sesión (y opcionalmente uno de ciertos roles). Si no, redirige. */
export async function requireUser(roles?: Role[]): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.clinic.active && !user.isSuperadmin) redirect("/login?suspendido=1");
  if (roles && !roles.includes(user.role)) redirect("/panel/agenda");
  return user;
}

export function canManageSettings(user: CurrentUser): boolean {
  return user.role === "ADMIN";
}

/** Secretaría y administradores ven la agenda de todos; un profesional, solo la suya. */
export function canSeeAllAgendas(user: CurrentUser): boolean {
  return user.role === "ADMIN" || user.role === "SECRETARIA";
}

/** Filtro de profesionales que el usuario puede ver o tocar. */
export function professionalScope(user: CurrentUser): { clinicId: string; id?: string } {
  if (canSeeAllAgendas(user)) return { clinicId: user.clinic.id };
  return { clinicId: user.clinic.id, id: user.professionalId ?? "__ninguno__" };
}

export const ROLE_LABEL: Record<Role, string> = {
  ADMIN: "Administración",
  SECRETARIA: "Secretaría",
  PROFESIONAL: "Profesional",
};
