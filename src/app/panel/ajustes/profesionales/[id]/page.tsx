import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatInstant, minutesToHHMM, todayYmd, weekdayName } from "@/lib/tz";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Empty, Field, PageHeader } from "@/components/ui";
import { addBlockAction, deleteBlockAction, saveSchedulesAction, updateProfessionalAction } from "../../actions";

export const metadata: Metadata = { title: "Editar profesional" };

const WEEKDAYS = [1, 2, 3, 4, 5, 6, 7];

export default async function ProfesionalPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ nuevo?: string }>;
}) {
  const user = await requireUser(["ADMIN"]);
  const { id } = await params;
  const sp = await searchParams;
  const tz = user.clinic.timezone;
  const p = await prisma.professional.findFirst({
    where: { id, clinicId: user.clinic.id },
    include: {
      schedules: { orderBy: [{ weekday: "asc" }, { startMinute: "asc" }] },
      blocks: { where: { endsAt: { gt: new Date() } }, orderBy: { startsAt: "asc" } },
    },
  });
  if (!p) notFound();

  // Filas del editor: las existentes y tres vacías para agregar.
  const rows = [
    ...p.schedules.map((s) => ({ weekday: s.weekday, start: minutesToHHMM(s.startMinute), end: minutesToHHMM(s.endMinute) })),
    ...Array.from({ length: 3 }, () => ({ weekday: 0, start: "", end: "" })),
  ];
  const today = todayYmd(tz);

  return (
    <div className="stack">
      <PageHeader
        title={p.name}
        subtitle={p.specialty}
        actions={
          <Link className="btn" href="/panel/ajustes/profesionales">
            Volver
          </Link>
        }
      />
      {sp.nuevo ? (
        <p className="notice notice-info">
          Le cargamos un horario de lunes a viernes de 9 a 13. Ajustalo abajo a sus días y horas reales.
        </p>
      ) : null}

      <section className="card">
        <h2>Datos</h2>
        <ActionForm action={updateProfessionalAction.bind(null, p.id)} className="grid-2">
          <Field label="Nombre">
            <input name="name" defaultValue={p.name} required />
          </Field>
          <Field label="Especialidad">
            <input name="specialty" defaultValue={p.specialty} required />
          </Field>
          <Field label="Duración del turno (minutos)">
            <input name="slotMinutes" type="number" min={5} max={240} defaultValue={p.slotMinutes} />
          </Field>
          <Field label="Color en la agenda">
            <input name="color" type="color" defaultValue={p.color} />
          </Field>
          <label className="check">
            <input type="checkbox" name="bookable" defaultChecked={p.bookable} /> Reserva online
          </label>
          <label className="check">
            <input type="checkbox" name="active" defaultChecked={p.active} /> Activo (aparece en la agenda)
          </label>
          <div className="span-2">
            <SubmitButton>Guardar datos</SubmitButton>
          </div>
        </ActionForm>
      </section>

      <section className="card">
        <h2>Horario semanal</h2>
        <p className="muted small" style={{ marginBottom: 12 }}>
          Una fila por franja. Si atiende mañana y tarde el mismo día, usá dos filas. Para borrar una franja, dejá el día
          vacío.
        </p>
        <ActionForm action={saveSchedulesAction.bind(null, p.id)} className="stack">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Día</th>
                  <th>Desde</th>
                  <th>Hasta</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i}>
                    <td>
                      <select name="weekday" defaultValue={String(r.weekday)} aria-label={`Día de la fila ${i + 1}`}>
                        <option value="0">—</option>
                        {WEEKDAYS.map((d) => (
                          <option key={d} value={d}>
                            {weekdayName(d)}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <input type="time" name="start" defaultValue={r.start} step={300} aria-label={`Desde, fila ${i + 1}`} />
                    </td>
                    <td>
                      <input type="time" name="end" defaultValue={r.end} step={300} aria-label={`Hasta, fila ${i + 1}`} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div>
            <SubmitButton>Guardar horarios</SubmitButton>
          </div>
        </ActionForm>
      </section>

      <section className="card stack">
        <h2>Bloqueos de agenda</h2>
        <p className="muted small">Vacaciones, congresos o un rato libre. En esos horarios no se pueden dar turnos online.</p>
        {p.blocks.length === 0 ? (
          <Empty>Sin bloqueos próximos.</Empty>
        ) : (
          <ul className="stack" style={{ listStyle: "none", padding: 0, margin: 0, gap: 8 }}>
            {p.blocks.map((b) => (
              <li key={b.id} className="row spread card card-tight">
                <span>
                  <strong>{b.reason}</strong>
                  <br />
                  <span className="small muted">
                    {formatInstant(b.startsAt, tz)} → {formatInstant(b.endsAt, tz)}
                  </span>
                </span>
                <form action={deleteBlockAction.bind(null, b.id)}>
                  <button className="btn btn-sm btn-danger" type="submit">
                    Quitar
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
        <ActionForm action={addBlockAction.bind(null, p.id)} className="grid-2" resetOnSuccess>
          <Field label="Desde el día">
            <input type="date" name="from" min={today} required />
          </Field>
          <Field label="Hasta el día" hint="Vacío = el mismo día">
            <input type="date" name="to" min={today} />
          </Field>
          <Field label="Desde la hora" hint="Vacío = días completos">
            <input type="time" name="startTime" step={300} />
          </Field>
          <Field label="Hasta la hora">
            <input type="time" name="endTime" step={300} />
          </Field>
          <Field label="Motivo">
            <input name="reason" placeholder="Vacaciones" />
          </Field>
          <div className="span-2">
            <SubmitButton>Agregar bloqueo</SubmitButton>
          </div>
        </ActionForm>
      </section>
    </div>
  );
}
