"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser, createSession, destroySession } from "@/lib/auth";
import { type ActionState, str } from "@/lib/forms";
import { audit } from "@/lib/audit";

async function superadmin() {
  const user = await getCurrentUser();
  if (!user?.isSuperadmin) redirect("/login");
  return user;
}

/** Entrar a un consultorio como soporte (abre una sesión nueva en ese consultorio). */
export async function enterClinicAction(clinicId: string): Promise<void> {
  const user = await superadmin();
  const clinic = await prisma.clinic.findUnique({ where: { id: clinicId } });
  if (!clinic) return;
  await destroySession();
  await createSession(user.userId, clinic.id);
  redirect("/panel/agenda");
}

export async function updateClinicPlanAction(clinicId: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  await superadmin();
  const plan = str(fd, "plan");
  if (!["PRUEBA", "PROFESIONAL", "CONSULTORIO", "CLINICA"].includes(plan)) return { error: "Plan inválido." };
  const days = Number(str(fd, "trialDays"));
  await prisma.clinic.update({
    where: { id: clinicId },
    data: {
      plan,
      active: str(fd, "active") === "on",
      ...(plan === "PRUEBA" && days > 0 ? { trialEndsAt: new Date(Date.now() + days * 24 * 3600 * 1000) } : {}),
    },
  });
  revalidatePath("/plataforma");
  return { ok: "Guardado." };
}

/** Carga (o descuenta, con número negativo) recordatorios del pack de un consultorio. */
export async function addCreditsAction(clinicId: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await superadmin();
  const amount = Math.trunc(Number(str(fd, "amount")));
  if (!Number.isFinite(amount) || amount === 0 || Math.abs(amount) > 100000) return { error: "Escribí una cantidad (ej.: 500)." };
  const clinic = await prisma.clinic.findUnique({ where: { id: clinicId }, select: { reminderCredits: true } });
  if (!clinic) return { error: "Consultorio inexistente." };
  if (clinic.reminderCredits + amount < 0) return { error: `No puede quedar negativo (tiene ${clinic.reminderCredits}).` };
  const updated = await prisma.clinic.update({
    where: { id: clinicId },
    data: { reminderCredits: { increment: amount }, ...(amount > 0 ? { waMode: "PACK" } : {}) },
  });
  await audit({ clinicId, userId: user.userId, action: "carga_recordatorios", entity: "Clinic", entityId: clinicId, detail: { amount, saldo: updated.reminderCredits } });
  revalidatePath("/plataforma");
  return { ok: `Listo. Saldo: ${updated.reminderCredits.toLocaleString("es-AR")}.` };
}
