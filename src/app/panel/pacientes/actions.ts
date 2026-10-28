"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { type ActionState, bool, str } from "@/lib/forms";
import { cleanPatientInput, findOrCreatePatient } from "@/lib/patients";
import { parseCsv, rowsToPatients } from "@/lib/csv";
import { audit } from "@/lib/audit";

function rawFromForm(fd: FormData) {
  return {
    fullName: str(fd, "fullName"),
    dni: str(fd, "dni"),
    phone: str(fd, "phone"),
    email: str(fd, "email"),
    insuranceId: str(fd, "insuranceId"),
    affiliateNumber: str(fd, "affiliateNumber"),
  };
}

export async function createPatientAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser();
  const cleaned = await cleanPatientInput(user.clinic, rawFromForm(fd));
  if ("error" in cleaned) return { error: cleaned.error };
  if (cleaned.data.dni) {
    const dup = await prisma.patient.findUnique({ where: { clinicId_dni: { clinicId: user.clinic.id, dni: cleaned.data.dni } } });
    if (dup && !dup.deletedAt) return { error: `Ya existe un paciente con ese DNI: ${dup.fullName}.` };
  }
  const p = await findOrCreatePatient(user.clinic.id, cleaned.data);
  redirect(`/panel/pacientes/${p.id}`);
}

export async function updatePatientAction(id: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser();
  const p = await prisma.patient.findFirst({ where: { id, clinicId: user.clinic.id } });
  if (!p) return { error: "No se encontró el paciente." };
  const cleaned = await cleanPatientInput(user.clinic, rawFromForm(fd));
  if ("error" in cleaned) return { error: cleaned.error };
  if (cleaned.data.dni) {
    const dup = await prisma.patient.findFirst({ where: { clinicId: user.clinic.id, dni: cleaned.data.dni, id: { not: id } } });
    if (dup) return { error: `Ese DNI ya lo tiene otro paciente: ${dup.fullName}.` };
  }
  await prisma.patient.update({
    where: { id },
    data: { ...cleaned.data, whatsappOptIn: bool(fd, "whatsappOptIn"), notes: str(fd, "notes") || null },
  });
  await audit({ clinicId: user.clinic.id, userId: user.userId, action: "paciente_editado", entity: "Patient", entityId: id });
  revalidatePath(`/panel/pacientes/${id}`);
  return { ok: "Datos guardados." };
}

export async function deletePatientAction(id: string): Promise<void> {
  const user = await requireUser(["ADMIN", "SECRETARIA"]);
  const p = await prisma.patient.findFirst({ where: { id, clinicId: user.clinic.id } });
  if (!p) return;
  await prisma.$transaction([
    prisma.patient.update({ where: { id }, data: { deletedAt: new Date() } }),
    prisma.appointment.updateMany({
      where: { patientId: id, startsAt: { gt: new Date() }, status: { not: "CANCELADO" } },
      data: { status: "CANCELADO", cancelledAt: new Date() },
    }),
  ]);
  await audit({ clinicId: user.clinic.id, userId: user.userId, action: "paciente_borrado", entity: "Patient", entityId: id });
  revalidatePath("/panel", "layout");
  redirect("/panel/pacientes");
}

/** Importa pacientes desde un CSV (Excel → Guardar como → CSV). */
export async function importPatientsAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser(["ADMIN", "SECRETARIA"]);
  const file = fd.get("file");
  let text = str(fd, "text");
  if (file && typeof file !== "string" && file.size > 0) {
    if (file.size > 3 * 1024 * 1024) return { error: "El archivo es muy grande (máximo 3 MB)." };
    text = await file.text();
  }
  if (!text) return { error: "Elegí un archivo CSV o pegá el contenido." };
  const { patients, missing } = rowsToPatients(parseCsv(text));
  if (missing.length) return { error: `No encontré las columnas: ${missing.join(", ")}. La primera fila tiene que tener los títulos.` };
  if (patients.length > 5000) return { error: "Máximo 5000 pacientes por importación." };

  const insurances = await prisma.insurance.findMany({ where: { clinicId: user.clinic.id } });
  const byName = new Map<string, string>(insurances.map((i) => [i.name.toLowerCase(), i.id]));
  let created = 0;
  let updated = 0;
  const errors: string[] = [];
  for (const [i, row] of patients.entries()) {
    let insuranceId = "";
    if (row.insurance) {
      const key = row.insurance.toLowerCase();
      if (!byName.has(key)) {
        const ins = await prisma.insurance.create({ data: { clinicId: user.clinic.id, name: row.insurance } });
        byName.set(key, ins.id);
      }
      insuranceId = byName.get(key)!;
    }
    const cleaned = await cleanPatientInput(user.clinic, { ...row, insuranceId });
    if ("error" in cleaned) {
      if (errors.length < 15) errors.push(`Fila ${i + 2} (${row.fullName || "sin nombre"}): ${cleaned.error}`);
      continue;
    }
    const before = cleaned.data.dni
      ? await prisma.patient.findUnique({ where: { clinicId_dni: { clinicId: user.clinic.id, dni: cleaned.data.dni } } })
      : null;
    await findOrCreatePatient(user.clinic.id, cleaned.data);
    if (before) updated++;
    else created++;
  }
  revalidatePath("/panel/pacientes");
  const summary = `Importación terminada: ${created} nuevos, ${updated} actualizados, ${patients.length - created - updated} con errores.`;
  return errors.length ? { error: `${summary}\n${errors.join("\n")}` } : { ok: summary };
}
