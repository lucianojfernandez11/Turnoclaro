"use client";

import { useState, useTransition } from "react";

/**
 * Abre WhatsApp con el mensaje escrito y, en paralelo, registra el envío manual.
 * La ventana se abre primero (dentro del clic) para que el navegador no la bloquee.
 */
export function ManualWhatsappButton({
  href,
  onSent,
  label = "Enviar por WhatsApp",
  className = "btn btn-wa btn-sm",
}: {
  href: string;
  onSent?: () => Promise<void>;
  label?: string;
  className?: string;
}) {
  const [pending, start] = useTransition();
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className={className}
      disabled={pending}
      onClick={() => {
        window.open(href, "_blank", "noopener,noreferrer");
        if (onSent) start(async () => {
          await onSent();
          setDone(true);
        });
      }}
    >
      {done ? "Abierto ✓" : label}
    </button>
  );
}

/** Botón de envío que pide confirmación antes (para acciones que no se deshacen). */
export function ConfirmSubmit({
  message,
  children,
  className = "btn btn-danger",
}: {
  message: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="submit"
      className={className}
      onClick={(e) => {
        if (!window.confirm(message)) e.preventDefault();
      }}
    >
      {children}
    </button>
  );
}

export function CopyButton({ text, label = "Copiar" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="btn btn-sm"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1800);
        } catch {
          window.prompt("Copiá el texto:", text);
        }
      }}
    >
      {copied ? "Copiado ✓" : label}
    </button>
  );
}

/** Campo de fecha que cambia de día apenas se elige, sin botón "Ir". */
export function AutoSubmitDate({ name, defaultValue, label }: { name: string; defaultValue: string; label: string }) {
  return (
    <input
      type="date"
      name={name}
      defaultValue={defaultValue}
      aria-label={label}
      onChange={(e) => {
        if (e.currentTarget.value) e.currentTarget.form?.requestSubmit();
      }}
    />
  );
}
