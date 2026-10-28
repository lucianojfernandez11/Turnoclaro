import type React from "react";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { BRAND, PLANS, salesWhatsappLink, WHATSAPP_EXTRAS } from "@/lib/brand";
import { Icon, Logo } from "@/components/icons";
import { Glass } from "@/components/glass";
import { PatientFeed } from "@/components/patient-feed";
import { ReminderDemo } from "@/components/reminder-demo";

export default async function Home() {
  const user = await getCurrentUser();
  const signup = process.env.SIGNUP_ENABLED !== "false";
  const primaryHref = user ? "/panel/agenda" : signup ? "/registro" : salesWhatsappLink();
  const primaryLabel = user ? "Ir a mi agenda" : signup ? "Probar 14 días gratis" : "Quiero probarlo";
  const wa = salesWhatsappLink();

  return (
    <>
      <div className="site">
        {/* Portada */}
        <section className="frame hero">
          <Glass parallax />
          <header className="topnav">
            <Link href="/" className="brand">
              <Logo /> {BRAND.name}
            </Link>
            <nav className="pillnav tag" aria-label="Principal">
              <a className="hide-sm" href="#como-funciona">Cómo funciona</a>
              <a className="hide-sm" href="#precios">Precios</a>
              <Link href={user ? "/panel/agenda" : "/login"}>{user ? "Mi agenda" : "Ingresar"}</Link>
              {!user ? (
                <a className="dark" href={wa} target="_blank" rel="noreferrer">Hablemos</a>
              ) : null}
            </nav>
          </header>
          <div className="hero-mid">
            <h1 className="hero-title">Turnos que se confirman solos.</h1>
            <PatientFeed />
          </div>
          <div className="hero-foot">
            <p>
              La agenda de tu consultorio con recordatorios por WhatsApp. El paciente confirma o cancela con un toque y el
              horario queda libre para otro.
            </p>
            <a className="cta tag" href={primaryHref} {...(primaryHref.startsWith("http") ? { target: "_blank", rel: "noreferrer" } : {})}>
              <span className="cta-label">{primaryLabel}</span>
              <span className="cta-arrow"><Icon name="right" /></span>
            </a>
          </div>
        </section>
      </div>

      {/* El paciente en acción: el visitante responde y la agenda cambia */}
      <section className="section blend">
        <div className="wrap">
          <div className="section-head">
            <span className="tag tag-muted">Probalo vos</span>
            <h2>Sos Juan. Te llegó el recordatorio. ¿Qué respondés?</h2>
            <p>Así ve el paciente el mensaje de la noche anterior. Tocá una respuesta y mirá cómo se acomoda la agenda del consultorio, sin que la secretaría tenga que llamar a nadie.</p>
          </div>
          <ReminderDemo />
        </div>
      </section>

      {/* Cómo funciona: es una secuencia, por eso va numerada */}
      <section className="section" id="como-funciona" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <div className="section-head">
            <span className="tag tag-muted">Cómo funciona</span>
            <h2>Tres pasos, todos los días, sin que nadie se acuerde.</h2>
          </div>
          <ol className="steps3">
            <li>
              <span className="n">01</span>
              <Icon name="agenda" size={26} />
              <h3>Das el turno</h3>
              <p>Desde la agenda del día, o el paciente lo pide solo desde el link de reservas del consultorio.</p>
            </li>
            <li>
              <span className="n">02</span>
              <Icon name="whatsapp" size={26} />
              <h3>Sale el recordatorio</h3>
              <p>El día anterior, por WhatsApp, con un link para confirmar o avisar que no va. La secretaría lo manda con un toque, o sale solo a las 19 h si activás el envío automático.</p>
            </li>
            <li>
              <span className="n">03</span>
              <Icon name="check" size={26} />
              <h3>La agenda se ordena sola</h3>
              <p>Los que confirman quedan en verde. Si alguien cancela, el horario se libera y se lo podés dar a otro.</p>
            </li>
          </ol>
        </div>
      </section>

      {/* Precios */}
      <section className="section" id="precios" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <div className="section-head">
            <span className="tag tag-muted">Precios</span>
            <h2>Un precio fijo por mes, sin sorpresas.</h2>
            <p>Pesos argentinos, más IVA. 14 días de prueba gratis, sin tarjeta. Todos los planes incluyen recordatorios por WhatsApp con un toque, sin límite.</p>
          </div>
          <div className="plans">
            {PLANS.map((p, i) => (
              <article
                key={p.name}
                className={`plan${p.featured ? " featured" : ""}`}
                style={{ "--i": i } as React.CSSProperties}
                tabIndex={0}
              >
                <span className="plan-ring" aria-hidden="true" />
                {p.badge && <span className="plan-badge">{p.badge}</span>}
                <div>
                  <h3>{p.name}</h3>
                  <p className="muted">{p.who}</p>
                </div>
                <p className="price">
                  ${p.price} <small>/ mes</small>
                </p>
                <p className="plan-pitch">{p.pitch}</p>
                <ul>
                  {p.features.map((f, j) => (
                    <li key={f} style={{ "--j": j } as React.CSSProperties}>
                      <Icon name="check" size={16} /> {f}
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>

          <div className="extras">
            <div className="extras-head">
              <span className="tag tag-muted">Opcional</span>
              <h3>¿Querés que los recordatorios se manden solos?</h3>
              <p>Activá el envío automático: todos los días a las 19 h sale el recordatorio a cada paciente que todavía no confirmó.</p>
            </div>
            <div className="extras-grid">
              <div className="extra">
                <h4>Packs de recordatorios</h4>
                <p>Salen desde el WhatsApp de {BRAND.name}. Sin configurar nada.</p>
                <ul>
                  {WHATSAPP_EXTRAS.packs.map((p) => (
                    <li key={p.reminders}>
                      <span>{p.reminders.toLocaleString("es-AR")} recordatorios</span>
                      <b>${p.price}</b>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="extra">
                <h4>Con el número de tu consultorio</h4>
                <p>Te dejamos conectado tu propio WhatsApp. Meta te cobra cada mensaje directo a tu tarjeta, sin límite de cantidad.</p>
                <ul>
                  <li>
                    <span>Activación (una sola vez)</span>
                    <b>${WHATSAPP_EXTRAS.activationPrice}</b>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Cierre */}
      <div className="site">
        <section className="frame closing">
          <Glass parallax />
          <h2>Probalo con tu agenda real esta semana.</h2>
          <div className="row" style={{ gap: 12 }}>
            <a className="cta tag" href={wa} target="_blank" rel="noreferrer">
              <span className="cta-label">Escribinos por WhatsApp</span>
              <span className="cta-arrow"><Icon name="whatsapp" /></span>
            </a>
            {signup && !user ? (
              <Link className="btn" href="/registro" style={{ background: "rgba(255,255,255,.85)", borderColor: "transparent" }}>
                Crear cuenta gratis
              </Link>
            ) : null}
          </div>
        </section>
      </div>

      <footer className="footer">
        <span className="row" style={{ gap: 8 }}>
          <Logo size={22} /> {BRAND.name} · Hecho en {BRAND.city}
        </span>
        <span className="row" style={{ gap: 18 }}>
          <Link href="/login">Ingresar</Link>
          <a href="#precios">Precios</a>
          <a href={wa} target="_blank" rel="noreferrer">WhatsApp</a>
        </span>
      </footer>
    </>
  );
}
