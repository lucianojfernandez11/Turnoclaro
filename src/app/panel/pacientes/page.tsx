import Link from "next/link";
import type { Metadata } from "next";
import type { Prisma } from "@prisma/client";
import { requireUser, canSeeAllAgendas } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { param } from "@/lib/forms";
import { prettyPhone } from "@/lib/phone";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Avatar, Empty, Field, PageHeader } from "@/components/ui";
import { createPatientAction, importPatientsAction } from "./actions";

export const metadata: Metadata = { title: "Pacientes" };

const PAGE = 50;

export default async function PacientesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const q = (param(sp.q) ?? "").trim();
  const page = Math.max(1, Number(param(sp.p)) || 1);
  const digits = q.replace(/\D/g, "");
  const where: Prisma.PatientWhereInput = { clinicId: user.clinic.id, deletedAt: null };
  if (q) {
    where.OR = [
      { fullName: { contains: q, mode: "insensitive" } },
      ...(digits.length >= 3 ? [{ dni: { startsWith: digits } }, { phone: { contains: digits } }] : []),
    ];
  }
  const [total, list, insurances] = await Promise.all([
    prisma.patient.count({ where }),
    prisma.patient.findMany({
      where,
      include: { insurance: true, _count: { select: { appointments: true } } },
      orderBy: { fullName: "asc" },
      skip: (page - 1) * PAGE,
      take: PAGE,
    }),
    prisma.insurance.findMany({ where: { clinicId: user.clinic.id, active: true }, orderBy: { name: "asc" } }),
  ]);
  const pages = Math.max(1, Math.ceil(total / PAGE));

  return (
    <div className="stack">
      <PageHeader title="Pacientes" subtitle={`${total} ${total === 1 ? "paciente" : "pacientes"}${q ? " encontrados" : ""}`} />
      <form className="row" action="/panel/pacientes">
        <input name="q" type="search" defaultValue={q} placeholder="Buscar por nombre, DNI o teléfono" style={{ flex: 1, minWidth: 220 }} />
        <button className="btn" type="submit">Buscar</button>
      </form>

      {list.length === 0 ? (
        <div className="card"><Empty>{q ? "No hay pacientes que coincidan." : "Todavía no hay pacientes."}</Empty></div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Paciente</th>
                <th>DNI</th>
                <th>Celular</th>
                <th>Obra social</th>
                <th>Turnos</th>
              </tr>
            </thead>
            <tbody>
              {list.map((p) => (
                <tr key={p.id}>
                  <td><Link className="person" href={`/panel/pacientes/${p.id}`}><Avatar name={p.fullName} />{p.fullName}</Link></td>
                  <td>{p.dni ?? "—"}</td>
                  <td className="mono small">{prettyPhone(p.phone)}</td>
                  <td>{p.insurance?.name ?? "—"}</td>
                  <td>{p._count.appointments}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {pages > 1 ? (
        <div className="row">
          {page > 1 ? <Link className="btn btn-sm" href={`/panel/pacientes?q=${encodeURIComponent(q)}&p=${page - 1}`}>← Anterior</Link> : null}
          <span className="muted small">Página {page} de {pages}</span>
          {page < pages ? <Link className="btn btn-sm" href={`/panel/pacientes?q=${encodeURIComponent(q)}&p=${page + 1}`}>Siguiente →</Link> : null}
        </div>
      ) : null}

      <section className="card">
        <h2>Nuevo paciente</h2>
        <ActionForm action={createPatientAction} className="grid-2">
          <Field label="Nombre y apellido"><input name="fullName" required /></Field>
          <Field label="Celular"><input name="phone" type="tel" required placeholder="381 555-1234" /></Field>
          <Field label="DNI"><input name="dni" inputMode="numeric" /></Field>
          <Field label="Obra social">
            <select name="insuranceId" defaultValue="">
              <option value="">—</option>
              {insurances.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
            </select>
          </Field>
          <Field label="N.º de afiliado"><input name="affiliateNumber" /></Field>
          <Field label="Email"><input name="email" type="email" /></Field>
          <div className="span-2"><SubmitButton>Guardar paciente</SubmitButton></div>
        </ActionForm>
      </section>

      {canSeeAllAgendas(user) ? (
        <section className="card stack">
          <h2>Importar desde Excel</h2>
          <p className="muted small">
            En Excel: Archivo → Guardar como → CSV. La primera fila tiene que tener los títulos. Columnas que reconoce:
            nombre, dni, celular o teléfono, obra social, afiliado, email. Los pacientes que ya existen (mismo DNI) se actualizan.
          </p>
          <ActionForm action={importPatientsAction} className="stack">
            <input type="file" name="file" accept=".csv,text/csv" />
            <details>
              <summary className="small">O pegá el contenido</summary>
              <textarea name="text" rows={6} placeholder={"nombre;dni;celular;obra social\nPérez Juan;30123456;381 555-1234;OSDE"} />
            </details>
            <div><SubmitButton>Importar</SubmitButton></div>
          </ActionForm>
        </section>
      ) : null}
    </div>
  );
}
