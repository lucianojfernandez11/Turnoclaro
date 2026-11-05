/**
 * Demo pública: cualquiera entra a /demo y recorre el consultorio de demostración
 * ("Consultorios Del Parque") como si fuera la administración, sin poder guardar cambios.
 * Los datos se regeneran todos los días (cron /api/cron/demo) para que haya turnos alrededor de hoy.
 */
import type { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { hashPassword } from "./password";
import { todayYmd } from "./tz";
// Los mismos datos que carga "npm run db:seed".
import { buildDemo } from "../../prisma/seed-data.mjs";

export const DEMO_SLUG = "demo";
export const DEMO_EMAIL = "demo@turnoclaro.com";

/** Borra y vuelve a crear el consultorio demo con turnos alrededor de hoy. */
export async function refreshDemo(): Promise<{ appointments: number; patients: number }> {
  const demo = buildDemo({
    today: todayYmd("America/Argentina/Tucuman"),
    adminHash: await hashPassword("demo1234"),
    secretaryHash: await hashPassword("demo1234"),
  });
  const old = await prisma.clinic.findUnique({ where: { slug: demo.clinic.slug } });
  if (old) await prisma.clinic.delete({ where: { id: old.id } }); // borra en cascada sus datos
  await prisma.user.deleteMany({ where: { email: { in: demo.users.map((u: { email: string }) => u.email) } } });

  await prisma.clinic.create({ data: demo.clinic });
  await prisma.insurance.createMany({ data: demo.insurances });
  await prisma.professional.createMany({ data: demo.professionals });
  await prisma.schedule.createMany({ data: demo.schedules });
  await prisma.user.createMany({ data: demo.users });
  await prisma.membership.createMany({ data: demo.memberships as Prisma.MembershipCreateManyInput[] });
  await prisma.patient.createMany({ data: demo.patients });
  await prisma.appointment.createMany({ data: demo.appointments as Prisma.AppointmentCreateManyInput[] });
  await prisma.block.createMany({ data: demo.blocks });
  return { appointments: demo.appointments.length, patients: demo.patients.length };
}

/** Usuario y consultorio con los que entra el visitante. Si la demo no existe, la crea. */
export async function demoLogin(): Promise<{ userId: string; clinicId: string }> {
  const find = () =>
    prisma.membership.findFirst({
      where: { user: { email: DEMO_EMAIL }, clinic: { slug: DEMO_SLUG, active: true } },
      select: { userId: true, clinicId: true },
    });
  let m = await find();
  if (!m) {
    await refreshDemo();
    m = await find();
  }
  if (!m) throw new Error("No se pudo preparar la demo.");
  // Limpieza: sesiones de demo vencidas.
  await prisma.session.deleteMany({ where: { isDemo: true, expiresAt: { lt: new Date() } } });
  return m;
}
