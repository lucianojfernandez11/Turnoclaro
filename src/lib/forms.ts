/** Ayudas para leer formularios en las acciones del servidor. */

export type ActionState = { error?: string; ok?: string } | null;

export function str(fd: FormData, name: string): string {
  const v = fd.get(name);
  return typeof v === "string" ? v.trim() : "";
}

export function optStr(fd: FormData, name: string): string | null {
  const v = str(fd, name);
  return v === "" ? null : v;
}

export function int(fd: FormData, name: string, fallback: number): number {
  const n = Number.parseInt(str(fd, name), 10);
  return Number.isFinite(n) ? n : fallback;
}

export function bool(fd: FormData, name: string): boolean {
  const v = fd.get(name);
  return v === "on" || v === "true" || v === "1";
}

/** Valor de searchParams como texto simple. */
export function param(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

/** "Consultorios Del Parque" → "consultorios-del-parque" */
export function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}
