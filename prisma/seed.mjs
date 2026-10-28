/**
 * Carga inicial:
 *  1. Tu usuario superadmin (SUPERADMIN_EMAIL / SUPERADMIN_PASSWORD del .env).
 *  2. El consultorio de demostración "Consultorios Del Parque" (link /r/demo),
 *     con turnos de ejemplo alrededor de la fecha de hoy. Si ya existe, lo recrea.
 *
 * Uso: npm run db:seed
 */
import { PrismaClient } from "@prisma/client";
import { randomBytes, scrypt } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import { buildDemo } from "./seed-data.mjs";

// Lee el .env sin dependencias (Prisma lo hace solo para DATABASE_URL).
if (existsSync(".env")) {
  for (const line of readFileSync(".env", "utf8").split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*"?(.*?)"?\s*$/.exec(line);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
  }
}

const prisma = new PrismaClient();

function hashPassword(password) {
  const salt = randomBytes(16);
  return new Promise((resolve, reject) =>
    scrypt(password, salt, 64, { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }, (err, key) =>
      err ? reject(err) : resolve(`scrypt$16384$8$1$${salt.toString("base64")}$${key.toString("base64")}`),
    ),
  );
}

function todayInArgentina() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Tucuman" }).format(new Date());
}

async function main() {
  const email = process.env.SUPERADMIN_EMAIL?.toLowerCase();
  const password = process.env.SUPERADMIN_PASSWORD;
  if (email && password) {
    if (password.length < 8) throw new Error("SUPERADMIN_PASSWORD tiene que tener al menos 8 caracteres.");
    await prisma.user.upsert({
      where: { email },
      update: { isSuperadmin: true, passwordHash: await hashPassword(password) },
      create: { email, name: "Superadmin", isSuperadmin: true, passwordHash: await hashPassword(password) },
    });
    console.log(`✓ Superadmin: ${email}`);
  } else {
    console.log("· Sin SUPERADMIN_EMAIL/SUPERADMIN_PASSWORD en .env: no se crea el superadmin.");
  }

  const demo = buildDemo({
    today: todayInArgentina(),
    adminHash: await hashPassword("demo1234"),
    secretaryHash: await hashPassword("demo1234"),
  });

  const old = await prisma.clinic.findUnique({ where: { slug: demo.clinic.slug } });
  if (old) {
    await prisma.clinic.delete({ where: { id: old.id } }); // borra en cascada sus datos
  }
  await prisma.user.deleteMany({ where: { email: { in: demo.users.map((u) => u.email) } } });

  await prisma.clinic.create({ data: demo.clinic });
  await prisma.insurance.createMany({ data: demo.insurances });
  await prisma.professional.createMany({ data: demo.professionals });
  await prisma.schedule.createMany({ data: demo.schedules });
  await prisma.user.createMany({ data: demo.users });
  await prisma.membership.createMany({ data: demo.memberships });
  await prisma.patient.createMany({ data: demo.patients });
  await prisma.appointment.createMany({ data: demo.appointments });
  await prisma.block.createMany({ data: demo.blocks });

  console.log(`✓ Consultorio demo: ${demo.appointments.length} turnos, ${demo.patients.length} pacientes`);
  console.log("  Ingreso: demo@turnoclaro.com / demo1234 (administración)");
  console.log("           secretaria@turnoclaro.com / demo1234 (secretaría)");
  console.log("  Reservas online: /r/demo");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
