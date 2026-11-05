/**
 * /demo: entra directo al panel del consultorio de demostración, en modo solo lectura.
 * Sirve como link para compartir (GET) y desde el botón "Ver la demo" de la portada (POST).
 */
import { NextResponse } from "next/server";
import { createSession } from "@/lib/auth";
import { demoLogin } from "@/lib/demo";

export const dynamic = "force-dynamic";

async function enter(req: Request) {
  const { userId, clinicId } = await demoLogin();
  await createSession(userId, clinicId, { demo: true });
  return NextResponse.redirect(new URL("/panel/agenda", req.url), 303);
}

export const GET = enter;
export const POST = enter;
