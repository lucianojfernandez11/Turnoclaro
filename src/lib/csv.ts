/**
 * Lector de CSV simple para importar pacientes desde Excel ("Guardar como CSV").
 * Acepta coma o punto y coma, comillas y saltos de línea dentro de comillas.
 */
export function parseCsv(text: string): string[][] {
  const clean = text.replace(/^﻿/, "");
  const firstLine = clean.split(/\r?\n/, 1)[0] ?? "";
  const delimiter = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ";" : ",";

  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    if (inQuotes) {
      if (ch === '"') {
        if (clean[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === delimiter) {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && clean[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += ch;
  }
  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.map((r) => r.map((c) => c.trim())).filter((r) => r.some((c) => c !== ""));
}

const HEADER_ALIASES: Record<string, string[]> = {
  fullName: ["nombre", "nombre y apellido", "apellido y nombre", "paciente", "nombre completo"],
  dni: ["dni", "documento", "nro documento", "n documento"],
  phone: ["telefono", "celular", "tel", "whatsapp", "movil"],
  email: ["email", "mail", "correo"],
  insurance: ["obra social", "obrasocial", "cobertura", "prepaga"],
  affiliateNumber: ["afiliado", "nro afiliado", "numero de afiliado", "n afiliado", "credencial"],
};

function normalizeHeader(h: string): string {
  return h
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[º°.#]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export type PatientRow = {
  fullName: string;
  dni: string;
  phone: string;
  email: string;
  insurance: string;
  affiliateNumber: string;
};

/** Convierte las filas en pacientes usando la primera fila como encabezado. */
export function rowsToPatients(rows: string[][]): { patients: PatientRow[]; missing: string[] } {
  if (rows.length === 0) return { patients: [], missing: ["nombre", "telefono"] };
  const header = rows[0].map(normalizeHeader);
  const index: Partial<Record<keyof PatientRow, number>> = {};
  for (const [key, aliases] of Object.entries(HEADER_ALIASES)) {
    const i = header.findIndex((h) => aliases.includes(h));
    if (i >= 0) index[key as keyof PatientRow] = i;
  }
  const missing: string[] = [];
  if (index.fullName === undefined) missing.push("nombre");
  if (index.phone === undefined) missing.push("telefono");
  if (missing.length) return { patients: [], missing };

  const get = (r: string[], k: keyof PatientRow) => (index[k] === undefined ? "" : (r[index[k]!] ?? "").trim());
  const patients = rows.slice(1).map((r) => ({
    fullName: get(r, "fullName"),
    dni: get(r, "dni").replace(/\D/g, ""),
    phone: get(r, "phone"),
    email: get(r, "email"),
    insurance: get(r, "insurance"),
    affiliateNumber: get(r, "affiliateNumber"),
  }));
  return { patients, missing };
}
