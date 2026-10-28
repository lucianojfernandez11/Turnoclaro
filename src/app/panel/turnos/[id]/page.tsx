import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { AppointmentStatus } from "@prisma/client";
import { requireUser, canSeeAllAgendas, professionalScope } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { param } from "@/lib/forms";
import { formatInstant, formatYmdLong, minutesToHHMM, utcToZoned } from "@/lib/tz";
import { normalizeArPhone, prettyPhone, whatsappLink } from "@/lib/phone";
import { bookingNoticeText, patientLink, reminderText } from "@/lib/reminders";
import { STATUS_LABEL } from "@/lib/labels";
import { ActionForm, SubmitButton } from "@/components/forms";
import { ConfirmSubmit, CopyButton, ManualWhatsappButton } from "@/components/client-buttons";
import { Field, PanelHero } from "@/components/ui";
import { Icon } from "@/components/icons";
import { markManualMessageAction, rescheduleAction, setStatusAction, updateNoteAction } from "../actions";

export const metadata: Metadata = { title: "Turno" };

const MESSAGE_KIND: Record<string, string> = { RECORDATORIO: "Recordatorio", RESERVA: "Aviso de reserva", CAMBIO: "Aviso de cambio" };

export default async function TurnoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const sp = await searchParams;
  const tz = user.clinic.timezone;
  const a = await prisma.appointment.findFirst({
    where: { id, clinicId: user.clinic.id },
    include: {
      patient: { include: { insurance: true } },
      professional: true,
      clinic: true,
      messages: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!a || (!canSeeAllAgendas(user) && a.professionalId !== user.professionalId)) notFound();
  const [logs, pros] = await Promise.all([
    prisma.auditLog.findMany({
      where: { clinicId: user.clinic.id, entity: "Appointment", entityId: a.id },
      include: { user: true },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    prisma.professional.findMany({ where: { ...professionalScope(user), active: true }, orderBy: { name: "asc" } }),
  ]);

  const z = utcToZoned(a.startsAt, tz);
  const duration = Math.round((a.endsAt.getTime() - a.startsAt.getTime()) / 60000);
  const phone = normalizeArPhone(a.patient.phone, a.clinic.defaultAreaCode);
  const link = patientLink(a.publicToken);
  const future = a.startsAt > new Date();
  const error = param(sp.error);

  const statusButtons: { status: AppointmentStatus; label: string; danger?: boolean }[] = [];
  if (a.status === "CANCELADO") statusButtons.push({ status: "PENDIENTE", label: "Reactivar turno" });
  else {
    if (a.status === "PENDIENTE" || a.status === "SOLICITADO") statusButtons.push({ status: "CONFIRMADO", label: "Marcar confirmado" });
    if (a.status !== "ATENDIDO") statusButtons.push({ status: "ATENDIDO", label: "Atendido" });
    if (a.status !== "AUSENTE") statusButtons.push({ status: "AUSENTE", label: "No vino (ausente)" });
    statusButtons.push({ status: "CANCELADO", label: "Cancelar turno", danger: true });
  }

  return (
    <div className="stack">
      <PanelHero
        eyebrow={`Turno · ${a.professional.name}`}
        title={a.patient.fullName}
        subtitle={
          <>
            {a.source === "ONLINE" ? "Reservado online por el paciente" : "Dado desde el panel"}
            {a.overbook ? " · sobreturno" : ""}
          </>
        }
        actions={
          <Link className="btn btn-glass" href={`/panel/agenda?fecha=${z.ymd}`}>
            <Icon name="left" size={16} /> Volver a la agenda
          </Link>
        }
        chips={[
          { value: `${minutesToHHMM(z.minutes)} h`, label: formatYmdLong(z.ymd) },
          { value: `${duration} min`, label: "Duración" },
          { value: STATUS_LABEL[a.status], label: "Estado", tone: a.status === "CONFIRMADO" || a.status === "ATENDIDO" ? "lime" : "plain" },
        ]}
      />
      {error ? <p className="form-error">{error}</p> : null}

      <section className="card stack">
        <div className="row">
          {statusButtons.map((b) => (
            <form key={b.status} action={setStatusAction.bind(null, a.id, b.status)}>
              {b.danger ? (
                <ConfirmSubmit message="¿Cancelar este turno? El horario queda libre.">{b.label}</ConfirmSubmit>
              ) : (
                <button type="submit" className="btn">
                  {b.label}
                </button>
              )}
            </form>
          ))}
        </div>
        <div className="grid-2 small">
          <div>
            <strong>Paciente:</strong> <Link href={`/panel/pacientes/${a.patient.id}`}>{a.patient.fullName}</Link>
            <br />
            {a.patient.dni ? `DNI ${a.patient.dni} · ` : ""}
            {prettyPhone(a.patient.phone)}
            <br />
            {a.patient.insurance ? `${a.patient.insurance.name}${a.patient.affiliateNumber ? ` · afiliado ${a.patient.affiliateNumber}` : ""}` : "Sin obra social cargada"}
          </div>
          <div>
            <strong>Turno:</strong> {duration} minutos · {a.source === "ONLINE" ? "reservado online" : "dado desde el panel"}
            <br />
            <strong>Link del paciente:</strong> <span className="mono">{link}</span> <CopyButton text={link} />
          </div>
        </div>
      </section>

      {phone && a.status !== "CANCELADO" && future ? (
        <section className="card stack">
          <h2>Mensajes al paciente</h2>
          <p className="muted small">Abre WhatsApp con el mensaje escrito. El link le permite confirmar o cancelar, y la agenda se actualiza sola.</p>
          <div className="row">
            <ManualWhatsappButton
              href={whatsappLink(phone, reminderText(a))}
              onSent={markManualMessageAction.bind(null, a.id, "RECORDATORIO")}
              label="Enviar recordatorio"
            />
            <ManualWhatsappButton
              href={whatsappLink(phone, bookingNoticeText(a, a.source === "ONLINE" ? "aceptada" : "cambio"))}
              onSent={markManualMessageAction.bind(null, a.id, "CAMBIO")}
              label={a.source === "ONLINE" ? "Avisar que está confirmado" : "Avisar horario / cambio"}
              className="btn btn-sm"
            />
          </div>
        </section>
      ) : null}
      {phone && a.status === "CANCELADO" && future ? (
        <section className="card row">
          <ManualWhatsappButton
            href={whatsappLink(phone, bookingNoticeText(a, "cancelado"))}
            onSent={markManualMessageAction.bind(null, a.id, "CAMBIO")}
            label="Avisar la cancelación por WhatsApp"
            className="btn btn-sm"
          />
        </section>
      ) : null}

      {a.status !== "CANCELADO" ? (
        <section className="card">
          <h2>Reprogramar</h2>
          <ActionForm action={rescheduleAction.bind(null, a.id)} className="grid-2">
            <Field label="Profesional">
              <select name="professionalId" defaultValue={a.professionalId}>
                {pros.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Duración (minutos)">
              <input name="duracion" type="number" min={5} max={480} defaultValue={duration} />
            </Field>
            <Field label="Fecha">
              <input name="fecha" type="date" defaultValue={z.ymd} required />
            </Field>
            <Field label="Hora">
              <input name="hora" type="time" step={300} defaultValue={minutesToHHMM(z.minutes)} required />
            </Field>
            <label className="check span-2">
              <input type="checkbox" name="overbook" defaultChecked={a.overbook} /> Sobreturno
            </label>
            <div className="span-2">
              <SubmitButton>Mover turno</SubmitButton>
            </div>
          </ActionForm>
        </section>
      ) : null}

      <section className="card">
        <h2>Nota interna</h2>
        <ActionForm action={updateNoteAction.bind(null, a.id)} className="row">
          <input name="nota" defaultValue={a.note ?? ""} maxLength={300} style={{ flex: 1, minWidth: 200 }} />
          <SubmitButton className="btn">Guardar</SubmitButton>
        </ActionForm>
      </section>

      <section className="card">
        <h2>Historial</h2>
        <ul className="small" style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 4 }}>
          {a.messages.map((m) => (
            <li key={m.id}>
              {formatInstant(m.createdAt, tz)} · {MESSAGE_KIND[m.kind] ?? m.kind} por WhatsApp ({m.channel === "API" ? "automático" : "manual"}) ·{" "}
              <span className={`badge msg-${m.status.toLowerCase()}`}>{m.status.toLowerCase()}</span>
              {m.reply ? <span className={`badge rp-${m.reply.toLowerCase()}`}> respondió: {m.reply === "CONFIRMA" ? "confirma" : "cancela"}</span> : null}
              {m.error ? <span className="muted"> · {m.error}</span> : null}
            </li>
          ))}
          {logs.map((l) => {
            const d = (l.detail ?? {}) as { from?: string; to?: string; via?: string; reply?: string };
            let text = l.action;
            if (l.action === "estado") text = `Estado: ${STATUS_LABEL[d.from as AppointmentStatus] ?? d.from} → ${STATUS_LABEL[d.to as AppointmentStatus] ?? d.to}`;
            if (l.action === "turno_creado") text = "Turno creado";
            if (l.action === "reserva_online") text = "Reservado online por el paciente";
            if (l.action === "reprogramado") text = "Reprogramado";
            if (l.action === "respuesta_paciente") text = `El paciente respondió: ${d.reply === "CONFIRMA" ? "confirma" : "cancela"} (${d.via})`;
            return (
              <li key={l.id}>
                {formatInstant(l.createdAt, tz)} · {text} · <span className="muted">{l.user?.name ?? (l.action === "estado" && d.via && d.via !== "panel" ? "paciente" : "sistema")}</span>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
