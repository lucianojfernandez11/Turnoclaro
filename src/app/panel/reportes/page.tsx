import Link from "next/link";
import type { Metadata } from "next";
import type { AppointmentStatus } from "@prisma/client";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { param } from "@/lib/forms";
import { pad2, todayYmd, zonedToUtc } from "@/lib/tz";
import { PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Reportes" };

const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

function shift(ym: string, delta: number): string {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}`;
}

function pct(a: number, b: number): string {
  return b === 0 ? "—" : `${Math.round((a / b) * 100)}%`;
}

export default async function ReportesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireUser(["ADMIN", "SECRETARIA"]);
  const sp = await searchParams;
  const tz = user.clinic.timezone;
  const current = todayYmd(tz).slice(0, 7);
  const mesParam = param(sp.mes);
  const ym = mesParam && /^\d{4}-\d{2}$/.test(mesParam) ? mesParam : current;
  const from = zonedToUtc(`${ym}-01`, 0, tz);
  const to = zonedToUtc(`${shift(ym, 1)}-01`, 0, tz);

  const [byStatus, byPro, pros, online, waConfirm, waCancel] = await Promise.all([
    prisma.appointment.groupBy({
      by: ["status"],
      where: { clinicId: user.clinic.id, startsAt: { gte: from, lt: to } },
      _count: { _all: true },
    }),
    prisma.appointment.groupBy({
      by: ["professionalId", "status"],
      where: { clinicId: user.clinic.id, startsAt: { gte: from, lt: to } },
      _count: { _all: true },
    }),
    prisma.professional.findMany({ where: { clinicId: user.clinic.id }, orderBy: { name: "asc" } }),
    prisma.appointment.count({ where: { clinicId: user.clinic.id, source: "ONLINE", startsAt: { gte: from, lt: to } } }),
    prisma.message.count({ where: { clinicId: user.clinic.id, reply: "CONFIRMA", appointment: { startsAt: { gte: from, lt: to } } } }),
    prisma.message.count({ where: { clinicId: user.clinic.id, reply: "CANCELA", appointment: { startsAt: { gte: from, lt: to } } } }),
  ]);

  const count = (s: AppointmentStatus) => byStatus.find((r) => r.status === s)?._count._all ?? 0;
  const total = byStatus.reduce((n, r) => n + (r.status === "CANCELADO" ? 0 : r._count._all), 0);
  const attended = count("ATENDIDO");
  const absent = count("AUSENTE");
  const [y, m] = ym.split("-").map(Number);

  return (
    <div className="stack">
      <PageHeader
        title="Reportes"
        subtitle={`${MONTHS[m - 1]} de ${y}`}
        actions={
          <div className="row">
            <Link className="btn btn-sm" href={`/panel/reportes?mes=${shift(ym, -1)}`}>← Mes anterior</Link>
            {ym !== current ? <Link className="btn btn-sm" href="/panel/reportes">Este mes</Link> : null}
            <Link className="btn btn-sm" href={`/panel/reportes?mes=${shift(ym, 1)}`}>Mes siguiente →</Link>
          </div>
        }
      />
      <div className="stats">
        <div className="stat"><b>{total}</b><span>Turnos dados (sin cancelados)</span></div>
        <div className="stat"><b>{pct(absent, attended + absent)}</b><span>Ausentismo ({absent} de {attended + absent})</span></div>
        <div className="stat"><b>{count("CANCELADO")}</b><span>Cancelados (horarios liberados)</span></div>
        <div className="stat"><b>{online}</b><span>Reservados online</span></div>
      </div>
      <div className="stats">
        <div className="stat"><b>{waConfirm}</b><span>Confirmaron por WhatsApp</span></div>
        <div className="stat"><b>{waCancel}</b><span>Avisaron que no van</span></div>
        <div className="stat"><b>{count("PENDIENTE") + count("CONFIRMADO")}</b><span>Sin cerrar (falta marcar atendido o ausente)</span></div>
        <div className="stat"><b>{attended}</b><span>Atendidos</span></div>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Profesional</th>
              <th>Turnos</th>
              <th>Atendidos</th>
              <th>Ausentes</th>
              <th>Ausentismo</th>
              <th>Cancelados</th>
            </tr>
          </thead>
          <tbody>
            {pros.map((p) => {
              const c = (s: AppointmentStatus) => byPro.find((r) => r.professionalId === p.id && r.status === s)?._count._all ?? 0;
              const t = byPro.filter((r) => r.professionalId === p.id && r.status !== "CANCELADO").reduce((n, r) => n + r._count._all, 0);
              if (t === 0 && c("CANCELADO") === 0) return null;
              return (
                <tr key={p.id}>
                  <td>{p.name}</td>
                  <td>{t}</td>
                  <td>{c("ATENDIDO")}</td>
                  <td>{c("AUSENTE")}</td>
                  <td>{pct(c("AUSENTE"), c("ATENDIDO") + c("AUSENTE"))}</td>
                  <td>{c("CANCELADO")}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="muted small">
        El ausentismo se calcula sobre los turnos que ya se marcaron como atendidos o ausentes. Para que el número sea real,
        al final del día marcá cada turno.
      </p>
    </div>
  );
}
