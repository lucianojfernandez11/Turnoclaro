/** Alta y búsqueda de pacientes, compartida por el panel y la reserva online. */
import type { Patient } from "@prisma/client";
import { prisma } from "./db";
import { normalizeArPhone } from "./phone";

export type PatientInput = {
  fullName: string;
  dni: string | null;
  phone: string;
  email: string | null;
  insuranceId: string | null;
  affiliateNumber: string | null;
};

export const PHONE_ERROR = "Revisá el teléfono: tiene que ser un celular con característica (por ejemplo 381 555-1234).";

/** Valida y limpia los datos. Devuelve el error o los datos listos para guardar. */
export async function cleanPatientInput(
  clinic: { id: string; defaultAreaCode: string },
  raw: { fullName: string; dni: string; phone: string; email: string; insuranceId: string; affiliateNumber: string },
): Promise<{ error: string } | { data: PatientInput }> {
  const fullName = raw.fullName.replace(/\s+/g, " ").trim();
  if (fullName.length < 3) return { error: "Escribí el nombre y apellido del paciente." };
  const dni = raw.dni.replace(/\D/g, "");
  if (dni && (dni.length < 6 || dni.length > 9)) return { error: "El DNI no parece válido." };
  const phone = normalizeArPhone(raw.phone, clinic.defaultAreaCode);
  if (!phone) return { error: PHONE_ERROR };
  const email = raw.email.trim().toLowerCase();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "El email no es válido." };
  let insuranceId: string | null = raw.insuranceId || null;
  if (insuranceId) {
    const ok = await prisma.insurance.findFirst({ where: { id: insuranceId, clinicId: clinic.id } });
    if (!ok) insuranceId = null;
  }
  return {
    data: {
      fullName,
      dni: dni || null,
      phone,
      email: email || null,
      insuranceId,
      affiliateNumber: raw.affiliateNumber.trim() || null,
    },
  };
}

/**
 * Busca al paciente por DNI (o, sin DNI, por teléfono y nombre) dentro del consultorio;
 * si no existe lo crea. Si existía, completa los datos que le faltaban.
 */
export async function findOrCreatePatient(clinicId: string, data: PatientInput): Promise<Patient> {
  let existing: Patient | null = null;
  if (data.dni) {
    existing = await prisma.patient.findUnique({ where: { clinicId_dni: { clinicId, dni: data.dni } } });
  } else {
    existing = await prisma.patient.findFirst({
      where: { clinicId, phone: data.phone, fullName: { equals: data.fullName, mode: "insensitive" }, deletedAt: null },
    });
  }
  if (existing) {
    return prisma.patient.update({
      where: { id: existing.id },
      data: {
        deletedAt: null,
        phone: data.phone,
        email: existing.email ?? data.email,
        insuranceId: data.insuranceId ?? existing.insuranceId,
        affiliateNumber: data.affiliateNumber ?? existing.affiliateNumber,
      },
    });
  }
  return prisma.patient.create({ data: { ...data, clinicId } });
}

export async function searchPatients(clinicId: string, q: string, take = 10) {
  const text = q.trim();
  const digits = text.replace(/\D/g, "");
  if (!text) {
    return prisma.patient.findMany({ where: { clinicId, deletedAt: null }, orderBy: { createdAt: "desc" }, take, include: { insurance: true } });
  }
  return prisma.patient.findMany({
    where: {
      clinicId,
      deletedAt: null,
      OR: [
        { fullName: { contains: text, mode: "insensitive" } },
        ...(digits.length >= 3 ? [{ dni: { startsWith: digits } }, { phone: { contains: digits } }] : []),
      ],
    },
    orderBy: { fullName: "asc" },
    take,
    include: { insurance: true },
  });
}
