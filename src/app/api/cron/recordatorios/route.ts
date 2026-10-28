/**
 * Tarea programada: envía los recordatorios de mañana de todos los consultorios.
 * En Vercel la llama el cron de vercel.json (con "Authorization: Bearer CRON_SECRET").
 * En otro hosting, programala con cualquier servicio de cron a las 19 h de Argentina.
 */
import { NextResponse } from "next/server";
import { runAllReminders } from "@/lib/reminders";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const result = await runAllReminders();
  return NextResponse.json({ ok: true, result });
}
