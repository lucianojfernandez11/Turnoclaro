import { BRAND } from "./brand";

/**
 * Envío de emails con Resend (https://resend.com) usando su API HTTP, sin librerías.
 * Sin RESEND_API_KEY no se manda nada: el contenido se muestra en la terminal.
 */
export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

export async function sendEmail(params: { to: string; subject: string; html: string; text: string }): Promise<{ sent: boolean; error?: string }> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.log(`\n[email sin configurar] Para: ${params.to}\nAsunto: ${params.subject}\n${params.text}\n`);
    return { sent: false, error: "sin configurar" };
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM || `${BRAND.name} <onboarding@resend.dev>`,
        to: [params.to],
        subject: params.subject,
        html: params.html,
        text: params.text,
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      console.error("[email] Resend respondió", res.status, body);
      return { sent: false, error: `Resend ${res.status}` };
    }
    return { sent: true };
  } catch (e) {
    console.error("[email] No se pudo enviar", e);
    return { sent: false, error: "sin conexión" };
  }
}

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

/** Plantilla simple con los colores de la marca, pensada para verse bien en Gmail y en el celular. */
export function emailLayout(opts: { title: string; paragraphs: string[]; button?: { label: string; url: string }; footnote?: string }): string {
  const ps = opts.paragraphs.map((p) => `<p style="margin:0 0 14px;font-size:15px;line-height:1.55;color:#2b3b36">${esc(p)}</p>`).join("");
  const btn = opts.button
    ? `<p style="margin:22px 0"><a href="${esc(opts.button.url)}" style="display:inline-block;background:#12231f;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:13px 22px;border-radius:12px">${esc(opts.button.label)} &rarr;</a></p>
       <p style="margin:0 0 14px;font-size:12.5px;line-height:1.5;color:#6b7c76">Si el botón no funciona, copiá este link en el navegador:<br><span style="word-break:break-all;color:#1f5c4c">${esc(opts.button.url)}</span></p>`
    : "";
  const foot = opts.footnote ? `<p style="margin:18px 0 0;font-size:12.5px;line-height:1.5;color:#6b7c76">${esc(opts.footnote)}</p>` : "";
  return `<!doctype html><html><body style="margin:0;background:#f3f5f1;font-family:Arial,Helvetica,sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f5f1;padding:28px 12px"><tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:18px;border:1px solid #e3e8e3">
      <tr><td style="padding:22px 26px;border-bottom:1px solid #eef1ed"><span style="display:inline-block;width:12px;height:12px;border-radius:4px;background:#d6f28c;margin-right:8px"></span><strong style="font-size:17px;color:#12231f">${esc(BRAND.name)}</strong></td></tr>
      <tr><td style="padding:26px">
        <h1 style="margin:0 0 16px;font-size:22px;line-height:1.25;color:#12231f">${esc(opts.title)}</h1>
        ${ps}${btn}${foot}
      </td></tr>
    </table>
    <p style="margin:16px 0 0;font-size:12px;color:#8a9893">${esc(BRAND.name)} · Hecho en ${esc(BRAND.city)}</p>
  </td></tr></table></body></html>`;
}
