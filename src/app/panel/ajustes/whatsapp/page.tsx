import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { appUrl, clinicWhatsapp } from "@/lib/reminders";
import { secretsConfigured } from "@/lib/secrets";
import { salesWhatsappLink, WHATSAPP_EXTRAS } from "@/lib/brand";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Field } from "@/components/ui";
import { Icon } from "@/components/icons";
import { disconnectOwnWhatsappAction, saveOwnWhatsappAction, setWhatsappModeAction } from "../actions";

export const metadata: Metadata = { title: "WhatsApp" };

export default async function WhatsappSettingsPage() {
  const user = await requireUser(["ADMIN"]);
  const c = await prisma.clinic.findUniqueOrThrow({ where: { id: user.clinic.id } });
  const wa = clinicWhatsapp(c);
  const chosen = c.waMode as "MANUAL" | "PROPIA" | "PACK";
  const webhookUrl = `${appUrl()}/api/whatsapp/webhook`;
  const packMsg = `Hola! Quiero comprar un pack de recordatorios automáticos para ${c.name}.`;
  const ownMsg = `Hola! Quiero que me ayuden a conectar el WhatsApp de ${c.name} para los recordatorios automáticos.`;

  return (
    <div className="stack wa-settings">
      <header className="wa-intro">
        <h1>Recordatorios por WhatsApp</h1>
        <p>
          Elegí cómo le llega el recordatorio a tus pacientes el día anterior al turno. En los tres casos el paciente recibe un
          link para <b>confirmar</b> o <b>cancelar</b>, y la agenda se actualiza sola. A quien ya confirmó no se le escribe.
        </p>
      </header>

      {wa.mode === "MANUAL" && "problem" in wa && wa.problem && chosen !== "MANUAL" ? (
        <p className="notice notice-warn">{wa.problem} Mientras tanto, los recordatorios se mandan con un toque.</p>
      ) : null}

      <div className="wa-options">
        {/* 1. Con un toque */}
        <section className={`wa-option${chosen === "MANUAL" ? " on" : ""}`}>
          {chosen === "MANUAL" ? <span className="wa-current">Lo estás usando</span> : null}
          <span className="wa-num">1</span>
          <h2>Con un toque</h2>
          <p className="wa-price">Incluido en tu plan</p>
          <p>
            La secretaria entra a <b>Recordatorios</b> y toca <b>Enviar</b> en cada paciente. Se abre WhatsApp con el mensaje
            listo y solo aprieta enviar. Sale desde el WhatsApp del consultorio.
          </p>
          <ul className="wa-points">
            <li><Icon name="check" size={16} /> Sin costo extra</li>
            <li><Icon name="clock" size={16} /> Unos 3 minutos por día con 20 turnos</li>
          </ul>
          {chosen !== "MANUAL" ? (
            <form action={setWhatsappModeAction.bind(null, "MANUAL")}>
              <button className="btn" type="submit">Usar este</button>
            </form>
          ) : null}
        </section>

        {/* 2. Automático con packs de TurnoClaro */}
        <section className={`wa-option${chosen === "PACK" ? " on" : ""}`}>
          {chosen === "PACK" ? <span className="wa-current">Lo estás usando</span> : null}
          <span className="wa-num">2</span>
          <h2>Automático con packs</h2>
          <p className="wa-price">Desde ${WHATSAPP_EXTRAS.packs[0].price} por {WHATSAPP_EXTRAS.packs[0].reminders} recordatorios</p>
          <p>
            Todos los días a las 19 h los recordatorios <b>se mandan solos</b> desde el WhatsApp de TurnoClaro. No tenés que
            configurar nada: comprás un pack y se va descontando.
          </p>
          <div className="wa-credits">
            <b>{c.reminderCredits.toLocaleString("es-AR")}</b>
            <span>recordatorios disponibles</span>
          </div>
          <ul className="wa-packs">
            {WHATSAPP_EXTRAS.packs.map((p) => (
              <li key={p.reminders}>
                <span>{p.reminders.toLocaleString("es-AR")} recordatorios</span>
                <b>${p.price}</b>
              </li>
            ))}
          </ul>
          <div className="row">
            <a className="btn btn-wa" href={salesWhatsappLink(packMsg)} target="_blank" rel="noopener noreferrer">
              <Icon name="whatsapp" size={16} /> Comprar un pack
            </a>
            {chosen !== "PACK" ? (
              <form action={setWhatsappModeAction.bind(null, "PACK")}>
                <button className="btn" type="submit" disabled={c.reminderCredits === 0} title={c.reminderCredits === 0 ? "Primero comprá un pack" : undefined}>
                  Usar este
                </button>
              </form>
            ) : null}
          </div>
          {chosen === "PACK" && c.reminderCredits === 0 ? (
            <p className="small wa-alert">Te quedaste sin recordatorios: hasta que cargues otro pack, mandalos con un toque.</p>
          ) : null}
        </section>

        {/* 3. Automático con el WhatsApp propio */}
        <section className={`wa-option${chosen === "PROPIA" ? " on" : ""}`}>
          {chosen === "PROPIA" ? <span className="wa-current">Lo estás usando</span> : null}
          <span className="wa-num">3</span>
          <h2>Automático con tu número</h2>
          <p className="wa-price">Activación ${WHATSAPP_EXTRAS.activationPrice} (una sola vez)</p>
          <p>
            Los recordatorios se mandan solos <b>desde el número de tu consultorio</b>. Meta te cobra cada mensaje directo a tu
            tarjeta, sin límite de cantidad. Necesitás una cuenta de Meta Business y un número que no esté en uso en WhatsApp.
          </p>
          <ul className="wa-points">
            <li><Icon name="check" size={16} /> Sale con el nombre de tu consultorio</li>
            <li><Icon name="check" size={16} /> Sin packs ni saldo</li>
          </ul>
          <a className="btn" href={salesWhatsappLink(ownMsg)} target="_blank" rel="noopener noreferrer">
            <Icon name="whatsapp" size={16} /> Que me lo configuren
          </a>
        </section>
      </div>

      {/* Datos técnicos de la cuenta propia: los completa quien configura Meta */}
      <details className="card wa-tech" open={chosen === "PROPIA"}>
        <summary>
          <span>
            <b>Conectar tu propia cuenta de WhatsApp</b>
            <small>Para quien hace la configuración en Meta. Si no sabés qué es esto, tocá “Que me lo configuren”.</small>
          </span>
          <Icon name="right" size={18} />
        </summary>

        {!secretsConfigured() ? (
          <p className="notice notice-warn">
            Falta la clave <code>SECRETS_KEY</code> en el archivo <code>.env</code> del servidor. Sin ella no se pueden guardar los
            datos de Meta de forma segura.
          </p>
        ) : null}

        {chosen === "PROPIA" && c.waPhoneNumberId ? (
          <div className="wa-connected">
            <Icon name="check" size={18} />
            <span>Conectado al número con identificador <code>{c.waPhoneNumberId}</code></span>
            <form action={disconnectOwnWhatsappAction}>
              <button className="btn btn-sm btn-danger" type="submit">Desconectar</button>
            </form>
          </div>
        ) : null}

        <ActionForm action={saveOwnWhatsappAction} className="grid-2">
          <Field label="Identificador del número de teléfono" hint="En Meta: WhatsApp › Configuración de la API.">
            <input name="waPhoneNumberId" inputMode="numeric" defaultValue={c.waPhoneNumberId ?? ""} placeholder="Ej.: 109876543210987" autoComplete="off" />
          </Field>
          <Field label="Token de acceso permanente" hint={c.waTokenEnc ? "Ya hay uno guardado. Dejalo vacío para no cambiarlo." : "Token de un usuario del sistema de Meta Business."}>
            <input name="waToken" type="password" autoComplete="off" placeholder={c.waTokenEnc ? "••••••••••" : ""} />
          </Field>
          <Field label="Clave secreta de la app" hint={c.waAppSecretEnc ? "Ya hay una guardada. Dejala vacía para no cambiarla." : "En Meta: Configuración de la app › Básica."}>
            <input name="waAppSecret" type="password" autoComplete="off" placeholder={c.waAppSecretEnc ? "••••••••••" : ""} />
          </Field>
          <Field label="Plantilla aprobada" hint="Nombre e idioma, como figuran en Meta.">
            <div className="row">
              <input name="waTemplateName" defaultValue={c.waTemplateName ?? "recordatorio_turno"} />
              <input name="waTemplateLang" defaultValue={c.waTemplateLang ?? "es_AR"} style={{ maxWidth: 110 }} />
            </div>
          </Field>
          <div className="span-2">
            <SubmitButton>Probar y conectar</SubmitButton>
          </div>
        </ActionForm>

        {c.waVerifyToken ? (
          <div className="wa-webhook">
            <b>Último paso: el webhook en Meta</b>
            <p className="small muted">En Meta, WhatsApp › Configuración › Webhook, pegá estos dos datos y suscribite al campo <code>messages</code>.</p>
            <dl>
              <dt>URL de devolución de llamada</dt>
              <dd><code>{webhookUrl}</code></dd>
              <dt>Token de verificación</dt>
              <dd><code>{c.waVerifyToken}</code></dd>
            </dl>
          </div>
        ) : null}
      </details>
    </div>
  );
}
