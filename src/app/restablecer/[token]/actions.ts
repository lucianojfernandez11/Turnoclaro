"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { type ActionState, str } from "@/lib/forms";
import { hashPassword, passwordProblem, sha256 } from "@/lib/password";

export async function resetPasswordAction(token: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const password = str(fd, "password");
  const repeat = str(fd, "repeat");
  const problem = passwordProblem(password);
  if (problem) return { error: problem };
  if (password !== repeat) return { error: "Las dos contraseñas no coinciden." };

  const id = sha256(token);
  const reset = await prisma.passwordReset.findUnique({ where: { id } });
  if (!reset || reset.usedAt || reset.expiresAt < new Date()) {
    return { error: "El link venció o ya se usó. Pedí uno nuevo desde “¿Olvidaste tu contraseña?”." };
  }

  const passwordHash = await hashPassword(password);
  await prisma.$transaction([
    // Se marca usado solo si nadie lo usó antes (dos clics a la vez no lo usan dos veces).
    prisma.passwordReset.updateMany({ where: { id, usedAt: null }, data: { usedAt: new Date() } }),
    prisma.user.update({ where: { id: reset.userId }, data: { passwordHash, failedLogins: 0, lockedUntil: null } }),
    // Cierra la sesión en todos los dispositivos y anula los otros links pendientes.
    prisma.session.deleteMany({ where: { userId: reset.userId } }),
    prisma.passwordReset.updateMany({ where: { userId: reset.userId, usedAt: null }, data: { usedAt: new Date() } }),
  ]);
  redirect("/login?restablecida=1");
}
