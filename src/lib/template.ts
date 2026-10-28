/** Mensajes de WhatsApp con variables {paciente}, {fecha}, etc. */

export const DEFAULT_REMINDER_TEMPLATE =
  "Hola {paciente} 👋 Te recordamos tu turno con {profesional} el {fecha} a las {hora} en {consultorio}{direccion}.\n\n" +
  "Confirmalo o cancelalo desde este link: {link}\n\n¡Gracias!";

export const TEMPLATE_VARIABLES = ["paciente", "profesional", "fecha", "hora", "consultorio", "direccion", "link"] as const;

export type TemplateValues = Record<(typeof TEMPLATE_VARIABLES)[number], string>;

export function renderTemplate(template: string | null | undefined, values: TemplateValues): string {
  const source = template && template.trim() ? template : DEFAULT_REMINDER_TEMPLATE;
  return source.replace(/\{(\w+)\}/g, (match, key: string) =>
    Object.prototype.hasOwnProperty.call(values, key) ? values[key as keyof TemplateValues] : match,
  );
}

/** Primer nombre para un saludo más cercano: "Pérez, Juan" o "Juan Pérez" → "Juan". */
export function firstName(fullName: string): string {
  const clean = fullName.trim();
  if (clean.includes(",")) return clean.split(",")[1]?.trim().split(/\s+/)[0] || clean;
  return clean.split(/\s+/)[0] || clean;
}

/** Interpreta una respuesta escrita del paciente ("si", "Sí, confirmo", "no puedo"). */
export function parseReplyText(text: string): "CONFIRMA" | "CANCELA" | null {
  const t = text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
  if (/^(no\b|cancel|no puedo|no voy)/.test(t)) return "CANCELA";
  if (/^(si\b|sii*\b|confirm|ok\b|dale\b|voy\b|ahi estare)/.test(t)) return "CONFIRMA";
  return null;
}
