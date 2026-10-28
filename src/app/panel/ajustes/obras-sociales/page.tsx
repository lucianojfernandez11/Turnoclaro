import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Field, PageHeader } from "@/components/ui";
import { addInsuranceAction, toggleInsuranceAction } from "../actions";

export const metadata: Metadata = { title: "Obras sociales" };

export default async function ObrasSocialesPage() {
  const user = await requireUser(["ADMIN"]);
  const list = await prisma.insurance.findMany({
    where: { clinicId: user.clinic.id },
    include: { _count: { select: { patients: true } } },
    orderBy: [{ active: "desc" }, { name: "asc" }],
  });
  return (
    <div className="stack">
      <PageHeader title="Obras sociales" subtitle="Las activas aparecen en las fichas y en la reserva online." />
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Pacientes</th>
              <th>Estado</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {list.map((i) => (
              <tr key={i.id}>
                <td>{i.name}</td>
                <td>{i._count.patients}</td>
                <td>{i.active ? "Activa" : "Oculta"}</td>
                <td>
                  <form action={toggleInsuranceAction.bind(null, i.id)}>
                    <button className="btn btn-sm" type="submit">
                      {i.active ? "Ocultar" : "Activar"}
                    </button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <section className="card">
        <ActionForm action={addInsuranceAction} className="row" resetOnSuccess>
          <Field label="Nueva obra social">
            <input name="name" required />
          </Field>
          <SubmitButton>Agregar</SubmitButton>
        </ActionForm>
      </section>
    </div>
  );
}
