"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "./icons";

export type NavItem = { href: string; label: string; short?: string; icon?: IconName; count?: number };

/** Menú con el ítem actual resaltado. "variant" elige el estilo: lateral, inferior o pestañas. */
export function NavLinks({ items, className = "nav", variant = "side" }: { items: NavItem[]; className?: string; variant?: "side" | "tab" | "pills" }) {
  const pathname = usePathname();
  return (
    <nav className={className} aria-label={variant === "pills" ? "Secciones" : "Menú principal"}>
      {items.map((item) => {
        const active = pathname === item.href || pathname.startsWith(item.href + "/");
        return (
          <Link key={item.href} href={item.href} className={active ? "active" : undefined} aria-current={active ? "page" : undefined}>
            {item.icon && variant !== "pills" ? <Icon name={item.icon} size={variant === "tab" ? 21 : 18} /> : null}
            <span>{variant === "tab" ? item.short ?? item.label : item.label}</span>
            {item.count ? <span className="count">{item.count}</span> : null}
          </Link>
        );
      })}
    </nav>
  );
}
