/** Íconos de línea (trazos propios, sin librerías). Heredan el color del texto. */
const PATHS = {
  agenda: "M7 3v3M17 3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Zm3 8h3m-3 4h6",
  inbox: "M4 13h4l1.5 2.5h5L16 13h4M5.5 5h13L20 13v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-5L5.5 5Z",
  bell: "M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15L6 16Zm4 4a2 2 0 0 0 4 0",
  users: "M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm-6 9c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5M16 4.5a3.5 3.5 0 0 1 0 6.5m2.5 3.6c1.6.8 2.5 2.4 2.5 4.4",
  chart: "M4 20h16M7 16v-4m5 4V8m5 8v-6",
  settings: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm7.4-3a7.4 7.4 0 0 0-.1-1.2l2-1.6-2-3.4-2.4.9a7.5 7.5 0 0 0-2-1.2L14.5 3h-5l-.4 2.5a7.5 7.5 0 0 0-2 1.2l-2.4-.9-2 3.4 2 1.6a7.4 7.4 0 0 0 0 2.4l-2 1.6 2 3.4 2.4-.9a7.5 7.5 0 0 0 2 1.2l.4 2.5h5l.4-2.5a7.5 7.5 0 0 0 2-1.2l2.4.9 2-3.4-2-1.6c.1-.4.1-.8.1-1.2Z",
  user: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8c0-3.6 3.1-6 7-6s7 2.4 7 6",
  logout: "M15 4h3a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-3M10 16l-4-4 4-4m-4 4h10",
  plus: "M12 5v14M5 12h14",
  left: "m15 18-6-6 6-6",
  right: "m9 18 6-6-6-6",
  check: "m5 12.5 4.5 4.5L19 7.5",
  close: "M6 6l12 12M18 6 6 18",
  clock: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-13v4.5l3 2",
  pin: "M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21Zm0-9a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z",
  link: "M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1",
  more: "M5 12h.01M12 12h.01M19 12h.01",
  mail: "M4 6h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1Zm-1 1 9 6.5L21 7",
  code: "m8 8-4 4 4 4m8-8 4 4-4 4m-2.5-11-3 14",
  whatsapp:
    "M4 20l1.3-3.8A8 8 0 1 1 8 19.1L4 20Zm5-11.5c0 3.6 2.9 6.5 6.5 6.5l1.3-1.3-1.8-1.2-1 .9a4.6 4.6 0 0 1-2.4-2.4l.9-1-1.2-1.8L9 8.5Z",
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 18, className = "icon" }: { name: IconName; size?: number; className?: string }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}

/** Marca: una hoja de agenda con un tilde. */
export function Logo({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      <rect x="2" y="3" width="28" height="27" rx="7" fill="var(--pine)" />
      <path d="M9 2.5v5M23 2.5v5" stroke="var(--ink)" strokeWidth="2.4" strokeLinecap="round" />
      <path d="m10 17.5 4.2 4.2L22.5 13" fill="none" stroke="#fff" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
