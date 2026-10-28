import type { Metadata } from "next";
import { requireUser, ROLE_LABEL } from "@/lib/auth";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Field, PageHeader } from "@/components/ui";
import { changePasswordAction } from "./actions";

export const metadata: Metadata = { title: "Mi cuenta" };

export default async function CuentaPage() {
  const user = await requireUser();
  return (
    <div className="stack" style={{ maxWidth: 520 }}>
      <PageHeader title="Mi cuenta" subtitle={`${user.name} · ${user.email} · ${ROLE_LABEL[user.role]}`} />
      <section className="card">
        <h2>Cambiar contraseña</h2>
        <ActionForm action={changePasswordAction} className="stack" resetOnSuccess>
          <Field label="Contraseña actual">
            <input name="current" type="password" autoComplete="current-password" required />
          </Field>
          <Field label="Contraseña nueva" hint="Mínimo 8 caracteres">
            <input name="next" type="password" autoComplete="new-password" minLength={8} required />
          </Field>
          <div>
            <SubmitButton>Cambiar contraseña</SubmitButton>
          </div>
        </ActionForm>
      </section>
    </div>
  );
}
