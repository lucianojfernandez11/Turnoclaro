/**
 * Datos del consultorio de demostración. Solo arma objetos (no toca la base),
 * así se puede probar por separado. Los usa prisma/seed.mjs.
 */
import { randomBytes } from "node:crypto";

const id = () => "d" + randomBytes(12).toString("hex");
const token = () => randomBytes(18).toString("base64url");
const pad = (n) => String(n).padStart(2, "0");

/** Argentina no tiene horario de verano: UTC-3 fijo. */
const at = (ymd, minutes) => new Date(`${ymd}T${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}:00-03:00`);

function addDays(ymd, n) {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}
function weekday(ymd) {
  const [y, m, d] = ymd.split("-").map(Number);
  const js = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return js === 0 ? 7 : js;
}

// Generador pseudoaleatorio con semilla: la demo sale siempre parecida.
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const FIRST = ["María", "Juan", "Lucía", "Martín", "Sofía", "Diego", "Valentina", "Facundo", "Camila", "Nicolás", "Agustina", "Matías", "Florencia", "Gonzalo", "Julieta", "Santiago", "Micaela", "Ramiro", "Carolina", "Pablo"];
const LAST = ["Gómez", "Rodríguez", "Fernández", "López", "Díaz", "Martínez", "Pérez", "García", "Sánchez", "Romero", "Sosa", "Álvarez", "Torres", "Ruiz", "Ramírez", "Flores", "Acosta", "Medina", "Herrera", "Aguirre"];

export const DEMO_INSURANCES = ["Particular", "Subsidio de Salud", "PAMI", "OSDE", "Swiss Medical", "Galeno", "OSPE", "Otra"];

/**
 * @param {{ today: string, adminHash: string, secretaryHash: string }} opts  today = fecha local "YYYY-MM-DD"
 */
export function buildDemo({ today, adminHash, secretaryHash }) {
  const rand = rng(20261022);
  const pick = (arr) => arr[Math.floor(rand() * arr.length)];
  const clinicId = id();
  const clinic = {
    id: clinicId,
    name: "Consultorios Del Parque",
    slug: "demo",
    address: "Av. Mate de Luna 1800, San Miguel de Tucumán",
    phone: "381 400-1234",
    defaultAreaCode: "381",
    timezone: "America/Argentina/Tucuman",
    plan: "CONSULTORIO",
  };

  const insurances = DEMO_INSURANCES.map((name) => ({ id: id(), clinicId, name }));

  const pros = [
    { id: id(), clinicId, name: "Dra. Valeria Romero", specialty: "Clínica médica", color: "#2f7d6d", slotMinutes: 20,
      shifts: { days: [1, 2, 3, 4, 5], ranges: [[510, 750], [960, 1140]] } },
    { id: id(), clinicId, name: "Dr. Martín Ibáñez", specialty: "Cardiología", color: "#c2553f", slotMinutes: 30,
      shifts: { days: [1, 3, 5], ranges: [[540, 780]] } },
    { id: id(), clinicId, name: "Lic. Carolina Paz", specialty: "Nutrición", color: "#6a5fb0", slotMinutes: 30,
      shifts: { days: [2, 4, 6], ranges: [[600, 840], [1020, 1200]] } },
  ];
  const schedules = pros.flatMap((p) =>
    p.shifts.days.flatMap((weekdayN) =>
      p.shifts.ranges.map(([s, e]) => ({ id: id(), clinicId, professionalId: p.id, weekday: weekdayN, startMinute: s, endMinute: e })),
    ),
  );

  const users = [
    { id: id(), email: "demo@turnoclaro.com", name: "Administración Demo", passwordHash: adminHash },
    { id: id(), email: "secretaria@turnoclaro.com", name: "Secretaría Demo", passwordHash: secretaryHash },
  ];
  const memberships = [
    { id: id(), userId: users[0].id, clinicId, role: "ADMIN" },
    { id: id(), userId: users[1].id, clinicId, role: "SECRETARIA" },
  ];

  const patients = [];
  const usedDni = new Set();
  for (let i = 0; i < 70; i++) {
    let dni;
    do dni = String(20000000 + Math.floor(rand() * 25000000));
    while (usedDni.has(dni));
    usedDni.add(dni);
    const ins = pick(insurances);
    patients.push({
      id: id(),
      clinicId,
      fullName: `${pick(FIRST)} ${pick(LAST)}`,
      dni,
      phone: `549381${4000000 + Math.floor(rand() * 5999999)}`,
      insuranceId: ins.id,
      affiliateNumber: ins.name === "Particular" ? null : String(100000 + Math.floor(rand() * 899999)),
    });
  }

  // Turnos: dos semanas para atrás (atendidos/ausentes) y diez días para adelante.
  const appointments = [];
  const nowMs = Date.now();
  for (let offset = -14; offset <= 10; offset++) {
    const ymd = addDays(today, offset);
    const wd = weekday(ymd);
    for (const p of pros) {
      const ranges = schedules.filter((s) => s.professionalId === p.id && s.weekday === wd);
      for (const r of ranges) {
        for (let m = r.startMinute; m + p.slotMinutes <= r.endMinute; m += p.slotMinutes) {
          const occupancy = offset < 0 ? 0.7 : offset <= 2 ? 0.6 : 0.35;
          if (rand() > occupancy) continue;
          const startsAt = at(ymd, m);
          const endsAt = new Date(startsAt.getTime() + p.slotMinutes * 60000);
          let status;
          if (startsAt.getTime() < nowMs) status = rand() < 0.12 ? "AUSENTE" : "ATENDIDO";
          else {
            const x = rand();
            status = x < 0.45 ? "CONFIRMADO" : x < 0.9 ? "PENDIENTE" : "SOLICITADO";
          }
          appointments.push({
            id: id(),
            clinicId,
            professionalId: p.id,
            patientId: pick(patients).id,
            startsAt,
            endsAt,
            status,
            source: status === "SOLICITADO" || rand() < 0.2 ? "ONLINE" : "PANEL",
            publicToken: token(),
          });
        }
      }
    }
  }

  // Un bloqueo de ejemplo: el cardiólogo en un congreso el viernes de la semana que viene.
  let friday = addDays(today, 1);
  while (weekday(friday) !== 5) friday = addDays(friday, 1);
  friday = addDays(friday, 7);
  const cardio = pros[1];
  const blocks = [{ id: id(), clinicId, professionalId: cardio.id, startsAt: at(friday, 0), endsAt: at(addDays(friday, 1), 0), reason: "Congreso de cardiología" }];
  // Sin turnos dentro del bloqueo.
  const free = appointments.filter((a) => !(a.professionalId === cardio.id && a.startsAt >= blocks[0].startsAt && a.startsAt < blocks[0].endsAt));

  return {
    clinic,
    insurances,
    professionals: pros.map(({ shifts, ...p }) => p),
    schedules,
    users,
    memberships,
    patients,
    appointments: free,
    blocks,
  };
}
