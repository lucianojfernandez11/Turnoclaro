import Link from "next/link";
import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatInstant } from "@/lib/tz";
import { normalizeArPhone, prettyPhone, whatsappLink } from "@/lib/phone";
import { bookingNoticeText } from "@/lib/reminders";
import { ManualWhatsappButton, ConfirmSubmit } from "@/components/client-buttons";
import { Empty, PageHeader, StatusBadge } from "@/components/ui";
import { acceptRequestAction, markManualMessageAction, rejectRequestAction } from "../turnos/actions";

export const metadata: Metadata = { title: "Solicitudes online" };

export default async function SolicitudesPage() {
  const user = await requireUser(["ADMIN", "SECRETARIA"]);
  const tz = user.clinic.timezone;
  const since = new Date(Date.now() - 3 * 24 * 3600 * 1000);
  const [pending, recent] = await Promise.all([
    prisma.appointment.findMany({
      where: { clinicId: user.clinic.id, status: "SOLICITADO", startsAt: { gt: new Date() } },
      include: { patient: { include: { insurance: true } }, professional: true, clinic: true },
      orderBy: { startsAt: "asc" },
    }),
    prisma.appointment.findMany({
      where: { clinicId: user.clinic.id, source: "ONLINE", status: { not: "SOLICITADO" }, updatedAt: { gt: since } },
      include: { patient: true, professional: true, clinic: true, messages: { where: { kind: "RESERVA" } } },
      orderBy: { updatedAt: "desc" },
      take: 30,
    }),
  ]);

  return (
    <div className="stack">
      <PageHeader title="Solicitudes online" subtitle="Turnos que pidieron los pacientes desde el link de reservas." />
      {pending.length === 0 ? (
        <div className="card"><Empty>No hay solicitudes esperando.</Empty></div>
      ) : (
        pending.map((a) => (
          <section key={a.id} className="card row spread">
            <div>
              <strong>{a.patient.fullName}</strong>
              <div className="small muted">
                {formatInstant(a.startsAt, tz)} · {a.professional.name}
                <br />
                {prettyPhone(a.patient.phone)}
                {a.patient.dni ? ` · DNI ${a.patient.dni}` : ""}
                {a.patient.insurance ? ` · ${a.patient.insurance.name}` : ""}
              </div>
            </div>
            <div className="row">
              <form action={acceptRequestAction.bind(null, a.id)}>
                <button className="btn btn-primary" type="submit">Aceptar</button>
              </form>
              <form action={rejectRequestAction.bind(null, a.id)}>
                <ConfirmSubmit className="btn btn-danger" message="¿Rechazar la solicitud? El horario queda libre.">Rechazar</ConfirmSubmit>
              </form>
              <Link className="btn" href={`/panel/turnos/${a.id}`}>Ver / mover</Link>
            </div>
          </section>
        ))
      )}

      {recent.length > 0 ? (
        <section className="stack">
          <h2>Resueltas en los últimos 3 días</h2>
          <p className="muted small">Avisale al paciente por WhatsApp. Si no la aceptaste automáticamente, el paciente no sabe que ya está confirmado.</p>
          <div className="table-wrap">
            <table>
              <tbody>
                {recent.map((a) => {
                  const phone = normalizeArPhone(a.patient.phone, a.clinic.defaultAreaCode);
                  const kind = a.status === "CANCELADO" ? "cancelado" : "aceptada";
                  const notified = a.messages.length > 0;
                  return (
                    <tr key={a.id}>
                      <td>
                        <Link href={`/panel/turnos/${a.id}`}>{a.patient.fullName}</Link>
                        <div className="small muted">{formatInstant(a.startsAt, tz)} · {a.professional.name}</div>
                      </td>
                      <td><StatusBadge status={a.status} /></td>
                      <td>
                        {phone && a.startsAt > new Date() ? (
                          <ManualWhatsappButton
                            href={whatsappLink(phone, bookingNoticeText(a, kind))}
                            onSent={markManualMessageAction.bind(null, a.id, "RESERVA")}
                            label={notified ? "Avisado ✓ (reenviar)" : "Avisar por WhatsApp"}
                            className={notified ? "btn btn-sm" : "btn btn-wa btn-sm"}
                          />
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </div>
  );
}
