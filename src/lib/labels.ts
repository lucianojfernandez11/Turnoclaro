// Textos para mostrar. Sin imports del servidor, así se pueden usar en componentes de cliente.
import type { AppointmentStatus } from "@prisma/client";

export const STATUS_LABEL: Record<AppointmentStatus, string> = {
  SOLICITADO: "Solicitud online",
  PENDIENTE: "Sin confirmar",
  CONFIRMADO: "Confirmado",
  ATENDIDO: "Atendido",
  AUSENTE: "Ausente",
  CANCELADO: "Cancelado",
};
