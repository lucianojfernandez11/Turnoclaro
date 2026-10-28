import Link from "next/link";
import type { Metadata } from "next";
import { requireUser, canManageSettings, canSeeAllAgendas, ROLE_LABEL } from "@/lib/auth";
import { Icon, type IconName } from "@/components/icons";
import { PageHeader } from "@/components/ui";
import { logoutAction } from "../../login/actions";

export const metadata: Metadata = { title: "Más" };

// Menú completo para el celular (la barra inferior muestra solo 4 accesos).
export default async function MasPage() {
  const user = await requireUser();
  const links: { href: string; label: string; icon: IconName }[] = [{ href: "/panel/agenda", label: "Agenda", icon: "agenda" }];
  if (canSeeAllAgendas(user)) {
    links.push(
      { href: "/panel/solicitudes", label: "Solicitudes online", icon: "inbox" },
      { href: "/panel/recordatorios", label: "Recordatorios", icon: "bell" },
    );
  }
  links.push({ href: "/panel/pacientes", label: "Pacientes", icon: "users" });
  if (canSeeAllAgendas(user)) links.push({ href: "/panel/reportes", label: "Reportes", icon: "chart" });
  if (canManageSettings(user)) links.push({ href: "/panel/ajustes", label: "Ajustes del consultorio", icon: "settings" });
  links.push({ href: "/panel/cuenta", label: "Mi cuenta", icon: "user" });

  return (
    <div className="stack">
      <PageHeader title={user.clinic.name} subtitle={`${user.name} · ${ROLE_LABEL[user.role]}`} />
      <div className="table-wrap">
        <table>
          <tbody>
            {links.map((l) => (
              <tr key={l.href}>
                <td>
                  <Link href={l.href} className="row" style={{ color: "var(--ink)", textDecoration: "none" }}>
                    <Icon name={l.icon} /> {l.label}
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <form action={logoutAction}>
        <button className="btn" type="submit">
          <Icon name="logout" /> Salir
        </button>
      </form>
    </div>
  );
}
