import type { Metadata } from "next";
import { requireUser, ROLE_LABEL } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ActionForm, SubmitButton } from "@/components/forms";
import { ConfirmSubmit } from "@/components/client-buttons";
import { Field, PageHeader } from "@/components/ui";
import { createUserAction, removeMembershipAction, updateMembershipAction } from "../actions";

export const metadata: Metadata = { title: "Usuarios" };

const ROLES = ["ADMIN", "SECRETARIA", "PROFESIONAL"] as const;

export default async function UsuariosPage() {
  const me = await requireUser(["ADMIN"]);
  const [members, pros] = await Promise.all([
    prisma.membership.findMany({
      where: { clinicId: me.clinic.id },
      include: { user: true, professional: true },
      orderBy: { user: { name: "asc" } },
    }),
    prisma.professional.findMany({ where: { clinicId: me.clinic.id, active: true }, orderBy: { name: "asc" } }),
  ]);

  const proOptions = (
    <>
      <option value="">— Ninguno —</option>
      {pros.map((p) => (
        <option key={p.id} value={p.id}>
          {p.name}
        </option>
      ))}
    </>
  );

  return (
    <div className="stack">
      <PageHeader
        title="Usuarios"
        subtitle="Administración: todo. Secretaría: agenda, pacientes y recordatorios. Profesional: solo su agenda."
      />
      {members.map((m) => (
        <section key={m.id} className="card">
          <div className="row spread" style={{ marginBottom: 12 }}>
            <div>
              <strong>{m.user.name}</strong> <span className="muted">· {m.user.email}</span>
              <div className="small muted">
                {ROLE_LABEL[m.role]}
                {m.professional ? ` · agenda de ${m.professional.name}` : ""}
                {m.user.lastLoginAt ? ` · último ingreso ${m.user.lastLoginAt.toLocaleDateString("es-AR")}` : " · nunca ingresó"}
              </div>
            </div>
            {m.userId !== me.userId ? (
              <form action={removeMembershipAction.bind(null, m.id)}>
                <ConfirmSubmit className="btn btn-sm btn-danger" message={`¿Quitarle el acceso a ${m.user.name}?`}>
                  Quitar acceso
                </ConfirmSubmit>
              </form>
            ) : (
              <span className="badge st-confirmado">Vos</span>
            )}
          </div>
          <ActionForm action={updateMembershipAction.bind(null, m.id)} className="grid-2">
            <Field label="Rol">
              <select name="role" defaultValue={m.role}>
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABEL[r]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Vinculado a la agenda de">
              <select name="professionalId" defaultValue={m.professionalId ?? ""}>
                {proOptions}
              </select>
            </Field>
            <Field label="Nueva contraseña" hint="Dejalo vacío para no cambiarla.">
              <input name="newPassword" type="password" autoComplete="new-password" minLength={8} />
            </Field>
            <div className="span-2">
              <SubmitButton className="btn">Guardar</SubmitButton>
            </div>
          </ActionForm>
        </section>
      ))}

      <section className="card">
        <h2>Agregar usuario</h2>
        <ActionForm action={createUserAction} className="grid-2" resetOnSuccess>
          <Field label="Nombre">
            <input name="name" required />
          </Field>
          <Field label="Email">
            <input name="email" type="email" required />
          </Field>
          <Field label="Rol">
            <select name="role" defaultValue="SECRETARIA">
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABEL[r]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Vinculado a la agenda de" hint="Obligatorio para el rol Profesional.">
            <select name="professionalId" defaultValue="">
              {proOptions}
            </select>
          </Field>
          <Field label="Contraseña inicial" hint="Mínimo 8 caracteres. Pasásela a la persona.">
            <input name="password" type="text" autoComplete="off" minLength={8} />
          </Field>
          <div className="span-2">
            <SubmitButton>Crear usuario</SubmitButton>
          </div>
        </ActionForm>
      </section>
    </div>
  );
}
