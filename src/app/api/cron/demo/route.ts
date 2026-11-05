/**
 * Tarea programada: regenera la demo pública todos los días (turnos alrededor de hoy).
 * En Vercel la llama el cron de vercel.json (con "Authorization: Bearer CRON_SECRET").
 */
import { NextResponse } from "next/server";
import { refreshDemo } from "@/lib/demo";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const result = await refreshDemo();
  return NextResponse.json({ ok: true, result });
}
