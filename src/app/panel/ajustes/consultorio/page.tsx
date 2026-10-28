import Link from "next/link";
import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ARGENTINA_TIMEZONES } from "@/lib/tz";
import { DEFAULT_REMINDER_TEMPLATE, TEMPLATE_VARIABLES } from "@/lib/template";
import { appUrl } from "@/lib/reminders";
import { ActionForm, SubmitButton } from "@/components/forms";
import { CopyButton } from "@/components/client-buttons";
import { Field, PageHeader } from "@/components/ui";
import { updateClinicAction } from "../actions";

export const metadata: Metadata = { title: "Ajustes del consultorio" };

export default async function ConsultorioPage() {
  const user = await requireUser(["ADMIN"]);
  const c = await prisma.clinic.findUniqueOrThrow({ where: { id: user.clinic.id } });
  const bookingUrl = `${appUrl()}/r/${c.slug}`;
  return (
    <div className="stack">
      <PageHeader title="Consultorio" subtitle="Datos que ven los pacientes en los mensajes y en la reserva online." />
      <ActionForm action={updateClinicAction} className="stack">
        <section className="card grid-2">
          <h2 className="span-2">Datos</h2>
          <Field label="Nombre">
            <input name="name" defaultValue={c.name} required />
          </Field>
          <Field label="Teléfono">
            <input name="phone" defaultValue={c.phone ?? ""} />
          </Field>
          <Field label="Dirección">
            <input name="address" defaultValue={c.address ?? ""} />
          </Field>
          <Field label="Característica telefónica" hint="Se usa cuando un paciente da su número sin característica.">
            <input name="defaultAreaCode" defaultValue={c.defaultAreaCode} inputMode="numeric" />
          </Field>
          <Field label="Zona horaria">
            <select name="timezone" defaultValue={c.timezone}>
              {ARGENTINA_TIMEZONES.map((tz) => (
                <option key={tz} value={tz}>
                  {tz.replace("America/Argentina/", "").replace("_", " ")}
                </option>
              ))}
            </select>
          </Field>
        </section>

        <section className="card grid-2">
          <h2 className="span-2">Reserva online</h2>
          <div className="span-2 row">
            <span className="mono small">{bookingUrl}</span>
            <CopyButton text={bookingUrl} label="Copiar link" />
            <a className="btn btn-sm" href={bookingUrl} target="_blank" rel="noreferrer">
              Abrir
            </a>
          </div>
          <Field label="Dirección del link" hint="Solo letras, números y guiones.">
            <input name="slug" defaultValue={c.slug} required />
          </Field>
          <Field label="Días hacia adelante que se puede reservar">
            <input name="bookingDaysAhead" type="number" min={1} max={90} defaultValue={c.bookingDaysAhead} />
          </Field>
          <label className="check">
            <input type="checkbox" name="bookingEnabled" defaultChecked={c.bookingEnabled} /> Reserva online activada
          </label>
          <label className="check">
            <input type="checkbox" name="bookingAutoConfirm" defaultChecked={c.bookingAutoConfirm} /> Confirmar las reservas
            al instante (sin revisión de la secretaría)
          </label>
        </section>

        <section className="card grid-2">
          <h2 className="span-2">Mensajes de WhatsApp</h2>
          <p className="span-2 muted small">
            Este es el mensaje que se abre en WhatsApp al tocar “Enviar” en Recordatorios. El link permite al paciente confirmar o
            cancelar y la agenda se actualiza sola. Para que se manden solos, mirá <Link href="/panel/ajustes/whatsapp">Ajustes › WhatsApp</Link>.
          </p>
          <Field
            label="Texto del recordatorio"
            hint={`Variables: ${TEMPLATE_VARIABLES.map((v) => `{${v}}`).join(" ")}. Vacío = texto por defecto.`}
          >
            <textarea name="reminderTemplate" rows={6} defaultValue={c.reminderTemplate ?? ""} placeholder={DEFAULT_REMINDER_TEMPLATE} />
          </Field>
          <label className="check span-2">
            <input type="checkbox" name="hideSpecialtyInMessages" defaultChecked={c.hideSpecialtyInMessages} /> No mostrar la
            especialidad en los mensajes (privacidad del paciente)
          </label>
        </section>
        <div>
          <SubmitButton>Guardar cambios</SubmitButton>
        </div>
      </ActionForm>
    </div>
  );
}
