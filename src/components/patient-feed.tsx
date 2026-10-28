import { Icon, type IconName } from "./icons";

const NOTES: { icon: IconName; tone: string; title: string; detail: string; when: string }[] = [
  { icon: "check", tone: "lime", title: "María confirmó su turno", detail: "Mañana 10:30 · Dra. Romero", when: "ahora" },
  { icon: "agenda", tone: "sage", title: "Nuevo turno online", detail: "Juan Pérez · jueves 16:00", when: "hace 1 min" },
  { icon: "whatsapp", tone: "wa", title: "24 recordatorios enviados", detail: "Todos los pacientes de mañana", when: "19:00" },
  { icon: "bell", tone: "bronze", title: "Lucía no puede ir", detail: "Se liberó el turno de las 17:30", when: "hace 3 min" },
];

/** Avisos de pacientes que van apareciendo y flotan (solo CSS, en bucle). */
export function PatientFeed() {
  return (
    <ul className="feed" aria-label="Ejemplos de avisos de pacientes">
      {NOTES.map((n, i) => (
        <li key={n.title} className="note" style={{ "--i": i } as React.CSSProperties}>
          <div className="note-in">
            <span className={`note-ico tone-${n.tone}`}>
              <Icon name={n.icon} size={18} />
            </span>
            <span className="note-text">
              <strong>{n.title}</strong>
              <span>{n.detail}</span>
            </span>
            <span className="note-when">{n.when}</span>
          </div>
        </li>
      ))}
    </ul>
  );
}
