import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { publicClinic, freeSlotsWindow } from "@/lib/booking";
import { param } from "@/lib/forms";
import { formatYmdLong, formatYmdShort, hhmmToMinutes, isYmd, minutesToHHMM, weekdayOf, weekdayShort } from "@/lib/tz";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Field } from "@/components/ui";
import { Icon } from "@/components/icons";
import { Glass } from "@/components/glass";
import { bookAction } from "./actions";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const clinic = await publicClinic(slug);
  return { title: clinic ? `Sacá tu turno en ${clinic.name}` : "Reserva de turnos" };
}

export default async function ReservaPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const clinic = await publicClinic(slug);
  if (!clinic) notFound();

  const header = (
    <header className="frame public-head">
      <Glass calm />
      <span className="tag">Turnos online</span>
      <h1>{clinic.name}</h1>
      <div className="row">
        {clinic.address ? (
          <span className="row" style={{ gap: 6 }}>
            <Icon name="pin" size={16} /> {clinic.address}
          </span>
        ) : null}
        {clinic.phone ? <span>{clinic.phone}</span> : null}
      </div>
    </header>
  );

  if (!clinic.active || !clinic.bookingEnabled) {
    return (
      <main className="public">
        {header}
        <p className="notice">Por ahora este consultorio no toma turnos online.{clinic.phone ? ` Llamá al ${clinic.phone}.` : ""}</p>
      </main>
    );
  }

  const pro = clinic.professionals.find((p) => p.id === param(sp.p));
  const d = param(sp.d);
  const ymd = d && isYmd(d) ? d : null;
  const t = param(sp.t);
  const minutes = hhmmToMinutes(t);
  const base = `/r/${clinic.slug}`;

  const avail = pro
    ? await freeSlotsWindow({ clinicId: clinic.id, timeZone: clinic.timezone, professional: pro, daysAhead: clinic.bookingDaysAhead })
    : [];
  const daysWithSlots = avail.filter((w) => w.slots.length > 0);
  const day = ymd ? avail.find((w) => w.ymd === ymd) : undefined;
  const slot = day && minutes !== null ? day.slots.find((s) => s.minutes === minutes) : undefined;

  return (
    <main className="public">
      {header}
      <div className="steps small" aria-label="Pasos de la reserva">
        <span className={pro ? "done" : "now"}>Profesional</span>
        <span className={day ? "done" : pro ? "now" : undefined}>Día</span>
        <span className={slot ? "done" : day ? "now" : undefined}>Horario</span>
        <span className={slot ? "now" : undefined}>Tus datos</span>
      </div>

      <section className="card stack">
        <h2>¿Con quién?</h2>
        {clinic.professionals.length === 0 ? (
          <p className="muted">No hay profesionales con turnos online por ahora.</p>
        ) : (
          <div className="choices">
            {clinic.professionals.map((p) => (
              <Link key={p.id} href={`${base}?p=${p.id}`} className={`choice${pro?.id === p.id ? " active" : ""}`}>
                <strong>{p.name}</strong>
                <span className="muted small">{p.specialty}</span>
              </Link>
            ))}
          </div>
        )}
      </section>

      {pro ? (
        <section className="card stack">
          <h2>¿Qué día?</h2>
          {daysWithSlots.length === 0 ? (
            <p className="muted">No quedan turnos libres en los próximos {clinic.bookingDaysAhead} días. Probá con otro profesional o comunicate con el consultorio.</p>
          ) : (
            <div className="choices">
              {daysWithSlots.map((w) => (
                <Link key={w.ymd} href={`${base}?p=${pro.id}&d=${w.ymd}`} className={`choice${w.ymd === ymd ? " active" : ""}`}>
                  <strong>
                    {weekdayShort(weekdayOf(w.ymd))} {formatYmdShort(w.ymd)}
                  </strong>
                  <span className="muted small">{w.slots.length} horarios libres</span>
                </Link>
              ))}
            </div>
          )}
        </section>
      ) : null}

      {pro && day ? (
        <section className="card stack">
          <h2>¿A qué hora? · {formatYmdLong(day.ymd)}</h2>
          {day.slots.length === 0 ? (
            <p className="muted">Ese día ya no tiene horarios libres.</p>
          ) : (
            <div className="times">
              {day.slots.map((s) => (
                <Link
                  key={s.minutes}
                  href={`${base}?p=${pro.id}&d=${day.ymd}&t=${minutesToHHMM(s.minutes)}`}
                  className={s.minutes === minutes ? "active" : undefined}
                >
                  {minutesToHHMM(s.minutes)}
                </Link>
              ))}
            </div>
          )}
        </section>
      ) : null}

      {pro && day && slot ? (
        <section className="card stack">
          <h2>Tus datos</h2>
          <p>
            Turno con <strong>{pro.name}</strong> el <strong>{formatYmdLong(day.ymd)}</strong> a las{" "}
            <strong>{minutesToHHMM(slot.minutes)}</strong>.
          </p>
          <ActionForm action={bookAction.bind(null, clinic.slug)} className="grid-2">
            <input type="hidden" name="p" value={pro.id} />
            <input type="hidden" name="d" value={day.ymd} />
            <input type="hidden" name="t" value={minutesToHHMM(slot.minutes)} />
            <div className="hp" aria-hidden="true">
              <label>
                No completar <input name="website" tabIndex={-1} autoComplete="off" />
              </label>
            </div>
            <Field label="Nombre y apellido">
              <input name="fullName" required autoComplete="name" />
            </Field>
            <Field label="DNI">
              <input name="dni" required inputMode="numeric" />
            </Field>
            <Field label="Celular (WhatsApp)" hint="Con característica, por ejemplo 381 555-1234">
              <input name="phone" type="tel" required autoComplete="tel" />
            </Field>
            <Field label="Email" hint="Opcional">
              <input name="email" type="email" autoComplete="email" />
            </Field>
            <Field label="Obra social">
              <select name="insuranceId" defaultValue="">
                <option value="">Particular / no sé</option>
                {clinic.insurances.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="N.º de afiliado" hint="Opcional">
              <input name="affiliateNumber" />
            </Field>
            <label className="check span-2 small">
              <input type="checkbox" name="acepto" required /> Acepto que {clinic.name} use estos datos para gestionar mi
              turno y enviarme recordatorios por WhatsApp.
            </label>
            <div className="span-2">
              <SubmitButton className="btn btn-primary">{clinic.bookingAutoConfirm ? "Reservar turno" : "Pedir turno"}</SubmitButton>
            </div>
          </ActionForm>
        </section>
      ) : null}

      <p className="muted small" style={{ textAlign: "center" }}>Turnos online con TurnoClaro</p>
    </main>
  );
}
