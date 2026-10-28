"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { type ActionState, str } from "@/lib/forms";
import { publicClinic, freeSlotsWindow } from "@/lib/booking";
import { cleanPatientInput, findOrCreatePatient } from "@/lib/patients";
import { createAppointment } from "@/lib/appointments";
import { hhmmToMinutes, isYmd } from "@/lib/tz";

export async function bookAction(slug: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  // Campo trampa: los humanos no lo ven; los robots lo completan.
  if (str(fd, "website")) return { error: "No se pudo enviar la reserva." };

  const clinic = await publicClinic(slug);
  if (!clinic || !clinic.active || !clinic.bookingEnabled) return { error: "Este consultorio no toma reservas online." };
  const pro = clinic.professionals.find((p) => p.id === str(fd, "p"));
  const ymd = str(fd, "d");
  const minutes = hhmmToMinutes(str(fd, "t"));
  if (!pro || !isYmd(ymd) || minutes === null) return { error: "Elegí profesional, día y horario." };

  // El horario tiene que seguir libre (pudo haberlo tomado otra persona mientras completabas).
  const avail = await freeSlotsWindow({
    clinicId: clinic.id, timeZone: clinic.timezone, professional: pro, daysAhead: clinic.bookingDaysAhead,
  });
  const slot = avail.find((d) => d.ymd === ymd)?.slots.find((s) => s.minutes === minutes);
  if (!slot) return { error: "Ese horario ya no está disponible. Volvé atrás y elegí otro." };

  const cleaned = await cleanPatientInput(clinic, {
    fullName: str(fd, "fullName"),
    dni: str(fd, "dni"),
    phone: str(fd, "phone"),
    email: str(fd, "email"),
    insuranceId: str(fd, "insuranceId"),
    affiliateNumber: str(fd, "affiliateNumber"),
  });
  if ("error" in cleaned) return { error: cleaned.error };
  if (!cleaned.data.dni) return { error: "Completá tu DNI." };
  if (!fd.get("acepto")) return { error: "Tenés que aceptar el uso de tus datos para gestionar el turno." };

  // Límite anti-abuso: hasta 3 reservas futuras pendientes por teléfono.
  const open = await prisma.appointment.count({
    where: {
      clinicId: clinic.id,
      source: "ONLINE",
      status: { in: ["SOLICITADO", "PENDIENTE", "CONFIRMADO"] },
      startsAt: { gt: new Date() },
      patient: { phone: cleaned.data.phone },
    },
  });
  if (open >= 3) return { error: "Ya tenés varias reservas pendientes. Para pedir otra, comunicate con el consultorio." };

  const patient = await findOrCreatePatient(clinic.id, cleaned.data);
  const res = await createAppointment({
    clinicId: clinic.id,
    professionalId: pro.id,
    patientId: patient.id,
    startsAt: slot.startsAt,
    endsAt: slot.endsAt,
    status: clinic.bookingAutoConfirm ? "CONFIRMADO" : "SOLICITADO",
    source: "ONLINE",
  });
  if (!res.ok) return { error: "Ese horario ya no está disponible. Volvé atrás y elegí otro." };
  redirect(`/c/${res.publicToken}?nuevo=1`);
}
