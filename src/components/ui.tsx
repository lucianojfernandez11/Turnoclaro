import type { AppointmentStatus } from "@prisma/client";
import { STATUS_LABEL } from "@/lib/labels";
import type { ReactNode } from "react";
import Link from "next/link";
import { Glass } from "./glass";

export function StatusBadge({ status }: { status: AppointmentStatus }) {
  return <span className={`badge st-${status.toLowerCase()}`}>{STATUS_LABEL[status]}</span>;
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="page-head">
      <div>
        <h1>{title}</h1>
        {subtitle ? <p className="muted">{subtitle}</p> : null}
      </div>
      {actions ? <div className="page-actions">{actions}</div> : null}
    </header>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="empty">{children}</p>;
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint ? <small className="muted">{hint}</small> : null}
    </label>
  );
}

/**
 * Encabezado de vidrio verde para las pantallas principales del panel.
 * "chips" son fichas flotantes con números o datos cortos.
 */
export function PanelHero({
  eyebrow,
  title,
  subtitle,
  actions,
  chips,
  quote,
}: {
  quote?: string;
  eyebrow?: string;
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  chips?: { value: ReactNode; label: string; tone?: "lime" | "plain"; href?: string; active?: boolean; hint?: string }[];
}) {
  return (
    <header className="frame panel-hero">
      <Glass calm />
      <div className="panel-hero-top">
        <div className="panel-hero-text">
          {eyebrow ? <span className="tag">{eyebrow}</span> : null}
          <h1>{title}</h1>
          {subtitle ? <p>{subtitle}</p> : null}
          {quote ? (
            <blockquote className="hero-quote">
              <span aria-hidden="true">✦</span> {quote}
            </blockquote>
          ) : null}
        </div>
        {actions ? <div className="page-actions">{actions}</div> : null}
      </div>
      {chips && chips.length ? (
        <ul className="hero-chips">
          {chips.map((c, i) => (
            <li
              key={c.label}
              className={[c.tone === "lime" ? "is-lime" : "", c.href ? "is-link" : "", c.active ? "is-active" : ""].filter(Boolean).join(" ") || undefined}
              style={{ "--i": i } as React.CSSProperties}
            >
              {c.href ? (
                <Link href={c.href} scroll={false} aria-current={c.active ? "true" : undefined}>
                  <b>{c.value}</b>
                  <span>{c.label}</span>
                  <em aria-hidden="true">{c.active ? "Cerrar" : c.hint ?? "Ver"} →</em>
                </Link>
              ) : (
                <>
                  <b>{c.value}</b>
                  <span>{c.label}</span>
                </>
              )}
            </li>
          ))}
        </ul>
      ) : null}
    </header>
  );
}

const AVATAR_TONES = ["tone-sage", "tone-lime", "tone-bronze", "tone-wa", "tone-info"];

/** Círculo con las iniciales; el color sale siempre igual para el mismo nombre. */
export function Avatar({ name, size = 34 }: { name: string; size?: number }) {
  const parts = name.replace(/,/g, " ").trim().split(/\s+/).filter(Boolean);
  const initials = ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return (
    <span className={`avatar ${AVATAR_TONES[h % AVATAR_TONES.length]}`} style={{ width: size, height: size }} aria-hidden="true">
      {initials || "?"}
    </span>
  );
}

/** Saludo según la hora local del consultorio. */
export function greeting(minutes: number): string {
  if (minutes < 12 * 60) return "Buen día";
  if (minutes < 20 * 60) return "Buenas tardes";
  return "Buenas noches";
}
