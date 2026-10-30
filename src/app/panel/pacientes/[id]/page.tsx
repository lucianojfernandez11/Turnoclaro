import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { Prisma } from "@prisma/client";
import { ConfirmSubmit } from "@/components/client-buttons";
import { requireUser, canSeeAllAgendas } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatInstant } from "@/lib/tz";
import { prettyPhone } from "@/lib/phone";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Avatar, Empty, Field, PageHeader, StatusBadge } from "@/components/ui";
import { deletePatientAction, updatePatientAction } from "../actions";

export const metadata: Metadata = { title: "Paciente" };

export default async function PacientePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const tz = user.clinic.timezone;
  const apptWhere: Prisma.AppointmentWhereInput = canSeeAllAgendas(user)
    ? {}
    : { professionalId: user.professionalId ?? "__ninguno__" };
  const [p, allInsurances] = await Promise.all([
    prisma.patient.findFirst({
      where: { id, clinicId: user.clinic.id, deletedAt: null },
      include: {
        appointments: {
          where: apptWhere,
          include: { professional: true },
          orderBy: { startsAt: "desc" },
          take: 100,
        },
      },
    }),
    prisma.insurance.findMany({ where: { clinicId: user.clinic.id }, orderBy: { name: "asc" } }),
  ]);
  if (!p) notFound();
  const insurances = allInsurances.filter((i) => i.active || i.id === p.insuranceId);
  const done = p.appointments.filter((a) => a.status === "ATENDIDO").length;
  const absent = p.appointments.filter((a) => a.status === "AUSENTE").length;

  return (
    <div className="stack">
      <div className="person person-lg"><Avatar name={p.fullName} size={52} /></div>
      <PageHeader
        title={p.fullName}
        subtitle={`${prettyPhone(p.phone)}${p.dni ? ` · DNI ${p.dni}` : ""} · ${done} atendidos · ${absent} ausencias`}
        actions={
          <>
            <Link className="btn btn-primary" href={`/panel/turnos/nuevo?paciente=${p.id}`}>Dar turno</Link>
            <Link className="btn" href="/panel/pacientes">Volver</Link>
          </>
        }
      />

      <section className="card">
        <h2>Turnos</h2>
        {p.appointments.length === 0 ? (
          <Empty>Sin turnos todavía.</Empty>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Fecha</th><th>Profesional</th><th>Estado</th></tr>
              </thead>
              <tbody>
                {p.appointments.map((a) => (
                  <tr key={a.id}>
                    <td><Link href={`/panel/turnos/${a.id}`}>{formatInstant(a.startsAt, tz)}</Link></td>
                    <td>{a.professional.name}</td>
                    <td><StatusBadge status={a.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card">
        <h2>Datos</h2>
        <ActionForm action={updatePatientAction.bind(null, p.id)} className="grid-2">
          <Field label="Nombre y apellido"><input name="fullName" defaultValue={p.fullName} required /></Field>
          <Field label="Celular"><input name="phone" type="tel" defaultValue={prettyPhone(p.phone)} required /></Field>
          <Field label="DNI"><input name="dni" defaultValue={p.dni ?? ""} inputMode="numeric" /></Field>
          <Field label="Obra social">
            <select name="insuranceId" defaultValue={p.insuranceId ?? ""}>
              <option value="">—</option>
              {insurances.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
            </select>
          </Field>
          <Field label="N.º de afiliado"><input name="affiliateNumber" defaultValue={p.affiliateNumber ?? ""} /></Field>
          <Field label="Email"><input name="email" type="email" defaultValue={p.email ?? ""} /></Field>
          <Field label="Notas administrativas" hint="No cargues datos clínicos acá.">
            <textarea name="notes" rows={3} defaultValue={p.notes ?? ""} maxLength={1000} />
          </Field>
          <label className="check">
            <input type="checkbox" name="whatsappOptIn" defaultChecked={p.whatsappOptIn} /> Acepta recordatorios por WhatsApp
          </label>
          <div className="span-2"><SubmitButton>Guardar</SubmitButton></div>
        </ActionForm>
      </section>

      {canSeeAllAgendas(user) ? (
        <form action={deletePatientAction.bind(null, p.id)}>
          <ConfirmSubmit className="btn btn-danger" message={`¿Borrar a ${p.fullName}? Se cancelan sus turnos futuros.`}>
            Borrar paciente (cancela sus turnos futuros)
          </ConfirmSubmit>
        </form>
      ) : null}
    </div>
  );
}
