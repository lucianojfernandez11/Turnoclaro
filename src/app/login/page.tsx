import Link from "next/link";
import type { Metadata } from "next";
import { ActionForm, SubmitButton } from "@/components/forms";
import { AuthShell } from "@/components/auth-shell";
import { Field } from "@/components/ui";
import { loginAction } from "./actions";

export const metadata: Metadata = { title: "Ingresar" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ suspendido?: string; restablecida?: string }> }) {
  const sp = await searchParams;
  return (
    <AuthShell quote="Tu agenda del día, ordenada antes de abrir el consultorio.">
      <div>
        <h1>Ingresar</h1>
        <p className="muted">Con el email y la contraseña de tu consultorio.</p>
      </div>
      {sp.restablecida ? <p className="form-ok" role="status">Listo, guardamos tu contraseña nueva. Ya podés ingresar.</p> : null}
      {sp.suspendido ? <p className="notice">El consultorio está suspendido. Escribinos para reactivarlo.</p> : null}
      <ActionForm action={loginAction} className="stack">
        <Field label="Email">
          <input name="email" type="email" autoComplete="username" required />
        </Field>
        <Field label="Contraseña">
          <input name="password" type="password" autoComplete="current-password" required />
        </Field>
        <Link className="forgot-link" href="/olvide">¿Olvidaste tu contraseña?</Link>
        <SubmitButton className="btn btn-primary">Ingresar</SubmitButton>
      </ActionForm>
      <p className="muted small">
        ¿Querés verlo antes? <a href="/demo">Mirá la demo</a> sin registrarte.
      </p>
      {process.env.SIGNUP_ENABLED !== "false" ? (
        <p className="muted">
          ¿Todavía no tenés cuenta? <Link href="/registro">Probá 14 días gratis</Link>
        </p>
      ) : null}
    </AuthShell>
  );
}
