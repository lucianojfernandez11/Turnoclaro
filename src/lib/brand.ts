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

/**
 * Datos del desarrollador que aparecen al pie de la página de inicio.
 * Los campos vacíos ("") no se muestran: completá los que quieras publicar.
 */
export const DEV = {
  name: "Luciano Fernández",
  role: "Desarrollador full stack",
  city: "Tucumán, Argentina",
  whatsapp: "5493815867891",
  email: "luchoofernandez11@gmail.com",
  github: "", // ej. "https://github.com/tu-usuario"
  linkedin: "", // ej. "https://www.linkedin.com/in/tu-usuario"
  instagram: "", // ej. "https://www.instagram.com/tu-usuario"
  portfolio: "", // ej. "https://tusitio.com"
};

export type Plan = {
  name: string;
  who: string;
  price: string;
  /** Precio por profesional, para mostrar el ahorro en los planes grandes. */
  perPro?: string;
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
    price: "80.000",
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
    price: "120.000",
    perPro: "30.000",
    pitch: "Para equipos que comparten secretaría y agenda.",
    featured: true,
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
    price: "250.000",
    perPro: "25.000",
    pitch: "Para centros con varias especialidades y mucho movimiento.",
    features: [
      "Todo lo del plan Consultorio",
      "500 recordatorios automáticos por mes incluidos",
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
    // Cuanto más grande el pack, más barato sale cada recordatorio ($80, $75 y $70).
    { reminders: 500, price: "40.000", fits: "Ideal para 1 profesional" },
    { reminders: 1000, price: "75.000", fits: "Para 2 o 3 profesionales" },
    { reminders: 2500, price: "175.000", fits: "Para consultorios y clínicas" },
  ],
};

/** Precio de cada recordatorio dentro de un pack, ej. "80". */
export function pricePerReminder(pack: { reminders: number; price: string }): string {
  const total = Number(pack.price.replace(/\./g, ""));
  return Math.round(total / pack.reminders).toLocaleString("es-AR");
}

export function salesWhatsappLink(message: string = BRAND.salesMessage): string {
  return `https://wa.me/${BRAND.salesWhatsapp}?text=${encodeURIComponent(message)}`;
}
