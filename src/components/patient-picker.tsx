"use client";

import { useEffect, useState } from "react";

type Found = { id: string; fullName: string; dni: string | null; phone: string; insurance: string | null };

/**
 * Elegir un paciente existente (buscador) o cargar uno nuevo en el momento.
 * Envía "patientId" o los campos del paciente nuevo ("p_fullName", "p_dni", ...).
 */
export function PatientPicker({
  insurances,
  initial,
}: {
  insurances: { id: string; name: string }[];
  initial?: Found | null;
}) {
  const [mode, setMode] = useState<"buscar" | "nuevo">("buscar");
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Found[]>([]);
  const [selected, setSelected] = useState<Found | null>(initial ?? null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (mode !== "buscar" || selected) return;
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/pacientes?q=${encodeURIComponent(q)}`, { signal: ctrl.signal });
        if (res.ok) setResults(await res.json());
      } catch {
        /* búsqueda cancelada */
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q, mode, selected]);

  return (
    <fieldset className="card card-tight stack" style={{ margin: 0 }}>
      <legend className="small muted" style={{ padding: "0 4px" }}>
        Paciente
      </legend>
      <div className="row">
        <label className="check">
          <input type="radio" checked={mode === "buscar"} onChange={() => setMode("buscar")} /> Ya es paciente
        </label>
        <label className="check">
          <input
            type="radio"
            checked={mode === "nuevo"}
            onChange={() => {
              setMode("nuevo");
              setSelected(null);
            }}
          />{" "}
          Paciente nuevo
        </label>
      </div>

      {mode === "buscar" ? (
        selected ? (
          <div className="row spread">
            <input type="hidden" name="patientId" value={selected.id} />
            <span>
              <strong>{selected.fullName}</strong>
              <span className="muted small">
                {selected.dni ? ` · DNI ${selected.dni}` : ""} · {selected.phone}
                {selected.insurance ? ` · ${selected.insurance}` : ""}
              </span>
            </span>
            <button type="button" className="btn btn-sm" onClick={() => setSelected(null)}>
              Cambiar
            </button>
          </div>
        ) : (
          <div className="stack" style={{ gap: 8 }}>
            <input
              type="search"
              placeholder="Buscar por nombre, DNI o teléfono"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              autoFocus
            />
            {loading && results.length === 0 ? <span className="muted small">Buscando…</span> : null}
            {!loading && q && results.length === 0 ? (
              <span className="muted small">
                No hay coincidencias.{" "}
                <button type="button" className="btn-link" onClick={() => setMode("nuevo")}>
                  Cargarlo como nuevo
                </button>
              </span>
            ) : null}
            <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 4 }}>
              {results.map((p) => (
                <li key={p.id}>
                  <button type="button" className="btn btn-sm" style={{ width: "100%", justifyContent: "flex-start" }} onClick={() => setSelected(p)}>
                    {p.fullName}
                    <span className="muted">
                      {p.dni ? ` · ${p.dni}` : ""} · {p.phone}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )
      ) : (
        <div className="grid-2">
          <label className="field">
            <span>Nombre y apellido</span>
            <input name="p_fullName" required />
          </label>
          <label className="field">
            <span>Celular</span>
            <input name="p_phone" type="tel" required placeholder="381 555-1234" />
          </label>
          <label className="field">
            <span>DNI</span>
            <input name="p_dni" inputMode="numeric" />
          </label>
          <label className="field">
            <span>Obra social</span>
            <select name="p_insuranceId" defaultValue="">
              <option value="">—</option>
              {insurances.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>N.º de afiliado</span>
            <input name="p_affiliateNumber" />
          </label>
          <label className="field">
            <span>Email</span>
            <input name="p_email" type="email" />
          </label>
        </div>
      )}
    </fieldset>
  );
}
