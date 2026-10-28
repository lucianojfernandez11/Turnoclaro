import Link from "next/link";
import type { Metadata } from "next";
import { requireUser, professionalScope, canSeeAllAgendas } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { param } from "@/lib/forms";
import { loadDay, slotsForProfessional, localMinutes } from "@/lib/appointments";
import { addDays, formatYmdLong, formatYmdShort, isYmd, minutesToHHMM, todayYmd, weekdayOf, weekdayShort, dayRangeUtc, utcToZoned } from "@/lib/tz";
import { firstName } from "@/lib/template";
import { StatusBadge, PageHeader, Empty, PanelHero, greeting } from "@/components/ui";
import { Icon } from "@/components/icons";
import { AutoSubmitDate } from "@/components/client-buttons";

export const metadata: Metadata = { title: "Agenda" };

type SP = Promise<Record<string, string | string[] | undefined>>;

export default async function AgendaPage({ searchParams }: { searchParams: SP }) {
  const user = await requireUser();
  const sp = await searchParams;
  const tz = user.clinic.timezone;
  const today = todayYmd(tz);
  const fechaParam = param(sp.fecha);
  const ymd = fechaParam && isYmd(fechaParam) ? fechaParam : today;
  const profFilter = param(sp.prof) ?? "";
  const showCancelled = param(sp.cancelados) === "1";
  const highlight = param(sp.nuevo);

  const allPros = await prisma.professional.findMany({
    where: { ...professionalScope(user), active: true },
    orderBy: { name: "asc" },
  });
  if (allPros.length === 0) {
    return (
      <div className="stack">
        <PageHeader title="Agenda" />
        <div className="card">
          {canSeeAllAgendas(user) ? (
            <Empty>
              Todavía no hay profesionales cargados.{" "}
              {user.role === "ADMIN" ? <Link href="/panel/ajustes/profesionales">Cargalos en Ajustes</Link> : "Pedile a la administración que los cargue."}
            </Empty>
          ) : (
            <Empty>Tu usuario no está vinculado a ninguna agenda. Pedile a la administración que lo vincule.</Empty>
          )}
        </div>
      </div>
    );
  }
  const pros = profFilter ? allPros.filter((p) => p.id === profFilter) : allPros;
  const now = new Date();
  const day = await loadDay({ clinicId: user.clinic.id, timeZone: tz, ymd, professionalIds: pros.map((p) => p.id), now });

  // Cantidad de turnos por día de la semana visible (tira de días).
  const stripStart = addDays(ymd, -((weekdayOf(ymd) + 6) % 7)); // lunes
  const strip = Array.from({ length: 7 }, (_, i) => addDays(stripStart, i));
  const weekRange = { from: dayRangeUtc(strip[0], tz).from, to: dayRangeUtc(strip[6], tz).to };
  const weekAppts = await prisma.appointment.findMany({
    where: {
      clinicId: user.clinic.id,
      professionalId: { in: pros.map((p) => p.id) },
      status: { not: "CANCELADO" },
      startsAt: { gte: weekRange.from, lt: weekRange.to },
    },
    select: { startsAt: true },
  });
  const perDay = new Map<string, number>();
  for (const a of weekAppts) {
    const d = strip.find((s) => {
      const r = dayRangeUtc(s, tz);
      return a.startsAt >= r.from && a.startsAt < r.to;
    });
    if (d) perDay.set(d, (perDay.get(d) ?? 0) + 1);
  }

  const active = day.appointments.filter((a) => a.status !== "CANCELADO");
  const stats = {
    total: active.length,
    confirmados: active.filter((a) => a.status === "CONFIRMADO").length,
    pendientes: active.filter((a) => a.status === "PENDIENTE").length,
    solicitudes: active.filter((a) => a.status === "SOLICITADO").length,
  };

  const isToday = ymd === today;
  const nowMin = utcToZoned(now, tz).minutes;

  const qs = (extra: Record<string, string>) => {
    const p = new URLSearchParams({ fecha: ymd, ...(profFilter ? { prof: profFilter } : {}), ...(showCancelled ? { cancelados: "1" } : {}), ...extra });
    for (const [k, v] of [...p.entries()]) if (!v) p.delete(k);
    return `/panel/agenda?${p.toString()}`;
  };

  return (
    <div className="stack" style={{ gap: 0 }}>
      <PanelHero
        eyebrow={`Agenda · ${formatYmdLong(ymd)}${isToday ? " · hoy" : ""}`}
        title={isToday ? `${greeting(nowMin)}, ${firstName(user.name)}` : `Agenda del ${formatYmdLong(ymd)}`}
        subtitle={
          stats.total === 0
            ? "No hay turnos dados para este día."
            : stats.pendientes + stats.solicitudes === 0
              ? "Todos los turnos están confirmados."
              : `Quedan ${stats.pendientes} sin confirmar${stats.solicitudes ? ` y ${stats.solicitudes} ${stats.solicitudes === 1 ? "solicitud online" : "solicitudes online"} para revisar` : ""}.`
        }
        actions={
          <Link className="cta" href={`/panel/turnos/nuevo?fecha=${ymd}${profFilter ? `&prof=${profFilter}` : ""}`}>
            <span className="cta-label">Nuevo turno</span>
            <span className="cta-arrow"><Icon name="plus" /></span>
          </Link>
        }
        chips={[
          { value: stats.total, label: "Turnos del día" },
          { value: stats.confirmados, label: "Confirmados", tone: "lime" },
          { value: stats.pendientes, label: "Sin confirmar" },
          { value: stats.solicitudes, label: "Solicitudes online" },
        ]}
      />

      {/* Barra de navegación: día, profesionales y cancelados */}
      <section className="agenda-bar" aria-label="Elegir día y profesional">
        <div className="agenda-bar-row">
          <div className="agenda-date">
            <span className="agenda-date-label">{isToday ? "Hoy" : "Día elegido"}</span>
            <strong>{formatYmdLong(ymd)}</strong>
          </div>
          <div className="agenda-nav">
            <Link className="btn" href={qs({ fecha: addDays(ymd, -1) })}>
              <Icon name="left" size={16} /> Anterior
            </Link>
            {!isToday ? (
              <Link className="btn btn-primary-soft" href={qs({ fecha: today })}>Volver a hoy</Link>
            ) : null}
            <Link className="btn" href={qs({ fecha: addDays(ymd, 1) })}>
              Siguiente <Icon name="right" size={16} />
            </Link>
            <form action="/panel/agenda" className="agenda-pick">
              <label>
                <span>Ir a otra fecha</span>
                <AutoSubmitDate name="fecha" defaultValue={ymd} label="Ir a otra fecha" />
              </label>
              {profFilter ? <input type="hidden" name="prof" value={profFilter} /> : null}
              {showCancelled ? <input type="hidden" name="cancelados" value="1" /> : null}
              <noscript><button className="btn btn-sm" type="submit">Ir</button></noscript>
            </form>
          </div>
        </div>

        <nav className="week" aria-label="Días de la semana">
          {strip.map((d) => (
            <Link
              key={d}
              href={qs({ fecha: d })}
              className={[d === ymd ? "active" : "", d === today ? "today" : ""].join(" ").trim() || undefined}
              aria-current={d === ymd ? "date" : undefined}
            >
              <small>{d === today ? "Hoy" : weekdayShort(weekdayOf(d))}</small>
              <b>{formatYmdShort(d).split("/")[0]}</b>
              <i>{perDay.get(d) ? `${perDay.get(d)} ${perDay.get(d) === 1 ? "turno" : "turnos"}` : "Sin turnos"}</i>
            </Link>
          ))}
        </nav>

        {allPros.length > 1 || showCancelled || day.appointments.some((a) => a.status === "CANCELADO") ? (
          <div className="agenda-bar-row agenda-filters">
            {allPros.length > 1 ? (
              <div className="pro-chips" role="group" aria-label="Ver la agenda de">
                <span className="pro-chips-label">Ver agenda de</span>
                <Link className={`pro-chip${!profFilter ? " on" : ""}`} href={qs({ prof: "" })} aria-current={!profFilter ? "true" : undefined}>
                  Todos
                </Link>
                {allPros.map((p) => (
                  <Link
                    key={p.id}
                    className={`pro-chip${profFilter === p.id ? " on" : ""}`}
                    href={qs({ prof: p.id })}
                    style={{ "--c": p.color } as React.CSSProperties}
                    aria-current={profFilter === p.id ? "true" : undefined}
                  >
                    <i aria-hidden="true" /> {p.name}
                  </Link>
                ))}
              </div>
            ) : <span />}
            <Link className={`switch-link${showCancelled ? " on" : ""}`} href={qs({ cancelados: showCancelled ? "" : "1" })} role="switch" aria-checked={showCancelled}>
              <span className="switch" aria-hidden="true" /> Mostrar cancelados
            </Link>
          </div>
        ) : null}
      </section>

      {/* Referencias: qué significa cada color */}
      <ul className="legend" aria-label="Referencias">
        <li><span className="badge st-confirmado">Confirmado</span> el paciente dijo que viene</li>
        <li><span className="badge st-pendiente">Sin confirmar</span> falta que responda</li>
        <li><span className="badge st-solicitado">Solicitud online</span> la pidió por internet, hay que aceptarla</li>
        <li><span className="legend-free">+ Dar turno</span> horario libre: tocalo para agendar</li>
      </ul>

      <div className="columns">
        {pros.map((p) => {
          const slots = slotsForProfessional({ ymd, timeZone: tz, professional: p, ...day, now });
          const appts = day.appointments.filter((a) => a.professionalId === p.id && (showCancelled || a.status !== "CANCELADO"));
          type Item =
            | { key: string; minutes: number; kind: "appt"; appt: (typeof appts)[number] }
            | { key: string; minutes: number; kind: "slot"; slot: (typeof slots)[number] }
            | { key: string; minutes: number; kind: "now" };
          const order = { appt: 0, slot: 1, now: 2 } as const;
          const items: Item[] = [
            ...appts.map((a) => ({ key: a.id, minutes: localMinutes(a.startsAt, tz), kind: "appt" as const, appt: a })),
            ...slots
              .filter((s) => s.state !== "ocupado")
              .map((s) => ({ key: `s${s.minutes}`, minutes: s.minutes, kind: "slot" as const, slot: s })),
          ];
          if (isToday && items.length && nowMin >= Math.min(...items.map((i) => i.minutes)) && nowMin <= Math.max(...items.map((i) => i.minutes)) + p.slotMinutes) {
            items.push({ key: "now", minutes: nowMin, kind: "now" });
          }
          items.sort((a, b) => a.minutes - b.minutes || order[a.kind] - order[b.kind]);
          const nTurnos = appts.filter((a) => a.status !== "CANCELADO").length;
          const nLibres = slots.filter((s) => s.state === "libre").length;

          return (
            <section key={p.id} className="col" style={{ "--c": p.color } as React.CSSProperties}>
              <div className="col-head">
                <div>
                  <strong>{p.name}</strong>
                  <span>{p.specialty} · turnos de {p.slotMinutes} min</span>
                </div>
                {items.length ? (
                  <div className="col-count">
                    <span><b>{nTurnos}</b> {nTurnos === 1 ? "turno" : "turnos"}</span>
                    <span><b>{nLibres}</b> {nLibres === 1 ? "libre" : "libres"}</span>
                  </div>
                ) : null}
              </div>
              {items.length === 0 ? (
                <div className="col-empty">
                  <Icon name="agenda" size={22} />
                  <p>No atiende este día.</p>
                </div>
              ) : (
                <ul className="slots">
                  {items.map((it) =>
                    it.kind === "now" ? (
                      <li key={it.key} className="now-line" aria-label={`Ahora, ${minutesToHHMM(it.minutes)}`}>
                        <span>Ahora · {minutesToHHMM(it.minutes)}</span>
                      </li>
                    ) : it.kind === "appt" ? (
                      <li key={it.key}>
                        <Link
                          href={`/panel/turnos/${it.appt.id}`}
                          className={`slot slot-turno${it.appt.status === "CANCELADO" ? " slot-cancelado" : ""}${it.appt.id === highlight ? " is-new" : ""}`}
                        >
                          <span className="t">{minutesToHHMM(it.minutes)}</span>
                          <span className="who">
                            <strong>{it.appt.patient.fullName}</strong>
                            <span className="who-meta">
                              <StatusBadge status={it.appt.status} />
                              {it.appt.overbook ? <span className="tag-sobre">Sobreturno</span> : null}
                              {it.appt.patient.insurance ? <span className="who-os">{it.appt.patient.insurance.name}</span> : null}
                            </span>
                          </span>
                          <span className="go" aria-hidden="true"><Icon name="right" size={16} /></span>
                        </Link>
                      </li>
                    ) : it.slot.state === "bloqueado" ? (
                      <li key={it.key}>
                        <div className="slot slot-bloqueado">
                          <span className="t">{minutesToHHMM(it.minutes)}</span>
                          <span>No disponible{it.slot.blockReason ? ` · ${it.slot.blockReason}` : ""}</span>
                        </div>
                      </li>
                    ) : it.slot.state === "pasado" ? (
                      <li key={it.key}>
                        <div className="slot slot-libre slot-pasado">
                          <span className="t">{minutesToHHMM(it.minutes)}</span>
                          <span>Libre · ya pasó</span>
                        </div>
                      </li>
                    ) : (
                      <li key={it.key}>
                        <Link
                          href={`/panel/turnos/nuevo?prof=${p.id}&fecha=${ymd}&hora=${minutesToHHMM(it.minutes)}`}
                          className="slot slot-libre"
                          aria-label={`Dar turno a las ${minutesToHHMM(it.minutes)} con ${p.name}`}
                        >
                          <span className="t">{minutesToHHMM(it.minutes)}</span>
                          <span className="free"><Icon name="plus" size={14} /> Dar turno</span>
                        </Link>
                      </li>
                    ),
                  )}
                </ul>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
