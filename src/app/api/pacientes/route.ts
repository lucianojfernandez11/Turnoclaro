import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { searchPatients } from "@/lib/patients";
import { prettyPhone } from "@/lib/phone";

// Buscador de pacientes para el formulario de nuevo turno.
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const q = new URL(req.url).searchParams.get("q") ?? "";
  const list = await searchPatients(user.clinic.id, q.slice(0, 80), 12);
  return NextResponse.json(
    list.map((p) => ({
      id: p.id,
      fullName: p.fullName,
      dni: p.dni,
      phone: prettyPhone(p.phone),
      insurance: p.insurance?.name ?? null,
    })),
  );
}
