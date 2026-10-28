import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { param } from "@/lib/forms";
import { formatYmdLong, minutesToHHMM, utcToZoned } from "@/lib/tz";
import { Icon } from "@/components/icons";
import { Glass } from "@/components/glass";
import { professionalLabel } from "@/lib/reminders";
import { ConfirmSubmit } from "@/components/client-buttons";
import { patientReplyAction } from "./actions";

export const metadata: Metadata = { title: "Tu turno", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function PatientTurnPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { token } = await params;
  const sp = await searchParams;
  const a = await prisma.appointment.findUnique({
    where: { publicToken: token },
    include: { patient: true, professional: true, clinic: true },
  });
  if (!a) notFound();
  const future = a.startsAt > new Date();
  const msg = param(sp.r);
  const isNew = param(sp.nuevo) === "1";

  let state: string;
  switch (a.status) {
    case "SOLICITADO":
      state = "Pedido recibido. El consultorio lo tiene que aceptar; te avisan por WhatsApp.";
      break;
    case "PENDIENTE":
      state = "Turno reservado. Confirmá que vas a asistir.";
      break;
    case "CONFIRMADO":
      state = "Turno confirmado. ¡Te esperamos!";
      break;
    case "CANCELADO":
      state = "Este turno está cancelado.";
      break;
    case "ATENDIDO":
      state = "Turno atendido.";
      break;
    default:
      state = "Turno pasado.";
  }

  const z = utcToZoned(a.startsAt, a.clinic.timezone);
  const badge: Record<string, string> = {
    SOLICITADO: "st-solicitado", PENDIENTE: "st-pendiente", CONFIRMADO: "st-confirmado",
    CANCELADO: "st-cancelado", ATENDIDO: "st-atendido", AUSENTE: "st-ausente",
  };

  return (
    <main className="public" style={{ maxWidth: 560 }}>
      <header className="frame public-head">
        <Glass calm />
        <span className="tag">Tu turno</span>
        <h1>{a.clinic.name}</h1>
        {a.clinic.address ? (
          <span className="row" style={{ gap: 6, fontSize: 14 }}>
            <Icon name="pin" size={16} /> {a.clinic.address}
          </span>
        ) : null}
      </header>
      {isNew ? (
        <p className="form-ok" style={{ marginTop: 0 }}>
          {a.status === "SOLICITADO" ? "¡Listo! Recibimos tu pedido de turno." : "¡Listo! Tu turno quedó reservado."} Guardá
          este link para ver o cancelar tu turno.
        </p>
      ) : null}
      {msg ? <p className="notice notice-info">{msg}</p> : null}
      <section className="card" style={{ padding: 0 }}>
        <div className="ticket">
          <span className="muted small">Hola {a.patient.fullName}</span>
          <p className="when">
            {formatYmdLong(z.ymd)}
            <br />
            <span className="hour">{minutesToHHMM(z.minutes)} h</span>
          </p>
          <p>{professionalLabel(a)}</p>
        </div>
        <div className="ticket-foot">
          <div className="row">
            <span className={`badge ${badge[a.status] ?? "st-pendiente"}`}>{state}</span>
          </div>
          {future && a.status !== "CANCELADO" ? (
            <div className="row">
              {a.status === "PENDIENTE" ? (
                <form action={patientReplyAction.bind(null, token, "CONFIRMA")}>
                  <button className="btn btn-primary" type="submit">
                    <Icon name="check" size={16} /> Confirmo que voy
                  </button>
                </form>
              ) : null}
              <form action={patientReplyAction.bind(null, token, "CANCELA")}>
                <ConfirmSubmit message="¿Seguro que querés cancelar el turno?" className="btn btn-danger">
                  No puedo ir, cancelar
                </ConfirmSubmit>
              </form>
            </div>
          ) : null}
        </div>
      </section>
      {a.clinic.phone ? <p className="muted small" style={{ textAlign: "center" }}>¿Dudas? Comunicate al {a.clinic.phone}.</p> : null}
    </main>
  );
}
