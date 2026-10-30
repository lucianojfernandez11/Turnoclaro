import Link from "next/link";
import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { sha256 } from "@/lib/password";
import { firstName } from "@/lib/template";
import { ActionForm, SubmitButton } from "@/components/forms";
import { AuthShell } from "@/components/auth-shell";
import { Field } from "@/components/ui";
import { resetPasswordAction } from "./actions";

export const metadata: Metadata = { title: "Contraseña nueva", robots: { index: false } };

export default async function RestablecerPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const reset = await prisma.passwordReset.findUnique({ where: { id: sha256(token) }, include: { user: true } });
  const valid = reset && !reset.usedAt && reset.expiresAt > new Date();

  return (
    <AuthShell quote="Una contraseña nueva y listo: tu agenda te espera.">
      {valid ? (
        <>
          <div>
            <h1>Hola {firstName(reset.user.name)}, elegí tu contraseña nueva</h1>
            <p className="muted">Para {reset.user.email}. Al guardarla se cierra la sesión en los otros dispositivos.</p>
          </div>
          <ActionForm action={resetPasswordAction.bind(null, token)} className="stack">
            <Field label="Contraseña nueva" hint="Mínimo 8 caracteres.">
              <input name="password" type="password" autoComplete="new-password" minLength={8} required autoFocus />
            </Field>
            <Field label="Repetila">
              <input name="repeat" type="password" autoComplete="new-password" minLength={8} required />
            </Field>
            <SubmitButton className="btn btn-primary">Guardar e ingresar</SubmitButton>
          </ActionForm>
        </>
      ) : (
        <>
          <div>
            <h1>Este link ya no sirve</h1>
            <p className="muted">Venció (dura 1 hora) o ya se usó. Pedí uno nuevo y te llega en un minuto.</p>
          </div>
          <Link className="btn btn-primary" href="/olvide">Pedir un link nuevo</Link>
        </>
      )}
      <p className="muted small">
        <Link href="/login">← Volver a ingresar</Link>
      </p>
    </AuthShell>
  );
}
