/**
 * Datos comerciales de TurnoClaro: nombre, contacto y precios de la página de inicio.
 * Cambiá estos valores y se actualizan en todo el sitio.
 */
export const BRAND = {
  name: "TurnoClaro",
  // Tu WhatsApp como vendedor (solo números, con 549 adelante).
  salesWhatsapp: "5493815867891",
  salesMessage: "Hola! Quiero probar TurnoClaro en mi consultorio.",
  city: "Tucumán",
};

export type Plan = {
  name: string;
  who: string;
  price: string;
  pitch: string;
  features: string[];
  featured?: boolean;
  badge?: string;
};

// Precios mensuales en pesos, más IVA.
// Los recordatorios "con un toque" salen del WhatsApp del consultorio y no tienen costo.
// El envío automático se cobra aparte (ver WHATSAPP_EXTRAS).
export const PLANS: Plan[] = [
  {
    name: "Profesional",
    who: "1 profesional",
    price: "39.900",
    pitch: "Para quien atiende solo y maneja su propia agenda.",
    features: [
      "Agenda y ficha de pacientes",
      "Recordatorios por WhatsApp con un toque, sin límite",
      "Reserva online con link propio",
      "El paciente confirma o cancela con un toque",
      "Soporte por WhatsApp",
    ],
  },
  {
    name: "Consultorio",
    who: "Hasta 4 profesionales con secretaría",
    price: "89.900",
    pitch: "Para equipos que comparten secretaría y agenda.",
    featured: true,
    badge: "El más elegido",
    features: [
      "Todo lo del plan Profesional",
      "Las agendas de todos en una sola pantalla",
      "Usuarios con roles: administración, secretaría y profesional",
      "Reportes de ausentismo por profesional",
      "Carga inicial de pacientes y capacitación",
    ],
  },
  {
    name: "Clínica",
    who: "5 a 10 profesionales",
    price: "169.900",
    pitch: "Para centros con varias especialidades y mucho movimiento.",
    features: [
      "Todo lo del plan Consultorio",
      "Agenda de hasta 10 profesionales",
      "Importación de pacientes desde Excel",
      "Capacitación para todo el equipo",
      "Soporte prioritario",
    ],
  },
];

/**
 * Extras del envío automático por WhatsApp (precios en pesos, más IVA).
 * Cada recordatorio automático le cuesta a TurnoClaro lo que cobra Meta
 * (≈ $37,68 desde el 1/10/2026): los packs tienen que quedar por encima de eso.
 */
export const WHATSAPP_EXTRAS = {
  /** Configuración de la cuenta propia de WhatsApp del consultorio (pago único). */
  activationPrice: "60.000",
  packs: [
    { reminders: 500, price: "39.900" },
    { reminders: 1000, price: "74.900" },
    { reminders: 2500, price: "174.900" },
  ],
};

export function salesWhatsappLink(message: string = BRAND.salesMessage): string {
  return `https://wa.me/${BRAND.salesWhatsapp}?text=${encodeURIComponent(message)}`;
}
