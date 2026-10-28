"use client";

import { useState } from "react";
import { Icon } from "./icons";

type Answer = null | "confirma" | "cancela";

/**
 * Simulador para la portada: el visitante hace de paciente y responde el recordatorio.
 * La agenda de al lado cambia sola, como pasa en el sistema real.
 */
export function ReminderDemo() {
  const [answer, setAnswer] = useState<Answer>(null);

  const juan =
    answer === "cancela" ? (
      <div className="slot slot-libre demo-freed" key="libre">
        <span className="t">08:50</span>
        <span className="who">
          <span style={{ color: "var(--pine)" }}>Horario libre: dáselo a otro paciente</span>
        </span>
      </div>
    ) : (
      <div className={`slot slot-turno${answer ? " demo-flash" : ""}`} key={answer ?? "pend"}>
        <span className="t">08:50</span>
        <span className="who">
          <strong>Juan Pérez</strong>
          {answer === "confirma" ? (
            <span className="badge st-confirmado">Confirmado</span>
          ) : (
            <span className="badge st-pendiente">Pendiente</span>
          )}
        </span>
      </div>
    );

  return (
    <div className="demo">
      <div className="sheet">
        <div className="sheet-head">
          <strong>Dra. Valeria Romero</strong>
          <span className="muted small">Mañana · Clínica médica</span>
        </div>
        <ul className="slots" style={{ "--c": "#1f5c4c" } as React.CSSProperties}>
          <li>
            <div className="slot slot-turno">
              <span className="t">08:30</span>
              <span className="who"><strong>María Gómez</strong><span className="badge st-confirmado">Confirmado</span></span>
            </div>
          </li>
          <li>{juan}</li>
          <li>
            <div className="slot slot-turno">
              <span className="t">09:10</span>
              <span className="who"><strong>Lucía Díaz</strong><span className="badge st-solicitado">Solicitud online</span></span>
            </div>
          </li>
          <li>
            <div className="slot slot-turno">
              <span className="t">09:30</span>
              <span className="who"><strong>Diego Sosa</strong><span className="badge st-confirmado">Confirmado</span></span>
            </div>
          </li>
        </ul>
        <p className="demo-status" aria-live="polite">
          {answer === null
            ? "Esperando la respuesta de Juan…"
            : answer === "confirma"
              ? "Juan confirmó. La agenda se actualizó sola."
              : "Juan canceló. El horario quedó libre sin que nadie llame."}
        </p>
      </div>

      <div className="phone">
        <div className="phone-head">
          <span className="phone-avatar">TC</span>
          <span>
            <strong>Consultorios Del Parque</strong>
            <small>en línea</small>
          </span>
        </div>
        <div className="phone-chat">
          <div className="bubble">
            Hola Juan 👋 Te recordamos tu turno con Dra. Valeria Romero mañana a las 08:50. ¿Vas a poder asistir?
            <span className="meta">19:00</span>
          </div>
          {answer ? (
            <div className="bubble me demo-pop">
              {answer === "confirma" ? "Confirmo" : "No puedo ir"}
              <span className="meta">19:04 ✓✓</span>
            </div>
          ) : null}
          {answer ? (
            <div className="bubble demo-pop" style={{ animationDelay: "0.5s" }}>
              {answer === "confirma" ? "¡Gracias! Te esperamos 😊" : "Gracias por avisar. Cuando quieras otro turno, escribinos."}
              <span className="meta">19:04</span>
            </div>
          ) : null}
        </div>
        {answer === null ? (
          <div className="phone-actions">
            <span className="demo-hint">Tocá como si fueras Juan</span>
            <div className="qr">
              <button type="button" onClick={() => setAnswer("confirma")}>Confirmo</button>
              <button type="button" onClick={() => setAnswer("cancela")}>No puedo ir</button>
            </div>
          </div>
        ) : (
          <div className="phone-actions">
            <button type="button" className="btn btn-sm" onClick={() => setAnswer(null)}>
              <Icon name="left" size={14} /> Probar de nuevo
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
