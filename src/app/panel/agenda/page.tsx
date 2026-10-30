import Link from "next/link";
import type { Metadata } from "next";
import { requireUser, professionalScope, canSeeAllAgendas } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { param } from "@/lib/forms";
import { loadDay, slotsForProfessional, localMinutes } from "@/lib/appointments";
import { addDays, formatYmdLong, formatYmdShort, isYmd, minutesToHHMM, todayYmd, weekdayOf, dayRangeUtc, utcToZoned } from "@/lib/tz";
import { firstName } from "@/lib/template";
import { fraseDelDia } from "@/lib/frases";
import { StatusBadge, PageHeader, Empty, PanelHero, Avatar, greeting } from "@/components/ui";
import { Icon } from "@/components/icons";
import { AutoSubmitDate, RememberOpen } from "@/components/client-buttons";

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
  const WEEKDAY_NAME = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
  const VER = ["todos", "confirmados", "sin-confirmar"] as const;
  const ver = (VER as readonly string[]).includes(param(sp.ver) ?? "") ? (param(sp.ver) as (typeof VER)[number]) : null;

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

  // Cantidad de turnos por día de la semana visible (tira de días).
  const stripStart = addDays(ymd, -((weekdayOf(ymd) + 6) % 7)); // lunes
  const strip = Array.from({ length: 7 }, (_, i) => addDays(stripStart, i));
  const weekRange = { from: dayRangeUtc(strip[0], tz).from, to: dayRangeUtc(strip[6], tz).to };
  // El día y la semana se piden a la base al mismo tiempo (un solo viaje de ida y vuelta).
  const [day, weekAppts] = await Promise.all([
    loadDay({ clinicId: user.clinic.id, timeZone: tz, ymd, professionalIds: pros.map((p) => p.id), now }),
    prisma.appointment.findMany({
      where: {
        clinicId: user.clinic.id,
        professionalId: { in: pros.map((p) => p.id) },
        status: { not: "CANCELADO" },
        startsAt: { gte: weekRange.from, lt: weekRange.to },
      },
      select: { startsAt: true },
    }),
  ]);
  const perDay = new Map<string, number>();
  for (const a of weekAppts) {
    const d = strip.find((s) => {
      const r = dayRangeUtc(s, tz);
      return a.startsAt >= r.from && a.startsAt < r.to;
    });
    if (d) perDay.set(d, (perDay.get(d) ?? 0) + 1);
  }

  // Pestañas: lunes a viernes, más sábado/domingo solo si alguien atiende o es el día elegido.
  const prosPerWeekday = new Map<number, number>();
  for (let w = 1; w <= 7; w++) {
    prosPerWeekday.set(w, new Set(day.schedules.filter((sc) => sc.weekday === w).map((sc) => sc.professionalId)).size);
  }
  const weekTabs = strip.filter((d) => {
    const w = weekdayOf(d);
    return w <= 5 || d === ymd || (prosPerWeekday.get(w) ?? 0) > 0;
  });
  // Profesionales del día: los que tienen horario ese día o algún turno cargado igual.
  const wd = weekdayOf(ymd);
  const attending = pros.filter(
    (p) => day.schedules.some((sc) => sc.professionalId === p.id && sc.weekday === wd) || day.appointments.some((a) => a.professionalId === p.id),
  );
  const notAttending = pros.filter((p) => !attending.includes(p));

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
    const p = new URLSearchParams({ fecha: ymd, ...(profFilter ? { prof: profFilter } : {}), ...(showCancelled ? { cancelados: "1" } : {}), ...(ver ? { ver } : {}), ...extra });
    for (const [k, v] of [...p.entries()]) if (!v) p.delete(k);
    return `/panel/agenda?${p.toString()}`;
  };

  return (
    <div className="stack" style={{ gap: 0 }}>
      <PanelHero
        eyebrow={`Agenda · ${formatYmdLong(ymd)}${isToday ? " · hoy" : ""}`}
        title={isToday ? `${greeting(nowMin)}, ${firstName(user.name)}` : `Agenda del ${formatYmdLong(ymd)}`}
        quote={fraseDelDia(today)}
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
          { value: stats.total, label: "Turnos del día", href: qs({ ver: ver === "todos" ? "" : "todos" }) + "#detalle", active: ver === "todos", hint: "Ver lista" },
          { value: stats.confirmados, label: "Confirmados", tone: "lime", href: qs({ ver: ver === "confirmados" ? "" : "confirmados" }) + "#detalle", active: ver === "confirmados", hint: "Ver quiénes" },
          { value: stats.pendientes, label: "Sin confirmar", href: qs({ ver: ver === "sin-confirmar" ? "" : "sin-confirmar" }) + "#detalle", active: ver === "sin-confirmar", hint: "Ver y avisar" },
          { value: stats.solicitudes, label: "Solicitudes online", href: "/panel/solicitudes", hint: "Revisar" },
        ]}
      />

      {ver ? (() => {
        const proById = new Map(pros.map((p) => [p.id, p]));
        const list = active
          .filter((a) => ver === "todos" || (ver === "confirmados" ? a.status === "CONFIRMADO" : a.status === "PENDIENTE"))
          .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
        const title = ver === "todos" ? "Todos los turnos del día" : ver === "confirmados" ? "Turnos confirmados" : "Turnos sin confirmar";
        return (
          <section id="detalle" className={`day-detail day-detail-${ver}`} aria-label={title}>
            <div className="day-detail-head">
              <div>
                <h2>{title}</h2>
                <p>
                  {list.length} {list.length === 1 ? "turno" : "turnos"} · {formatYmdLong(ymd)}
                </p>
              </div>
              <div className="row">
                {ver === "sin-confirmar" && list.length ? (
                  <Link className="btn btn-wa btn-sm" href={`/panel/recordatorios?fecha=${ymd}`}>
                    <Icon name="whatsapp" size={15} /> Mandar recordatorios
                  </Link>
                ) : null}
                <Link className="btn btn-sm" href={qs({ ver: "" })} scroll={false} aria-label="Cerrar la lista">
                  <Icon name="close" size={15} />
                </Link>
              </div>
            </div>
            {list.length === 0 ? (
              <p className="day-detail-empty">
                {ver === "sin-confirmar" ? "¡Bien! No queda ningún turno sin confirmar." : ver === "confirmados" ? "Todavía nadie confirmó para este día." : "No hay turnos dados para este día."}
              </p>
            ) : (
              <ul className="day-detail-list">
                {list.map((a, i) => {
                  const pro = proById.get(a.professionalId);
                  return (
                    <li key={a.id} style={{ "--i": i, "--c": pro?.color } as React.CSSProperties}>
                      <Link href={`/panel/turnos/${a.id}`}>
                        <span className="dd-time">{minutesToHHMM(localMinutes(a.startsAt, tz))}</span>
                        <Avatar name={a.patient.fullName} />
                        <span className="dd-who">
                          <strong>{a.patient.fullName}</strong>
                          <span>{pro?.name ?? ""}{a.patient.insurance ? ` · ${a.patient.insurance.name}` : ""}</span>
                        </span>
                        <StatusBadge status={a.status} />
                        <Icon name="right" size={16} />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        );
      })() : null}

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

        <nav className="week week-tabs" aria-label="Días de la semana">
          {weekTabs.map((d) => {
            const n = prosPerWeekday.get(weekdayOf(d)) ?? 0;
            return (
              <Link
                key={d}
                href={qs({ fecha: d })}
                className={[d === ymd ? "active" : "", d === today ? "today" : "", n === 0 ? "off" : ""].join(" ").trim() || undefined}
                aria-current={d === ymd ? "date" : undefined}
              >
                <small>{d === today ? "Hoy" : WEEKDAY_NAME[weekdayOf(d) - 1]} {formatYmdShort(d).split("/")[0]}</small>
                <b>{n === 0 ? "—" : n}</b>
                <i>
                  {n === 0 ? "Nadie atiende" : n === 1 ? "profesional" : "profesionales"}
                  {perDay.get(d) ? ` · ${perDay.get(d)} ${perDay.get(d) === 1 ? "turno" : "turnos"}` : ""}
                </i>
              </Link>
            );
          })}
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

      <RememberOpen key={`${ymd}-${profFilter}`} storageKey="tc-agenda-abiertas" />
      {attending.length === 0 ? (
        <div className="card col-empty">
          <Icon name="agenda" size={22} />
          <p>Ningún profesional atiende el {formatYmdLong(ymd)}.</p>
        </div>
      ) : null}
      <div className="columns pro-cards">
        {attending.map((p) => {
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
          const nextFree = slots.find((s) => s.state === "libre");

          return (
            <details
              key={p.id}
              className="col pro-card"
              style={{ "--c": p.color } as React.CSSProperties}
              data-remember={p.id}
              open={attending.length === 1 || appts.some((a) => a.id === highlight) || undefined}
            >
              <summary className="col-head">
                <div>
                  <strong>{p.name}</strong>
                  <span>{p.specialty} · turnos de {p.slotMinutes} min</span>
                  {nextFree ? (
                    <em className="next-free">
                      <i aria-hidden="true" /> Próximo libre {minutesToHHMM(nextFree.minutes)}
                    </em>
                  ) : items.length ? (
                    <em className="next-free is-full">Sin horarios libres</em>
                  ) : null}
                </div>
                <div className="pro-card-side">
                  {items.length ? (
                    <div className="col-count">
                      <span><b>{nTurnos}</b> {nTurnos === 1 ? "turno" : "turnos"}</span>
                      <span><b>{nLibres}</b> {nLibres === 1 ? "libre" : "libres"}</span>
                    </div>
                  ) : null}
                  <span className="pro-card-toggle" aria-hidden="true">
                    <span className="when-closed">Ver agenda</span>
                    <span className="when-open">Ocultar</span>
                    <Icon name="right" size={16} />
                  </span>
                </div>
              </summary>
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
                          style={{ "--k": Math.round(it.minutes / 10) % 6 } as React.CSSProperties}
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
            </details>
          );
        })}
      </div>
      {notAttending.length ? (
        <p className="not-attending">
          <Icon name="agenda" size={15} /> No atienden este día: {notAttending.map((p) => p.name).join(", ")}
        </p>
      ) : null}
    </div>
  );
}
