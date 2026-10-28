import Link from "next/link";
import { requireUser, canManageSettings, canSeeAllAgendas, ROLE_LABEL } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { NavLinks, type NavItem } from "@/components/nav";
import { Icon, Logo } from "@/components/icons";
import { Glass } from "@/components/glass";
import { logoutAction } from "../login/actions";

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const staff = canSeeAllAgendas(user);
  const pending = staff
    ? await prisma.appointment.count({
        where: { clinicId: user.clinic.id, status: "SOLICITADO", startsAt: { gt: new Date() } },
      })
    : 0;

  const items: NavItem[] = [{ href: "/panel/agenda", label: "Agenda", icon: "agenda" }];
  if (staff) {
    items.push(
      { href: "/panel/solicitudes", label: "Solicitudes", icon: "inbox", count: pending },
      { href: "/panel/recordatorios", label: "Recordatorios", icon: "bell" },
    );
  }
  items.push({ href: "/panel/pacientes", label: "Pacientes", icon: "users" });
  if (staff) items.push({ href: "/panel/reportes", label: "Reportes", icon: "chart" });
  if (canManageSettings(user)) items.push({ href: "/panel/ajustes", label: "Ajustes", icon: "settings" });

  // En el celular entran 4 accesos + "Más".
  const tabs: NavItem[] = [...items.slice(0, 4), { href: "/panel/mas", label: "Más", icon: "more" }];

  const trialDays = user.clinic.trialEndsAt
    ? Math.ceil((user.clinic.trialEndsAt.getTime() - Date.now()) / (24 * 3600 * 1000))
    : null;

  return (
    <>
      {user.isSuperadmin ? (
        <div className="banner">
          <span>
            Modo soporte en <strong>{user.clinic.name}</strong>
          </span>
          <Link href="/plataforma">Volver a la plataforma</Link>
        </div>
      ) : user.clinic.plan === "PRUEBA" && trialDays !== null ? (
        <div className="banner">
          {trialDays > 0
            ? `Te quedan ${trialDays} ${trialDays === 1 ? "día" : "días"} de prueba gratis.`
            : "Terminó la prueba gratis. Escribinos para seguir usando TurnoClaro."}
        </div>
      ) : null}

      <header className="topbar">
        <Glass calm dark />
        <Link href="/panel/agenda" className="brand">
          <Logo size={26} /> TurnoClaro
        </Link>
        <span className="clinic">{user.clinic.name}</span>
      </header>

      <div className="shell">
        <aside className="side">
          <Glass calm dark />
          <Link href="/panel/agenda" className="brand">
            <Logo /> TurnoClaro
          </Link>
          <div className="clinic-chip">
            <strong>{user.clinic.name}</strong>
            <span>/r/{user.clinic.slug}</span>
          </div>
          <NavLinks items={items} />
          <div className="side-foot">
            <div className="who">
              <strong>{user.name}</strong>
              {ROLE_LABEL[user.role]}
            </div>
            <Link href="/panel/cuenta">
              <Icon name="user" /> Mi cuenta
            </Link>
            <form action={logoutAction}>
              <button type="submit">
                <Icon name="logout" /> Salir
              </button>
            </form>
          </div>
        </aside>
        <main className="main" id="main">
          {children}
        </main>
      </div>

      <NavLinks items={tabs} className="tabbar" variant="tab" />
    </>
  );
}
