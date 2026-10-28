import { PointerParallax } from "./pointer-parallax";

/**
 * Fondo de vidrio verde con cintas bronce. Las formas flotan solas y,
 * con parallax, siguen el mouse (cada capa a distinta profundidad).
 */
export function Glass({ parallax = false, calm = false, dark = false }: { parallax?: boolean; calm?: boolean; dark?: boolean }) {
  return (
    <div className={`glass${calm ? " glass-calm" : ""}${dark ? " glass-dark" : ""}`} aria-hidden="true">
      <div className="g-layer g-far">
        <span className="blob b1" />
        <span className="blob b2" />
        <span className="blob b3" />
        <span className="blob b4" />
        <span className="blob b5" />
      </div>
      <div className="g-layer g-near">
        <span className="ribbon r1" />
        <span className="ribbon r2" />
        <span className="lens" />
      </div>
      {parallax ? <PointerParallax /> : null}
    </div>
  );
}
