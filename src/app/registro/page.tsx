import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ActionForm, SubmitButton } from "@/components/forms";
import { AuthShell } from "@/components/auth-shell";
import { Field } from "@/components/ui";
import { signupAction } from "../login/actions";

export const metadata: Metadata = { title: "Crear cuenta" };

export default function SignupPage() {
  if (process.env.SIGNUP_ENABLED === "false") notFound();
  return (
    <AuthShell quote="Menos sillas vacías. Menos llamadas para confirmar.">
      <div>
        <h1>Probá TurnoClaro</h1>
        <p className="muted">14 días gratis, sin tarjeta. Después cargás los profesionales y sus horarios.</p>
      </div>
      <ActionForm action={signupAction} className="stack">
        <Field label="Nombre del consultorio">
          <input name="clinicName" required placeholder="Consultorios Del Parque" />
        </Field>
        <Field label="Tu nombre">
          <input name="name" required autoComplete="name" />
        </Field>
        <Field label="Email">
          <input name="email" type="email" required autoComplete="email" />
        </Field>
        <Field label="Teléfono del consultorio" hint="Opcional">
          <input name="phone" type="tel" />
        </Field>
        <Field label="Contraseña" hint="Mínimo 8 caracteres">
          <input name="password" type="password" required minLength={8} autoComplete="new-password" />
        </Field>
        <SubmitButton className="btn btn-primary">Crear cuenta</SubmitButton>
      </ActionForm>
      <p className="muted">
        ¿Ya tenés cuenta? <Link href="/login">Ingresar</Link>
      </p>
    </AuthShell>
  );
}
