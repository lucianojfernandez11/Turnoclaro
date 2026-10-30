import Link from "next/link";
import type { Metadata } from "next";
import { ActionForm, SubmitButton } from "@/components/forms";
import { AuthShell } from "@/components/auth-shell";
import { Field } from "@/components/ui";
import { requestResetAction } from "./actions";

export const metadata: Metadata = { title: "Olvidé mi contraseña" };

export default function OlvidePage() {
  return (
    <AuthShell quote="Te mandamos un link por email y en un minuto volvés a tu agenda.">
      <div>
        <h1>¿Olvidaste tu contraseña?</h1>
        <p className="muted">Escribí el email con el que ingresás y te mandamos un link para elegir una nueva.</p>
      </div>
      <ActionForm action={requestResetAction} className="stack">
        <Field label="Email">
          <input name="email" type="email" autoComplete="username" required autoFocus />
        </Field>
        <SubmitButton className="btn btn-primary">Mandarme el link</SubmitButton>
      </ActionForm>
      <p className="muted small">
        <Link href="/login">← Volver a ingresar</Link>
      </p>
    </AuthShell>
  );
}
