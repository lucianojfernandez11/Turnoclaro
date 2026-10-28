/**
 * Cifrado de datos sensibles guardados en la base (tokens de WhatsApp de cada consultorio).
 * Usa AES-256-GCM con la clave SECRETS_KEY del archivo .env.
 * Si alguien copia la base sin el .env, no puede leer los tokens.
 */
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

export function secretsConfigured(): boolean {
  return Boolean(process.env.SECRETS_KEY && process.env.SECRETS_KEY.length >= 16);
}

function key(): Buffer {
  const k = process.env.SECRETS_KEY;
  if (!k || k.length < 16) throw new Error("Falta SECRETS_KEY en el archivo .env");
  return createHash("sha256").update(k, "utf8").digest();
}

/** Devuelve "v1:<iv>:<tag>:<datos>" en base64url. */
export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ["v1", iv.toString("base64url"), tag.toString("base64url"), data.toString("base64url")].join(":");
}

/** Descifra lo que devolvió encryptSecret. Devuelve null si la clave cambió o el dato está dañado. */
export function decryptSecret(enc: string | null | undefined): string | null {
  if (!enc) return null;
  const [v, iv, tag, data] = enc.split(":");
  if (v !== "v1" || !iv || !tag || !data) return null;
  try {
    const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64url"));
    decipher.setAuthTag(Buffer.from(tag, "base64url"));
    return Buffer.concat([decipher.update(Buffer.from(data, "base64url")), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}

/** Texto aleatorio para el "token de verificación" del webhook de cada consultorio. */
export function randomToken(bytes = 18): string {
  return randomBytes(bytes).toString("base64url");
}
