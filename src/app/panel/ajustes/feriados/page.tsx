import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatInstant, todayYmd } from "@/lib/tz";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Empty, Field, PageHeader } from "@/components/ui";
import { addBlockAction, deleteBlockAction } from "../actions";

export const metadata: Metadata = { title: "Feriados y cierres" };

export default async function FeriadosPage() {
  const user = await requireUser(["ADMIN"]);
  const tz = user.clinic.timezone;
  const blocks = await prisma.block.findMany({
    where: { clinicId: user.clinic.id, professionalId: null, endsAt: { gt: new Date() } },
    orderBy: { startsAt: "asc" },
  });
  const today = todayYmd(tz);
  return (
    <div className="stack">
      <PageHeader title="Feriados y cierres" subtitle="Bloquean la agenda de todos los profesionales." />
      <section className="card stack">
        {blocks.length === 0 ? (
          <Empty>No hay feriados ni cierres cargados.</Empty>
        ) : (
          <ul className="stack" style={{ listStyle: "none", padding: 0, margin: 0, gap: 8 }}>
            {blocks.map((b) => (
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
      </section>
      <section className="card">
        <h2>Agregar feriado o cierre</h2>
        <ActionForm action={addBlockAction.bind(null, null)} className="grid-2" resetOnSuccess>
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
            <input name="reason" placeholder="Feriado nacional" />
          </Field>
          <div className="span-2">
            <SubmitButton>Agregar</SubmitButton>
          </div>
        </ActionForm>
      </section>
    </div>
  );
}
