import Link from "next/link";
import type { Metadata } from "next";
import { requireUser, professionalScope } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { param } from "@/lib/forms";
import { hhmmToMinutes, isYmd, todayYmd, formatYmdLong } from "@/lib/tz";
import { prettyPhone } from "@/lib/phone";
import { ActionForm, SubmitButton } from "@/components/forms";
import { PatientPicker } from "@/components/patient-picker";
import { Field, PageHeader } from "@/components/ui";
import { createAppointmentAction } from "../actions";

export const metadata: Metadata = { title: "Nuevo turno" };

export default async function NuevoTurnoPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser();
  const sp = await searchParams;
  const tz = user.clinic.timezone;
  const [pros, insurances] = await Promise.all([
    prisma.professional.findMany({ where: { ...professionalScope(user), active: true }, orderBy: { name: "asc" } }),
    prisma.insurance.findMany({ where: { clinicId: user.clinic.id, active: true }, orderBy: { name: "asc" } }),
  ]);
  const profId = param(sp.prof) && pros.some((p) => p.id === param(sp.prof)) ? param(sp.prof)! : pros[0]?.id ?? "";
  const pro = pros.find((p) => p.id === profId);
  const fecha = isYmd(param(sp.fecha)) ? param(sp.fecha)! : todayYmd(tz);
  const hora = hhmmToMinutes(param(sp.hora)) !== null ? param(sp.hora)! : "";

  // Paciente precargado (desde la ficha del paciente: "Dar turno").
  const pid = param(sp.paciente);
  const pre = pid ? await prisma.patient.findFirst({ where: { id: pid, clinicId: user.clinic.id }, include: { insurance: true } }) : null;

  return (
    <div className="stack">
      <PageHeader
        title="Nuevo turno"
        subtitle={hora ? `${formatYmdLong(fecha)} a las ${hora}${pro ? ` con ${pro.name}` : ""}` : undefined}
        actions={
          <Link className="btn" href={`/panel/agenda?fecha=${fecha}`}>
            Volver a la agenda
          </Link>
        }
      />
      {pros.length === 0 ? (
        <p className="notice">No hay profesionales activos para dar turnos.</p>
      ) : (
        <ActionForm action={createAppointmentAction} className="stack">
          <section className="card grid-2">
            <Field label="Profesional">
              <select name="professionalId" defaultValue={profId} required>
                {pros.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} · {p.specialty}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Duración (minutos)" hint="Por defecto, la del profesional.">
              <input name="duracion" type="number" min={5} max={480} defaultValue={pro?.slotMinutes ?? 20} />
            </Field>
            <Field label="Fecha">
              <input name="fecha" type="date" defaultValue={fecha} required />
            </Field>
            <Field label="Hora">
              <input name="hora" type="time" defaultValue={hora} step={300} required />
            </Field>
            <Field label="Estado inicial">
              <select name="estado" defaultValue="PENDIENTE">
                <option value="PENDIENTE">Sin confirmar (se le pide confirmación)</option>
                <option value="CONFIRMADO">Ya confirmado</option>
              </select>
            </Field>
            <label className="check">
              <input type="checkbox" name="overbook" /> Sobreturno (permite dar el turno aunque el horario esté ocupado)
            </label>
            <Field label="Nota interna" hint="Solo la ve el consultorio.">
              <input name="nota" maxLength={300} />
            </Field>
          </section>
          <PatientPicker
            insurances={insurances.map((i) => ({ id: i.id, name: i.name }))}
            initial={
              pre
                ? { id: pre.id, fullName: pre.fullName, dni: pre.dni, phone: prettyPhone(pre.phone), insurance: pre.insurance?.name ?? null }
                : null
            }
          />
          <div>
            <SubmitButton>Dar turno</SubmitButton>
          </div>
        </ActionForm>
      )}
    </div>
  );
}
