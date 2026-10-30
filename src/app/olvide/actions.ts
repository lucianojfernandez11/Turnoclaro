"use server";

import { prisma } from "@/lib/db";
import { type ActionState, isEmail, str } from "@/lib/forms";
import { randomToken, sha256 } from "@/lib/password";
import { appUrl } from "@/lib/reminders";
import { emailLayout, isEmailConfigured, sendEmail } from "@/lib/email";
import { firstName } from "@/lib/template";

const VALID_MINUTES = 60;
const MAX_PER_HOUR = 3;

export async function requestResetAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const email = str(fd, "email").toLowerCase();
  if (!isEmail(email)) return { error: "Escribí un email válido." };
  // Mismo mensaje exista o no la cuenta, para no revelar qué emails están registrados.
  const done: ActionState = { ok: "Si hay una cuenta con ese email, en unos minutos te llega un link para elegir una contraseña nueva. Revisá también spam." };

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return done;

  const recent = await prisma.passwordReset.count({
    where: { userId: user.id, createdAt: { gt: new Date(Date.now() - 3600_000) } },
  });
  if (recent >= MAX_PER_HOUR) return done;

  const token = randomToken();
  await prisma.passwordReset.create({
    data: { id: sha256(token), userId: user.id, expiresAt: new Date(Date.now() + VALID_MINUTES * 60_000) },
  });
  const url = `${appUrl()}/restablecer/${token}`;
  const result = await sendEmail({
    to: user.email,
    subject: "Elegí una contraseña nueva",
    text: `Hola ${firstName(user.name)}: pediste cambiar tu contraseña de TurnoClaro. Entrá a este link (vence en 1 hora): ${url}\nSi no fuiste vos, ignorá este email: tu contraseña sigue igual.`,
    html: emailLayout({
      title: `Hola ${firstName(user.name)}, elegí una contraseña nueva`,
      paragraphs: ["Pediste cambiar la contraseña de tu cuenta. Tocá el botón para elegir una nueva. El link vence en 1 hora y sirve una sola vez."],
      button: { label: "Elegir contraseña nueva", url },
      footnote: "Si no fuiste vos, ignorá este email: tu contraseña sigue igual.",
    }),
  });

  // En la compu, sin email configurado, mostramos el link para poder probar.
  if (!result.sent && !isEmailConfigured() && process.env.NODE_ENV !== "production") {
    return { ok: `Modo prueba (todavía no configuraste el envío de emails). Abrí este link: ${url}` };
  }
  return done;
}
