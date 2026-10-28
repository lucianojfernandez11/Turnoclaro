/**
 * Teléfonos argentinos al formato que pide WhatsApp: 549 + característica + número, sin el 15.
 * Ejemplos: "381 15 586-7891" → "5493815867891"; "+54 9 11 2345-6789" → "5491123456789".
 */
export function normalizeArPhone(input: string | null | undefined, defaultAreaCode = "381"): string | null {
  if (!input) return null;
  let digits = String(input).replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("00")) digits = digits.slice(2);

  let national: string;
  if (digits.startsWith("54") && digits.length >= 12) {
    national = digits.slice(2);
    if (national.startsWith("9")) national = national.slice(1);
  } else {
    national = digits;
  }
  if (national.startsWith("0")) national = national.slice(1);

  // Número local sin característica: "15 5867891" o "5867891".
  const area = defaultAreaCode.replace(/\D/g, "").replace(/^0/, "");
  if (national.startsWith("15") && national.length - 2 + area.length === 10) {
    national = area + national.slice(2);
  } else if (national.length + area.length === 10 && national.length <= 8) {
    national = area + national;
  }

  // Característica + 15 + número (12 dígitos): se saca el 15.
  if (national.length === 12) {
    for (const areaLen of [2, 3, 4]) {
      if (national.slice(areaLen, areaLen + 2) === "15") {
        national = national.slice(0, areaLen) + national.slice(areaLen + 2);
        break;
      }
    }
  }

  if (national.length !== 10) return null;
  return `549${national}`;
}

/** Muestra un número normalizado de forma legible: "5493815867891" → "+54 9 381 586-7891" (aprox.). */
export function prettyPhone(normalized: string): string {
  if (!/^549\d{10}$/.test(normalized)) return normalized;
  const n = normalized.slice(3);
  const area = n.startsWith("11") ? n.slice(0, 2) : n.slice(0, 3);
  const rest = n.slice(area.length);
  return `+54 9 ${area} ${rest.slice(0, rest.length - 4)}-${rest.slice(-4)}`;
}

/** Link para abrir WhatsApp con el mensaje escrito (modo manual). */
export function whatsappLink(normalized: string, text: string): string {
  return `https://wa.me/${normalized}?text=${encodeURIComponent(text)}`;
}
