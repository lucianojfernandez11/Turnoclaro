import { requireUser } from "@/lib/auth";
import { NavLinks } from "@/components/nav";

export default async function AjustesLayout({ children }: { children: React.ReactNode }) {
  await requireUser(["ADMIN"]);
  return (
    <>
      <NavLinks
        className="subnav"
        variant="pills"
        items={[
          { href: "/panel/ajustes/consultorio", label: "Consultorio" },
          { href: "/panel/ajustes/whatsapp", label: "WhatsApp" },
          { href: "/panel/ajustes/profesionales", label: "Profesionales y horarios" },
          { href: "/panel/ajustes/feriados", label: "Feriados y cierres" },
          { href: "/panel/ajustes/obras-sociales", label: "Obras sociales" },
          { href: "/panel/ajustes/usuarios", label: "Usuarios" },
        ]}
      />
      {children}
    </>
  );
}
