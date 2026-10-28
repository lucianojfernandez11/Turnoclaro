import Link from "next/link";
import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { param } from "@/lib/forms";
import { addDays, formatTime, formatYmdLong, isYmd, todayYmd } from "@/lib/tz";
import { normalizeArPhone, whatsappLink } from "@/lib/phone";
import { clinicWhatsapp, reminderText, remindersForDay } from "@/lib/reminders";
import { prisma } from "@/lib/db";
import { ActionForm, SubmitButton } from "@/components/forms";
import { ManualWhatsappButton } from "@/components/client-buttons";
import { Empty, PageHeader, StatusBadge } from "@/components/ui";
import { markManualMessageAction, sendRemindersNowAction } from "../turnos/actions";

export const metadata: Metadata = { title: "Recordatorios" };

export default async function RecordatoriosPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireUser(["ADMIN", "SECRETARIA"]);
  const sp = await searchParams;
  const tz = user.clinic.timezone;
  const tomorrow = addDays(todayYmd(tz), 1);
  const ymd = isYmd(param(sp.fecha)) ? param(sp.fecha)! : tomorrow;
  const list = await remindersForDay(user.clinic.id, ymd, tz);
  const clinicRow = await prisma.clinic.findUniqueOrThrow({ where: { id: user.clinic.id } });
  const wa = clinicWhatsapp(clinicRow);
  const api = wa.mode !== "MANUAL";

  const sent = list.filter((a) => a.messages.some((m) => m.status !== "FALLIDO")).length;
  const confirmed = list.filter((a) => a.status === "CONFIRMADO").length;
  const cancelledByReply = list.filter((a) => a.messages.some((m) => m.reply === "CANCELA")).length;

  return (
    <div className="stack">
      <PageHeader
        title="Recordatorios"
        subtitle={`Turnos del ${formatYmdLong(ymd)}${ymd === tomorrow ? " (mañana)" : ""}`}
        actions={
          <div className="row">
            <Link className="btn btn-sm" href={`/panel/recordatorios?fecha=${addDays(ymd, -1)}`}>←</Link>
            <Link className="btn btn-sm" href="/panel/recordatorios">Mañana</Link>
            <Link className="btn btn-sm" href={`/panel/recordatorios?fecha=${addDays(ymd, 1)}`}>→</Link>
          </div>
        }
      />
      <div className="stats">
        <div className="stat"><b>{list.length}</b><span>Turnos activos</span></div>
        <div className="stat"><b>{sent}</b><span>Recordatorio enviado</span></div>
        <div className="stat"><b>{confirmed}</b><span>Confirmados</span></div>
        <div className="stat"><b>{cancelledByReply}</b><span>Cancelaron por WhatsApp</span></div>
      </div>
      {list.length > 0 ? (
        <div className="progress card card-tight" aria-label={`${sent} de ${list.length} recordatorios enviados, ${confirmed} confirmados`}>
          <div className="progress-bar">
            <span className="p-sent" style={{ width: `${Math.round((sent / list.length) * 100)}%` }} />
            <span className="p-ok" style={{ width: `${Math.round((confirmed / list.length) * 100)}%` }} />
          </div>
          <div className="row small muted">
            <span><i className="dot dot-ok" /> Confirmados {Math.round((confirmed / list.length) * 100)}%</span>
            <span><i className="dot dot-sent" /> Recordatorio enviado {Math.round((sent / list.length) * 100)}%</span>
          </div>
        </div>
      ) : null}

      {api ? (
        <div className="card row spread">
          <p className="small">
            Envío automático activado{wa.mode === "PROPIA" ? " con el WhatsApp del consultorio" : ""}: cada día a las 19 h salen
            los recordatorios del día siguiente. A quien ya confirmó no se le escribe.
            {wa.mode === "PACK" ? (
              <>
                {" "}
                <b>Te quedan {wa.credits.toLocaleString("es-AR")} recordatorios.</b>
              </>
            ) : null}
          </p>
          <ActionForm action={sendRemindersNowAction.bind(null, ymd)}>
            <SubmitButton className="btn btn-wa">Enviar ahora los que faltan</SubmitButton>
          </ActionForm>
        </div>
      ) : (
        <p className="notice notice-info">
          Tocá “Enviar” en cada paciente y se abre WhatsApp con el mensaje listo: solo tenés que apretar enviar. Cuando el
          paciente toca el link, el turno se confirma o se cancela solo en la agenda. Los que ya confirmaron no necesitan
          recordatorio.
          {user.role === "ADMIN" ? (
            <>
              {" "}
              <Link href="/panel/ajustes/whatsapp">¿Querés que se manden solos?</Link>
            </>
          ) : null}
        </p>
      )}

      {list.length === 0 ? (
        <div className="card"><Empty>No hay turnos activos ese día.</Empty></div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Hora</th>
                <th>Paciente</th>
                <th>Estado</th>
                <th>Recordatorio</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {list.map((a) => {
                const last = a.messages[0];
                const phone = normalizeArPhone(a.patient.phone, a.clinic.defaultAreaCode);
                return (
                  <tr key={a.id}>
                    <td className="mono">{formatTime(a.startsAt, tz)}</td>
                    <td>
                      <Link href={`/panel/turnos/${a.id}`}>{a.patient.fullName}</Link>
                      <div className="small muted">{a.professional.name}</div>
                    </td>
                    <td><StatusBadge status={a.status} /></td>
                    <td className="small">
                      {last ? (
                        <>
                          <span className={`badge msg-${last.status.toLowerCase()}`}>
                            {last.status === "MANUAL" ? "enviado a mano" : last.status.toLowerCase()}
                          </span>
                          {last.reply ? (
                            <span className={`badge rp-${last.reply.toLowerCase()}`}> {last.reply === "CONFIRMA" ? "confirmó" : "canceló"}</span>
                          ) : null}
                          {last.error ? <div className="muted">{last.error}</div> : null}
                        </>
                      ) : (
                        <span className="badge msg-none">sin enviar</span>
                      )}
                      {!a.patient.whatsappOptIn ? <div className="muted">No acepta WhatsApp</div> : null}
                    </td>
                    <td>
                      {a.status === "CONFIRMADO" && !last ? (
                        <span className="small muted">Ya confirmó</span>
                      ) : phone ? (
                        <ManualWhatsappButton
                          href={whatsappLink(phone, reminderText(a))}
                          onSent={markManualMessageAction.bind(null, a.id, "RECORDATORIO")}
                          label={last ? "Reenviar" : "Enviar"}
                          className={last ? "btn btn-sm" : "btn btn-wa btn-sm"}
                        />
                      ) : (
                        <span className="small muted">Teléfono inválido</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
