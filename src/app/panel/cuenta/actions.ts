"use server";

import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { type ActionState, str } from "@/lib/forms";
import { hashPassword, passwordProblem, verifyPassword } from "@/lib/password";

export async function changePasswordAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser();
  const current = str(fd, "current");
  const next = str(fd, "next");
  const problem = passwordProblem(next);
  if (problem) return { error: problem };
  const u = await prisma.user.findUniqueOrThrow({ where: { id: user.userId } });
  if (!(await verifyPassword(current, u.passwordHash))) return { error: "La contraseña actual no es correcta." };
  await prisma.user.update({ where: { id: u.id }, data: { passwordHash: await hashPassword(next) } });
  // Cierra las otras sesiones abiertas.
  await prisma.session.deleteMany({ where: { userId: u.id, id: { not: user.sessionId } } });
  return { ok: "Contraseña cambiada." };
}
