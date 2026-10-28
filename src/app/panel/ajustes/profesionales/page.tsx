import Link from "next/link";
import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { minutesToHHMM, weekdayShort } from "@/lib/tz";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Empty, Field, PageHeader } from "@/components/ui";
import { createProfessionalAction } from "../actions";

export const metadata: Metadata = { title: "Profesionales" };

export default async function ProfesionalesPage({ searchParams }: { searchParams: Promise<{ bienvenida?: string }> }) {
  const user = await requireUser(["ADMIN"]);
  const sp = await searchParams;
  const pros = await prisma.professional.findMany({
    where: { clinicId: user.clinic.id },
    include: { schedules: { orderBy: [{ weekday: "asc" }, { startMinute: "asc" }] } },
    orderBy: [{ active: "desc" }, { name: "asc" }],
  });
  return (
    <div className="stack">
      <PageHeader title="Profesionales y horarios" />
      {sp.bienvenida ? (
        <p className="notice notice-info">
          ¡Bienvenido! Primer paso: cargá los profesionales y sus horarios. Después ya podés dar turnos desde la Agenda.
        </p>
      ) : null}
      {pros.length === 0 ? (
        <div className="card">
          <Empty>Todavía no hay profesionales.</Empty>
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Profesional</th>
                <th>Turno</th>
                <th>Horarios</th>
                <th>Online</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {pros.map((p) => (
                <tr key={p.id} className={p.active ? undefined : "muted"}>
                  <td>
                    <span style={{ color: p.color }}>●</span> <strong>{p.name}</strong>
                    <div className="muted small">
                      {p.specialty}
                      {p.active ? "" : " · inactivo"}
                    </div>
                  </td>
                  <td>{p.slotMinutes} min</td>
                  <td className="small">
                    {p.schedules.length === 0
                      ? "Sin horarios"
                      : p.schedules
                          .map((s) => `${weekdayShort(s.weekday)} ${minutesToHHMM(s.startMinute)}–${minutesToHHMM(s.endMinute)}`)
                          .join(" · ")}
                  </td>
                  <td>{p.bookable ? "Sí" : "No"}</td>
                  <td>
                    <Link className="btn btn-sm" href={`/panel/ajustes/profesionales/${p.id}`}>
                      Editar
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <section className="card">
        <h2>Agregar profesional</h2>
        <ActionForm action={createProfessionalAction} className="grid-2">
          <Field label="Nombre">
            <input name="name" required placeholder="Dra. Valeria Romero" />
          </Field>
          <Field label="Especialidad">
            <input name="specialty" required placeholder="Clínica médica" />
          </Field>
          <Field label="Duración del turno (minutos)">
            <input name="slotMinutes" type="number" min={5} max={240} defaultValue={20} />
          </Field>
          <Field label="Color en la agenda">
            <input name="color" type="color" defaultValue="#1f6b5c" />
          </Field>
          <label className="check span-2">
            <input type="checkbox" name="bookable" defaultChecked /> Los pacientes pueden reservar online con este profesional
          </label>
          <div className="span-2">
            <SubmitButton>Agregar</SubmitButton>
          </div>
        </ActionForm>
      </section>
    </div>
  );
}
