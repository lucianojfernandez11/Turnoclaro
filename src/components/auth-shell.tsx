import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "./icons";
import { Glass } from "./glass";
import { PatientFeed } from "./patient-feed";

/**
 * Pantallas de acceso: todo sobre el vidrio verde que flota y sigue el mouse.
 * El formulario va en una tarjeta translúcida; al lado, avisos de pacientes en vivo.
 */
export function AuthShell({ children, quote }: { children: ReactNode; quote: string }) {
  return (
    <div className="auth-stage">
      <div className="frame auth-frame">
        <Glass parallax />
        <header className="auth-top">
          <Link href="/" className="brand">
            <Logo /> TurnoClaro
          </Link>
          <nav className="pillnav tag" aria-label="Volver">
            <Link href="/">Inicio</Link>
          </nav>
        </header>
        <div className="auth-grid">
          <main className="auth-card">{children}</main>
          <aside className="auth-live">
            <p className="quote">{quote}</p>
            <PatientFeed />
          </aside>
        </div>
      </div>
    </div>
  );
}
