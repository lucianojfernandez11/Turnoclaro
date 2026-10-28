"use client";

import { useEffect, useRef } from "react";

/**
 * Hace que el fondo de vidrio siga un poco al mouse.
 * Escribe --mx y --my (entre -1 y 1) en el elemento padre; el CSS mueve cada capa según su profundidad.
 */
export function PointerParallax() {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const host = ref.current?.parentElement;
    if (!host) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let frame = 0;
    let x = 0;
    let y = 0;
    const apply = () => {
      frame = 0;
      host.style.setProperty("--mx", x.toFixed(3));
      host.style.setProperty("--my", y.toFixed(3));
    };
    const onMove = (e: PointerEvent) => {
      x = (e.clientX / window.innerWidth - 0.5) * 2;
      y = (e.clientY / window.innerHeight - 0.5) * 2;
      if (!frame) frame = requestAnimationFrame(apply);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);
  return <span ref={ref} hidden />;
}
