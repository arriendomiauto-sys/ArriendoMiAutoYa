import { useEffect, useState } from "react";
import { Check, SlidersHorizontal } from "lucide-react";
import Shell from "../components/Shell";
import { PageIntro, Tabs, StateMsg } from "../components/ui";
import { useAuth } from "../context/AuthContext";
import { ApiClient } from "../lib/api";

const CAMPOS = [
  { key: "valor_uf_clp", label: "Valor UF (CLP)", step: "0.01" },
  { key: "comision_plataforma_pct", label: "Comisión plataforma (%)", step: "0.1" },
  { key: "hold_enrolamiento_clp", label: "Hold de enrolamiento (CLP)" },
  { key: "edad_minima_arriendo", label: "Edad mínima de arriendo" },
  { key: "km_diarios_incluidos", label: "Km diarios incluidos" },
  { key: "cargo_km_extra_clp", label: "Cargo km extra (CLP/km)" },
  { key: "cargo_limpieza_estandar_clp", label: "Limpieza estándar (CLP)" },
  { key: "cargo_limpieza_profunda_clp", label: "Limpieza profunda (CLP)" },
  { key: "cargo_combustible_cuarto_clp", label: "Combustible 1/4 (CLP)" },
  { key: "periodo_gracia_minutos", label: "Período de gracia (min)" },
  { key: "dias_cobro_posterior_peajes", label: "Días cobro posterior peajes" },
];
const CATEGORIAS = [
  { id: "economico", label: "Económico / Citycar" },
  { id: "sedan", label: "Sedán" },
  { id: "suv", label: "SUV / Crossover" },
  { id: "camioneta", label: "Camioneta / Pickup" },
  { id: "premium", label: "Premium / Alta gama" },
];
const TARIFAS_DEFAULT = {
  economico: { base: 40000, min: 25000 }, sedan: { base: 55000, min: 35000 },
  suv: { base: 80000, min: 45000 }, camioneta: { base: 95000, min: 55000 }, premium: { base: 180000, min: 80000 },
};
const GARANTIAS_DEFAULT = { economico: 250000, sedan: 350000, suv: 500000, camioneta: 600000, premium: 1000000 };
const REFERIDOS = [
  { key: "bono_invitado_pct_t1", label: "Invitado — tramo 1 (%)", hint: "Días 0–30" },
  { key: "bono_invitado_pct_t2", label: "Invitado — tramo 2 (%)", hint: "Días 31–60" },
  { key: "bono_invitado_pct_t3", label: "Invitado — tramo 3 (%)", hint: "Días 61–90" },
  { key: "bono_referente_pct_t1", label: "Referente — tramo 1 (%)", hint: "Días 0–30" },
  { key: "bono_referente_pct_t2", label: "Referente — tramo 2 (%)", hint: "Días 31–60" },
];
const PASO = 5000;
const aTramo = (n) => Math.max(PASO, Math.round((Number(n) || 0) / PASO) * PASO);

export default function Configuracion() {
  const { esAdmin } = useAuth();
  const [cfg, setCfg] = useState(null);
  const [tab, setTab] = useState("general");
  const [error, setError] = useState(null);
  const [msg, setMsg] = useState(null);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    ApiClient.getConfiguracion()
      .then((d) => setCfg({
        ...d,
        tarifas_categoria: { ...TARIFAS_DEFAULT, ...(d.tarifas_categoria || {}) },
        garantia_categoria_clp: { ...GARANTIAS_DEFAULT, ...(d.garantia_categoria_clp || {}) },
      }))
      .catch((e) => setError(e.message));
  }, []);

  const setNum = (k, v) => setCfg((p) => ({ ...p, [k]: v === "" ? "" : Number(v) }));
  const setTarifa = (id, campo, v) => setCfg((p) => ({
    ...p, tarifas_categoria: { ...p.tarifas_categoria, [id]: { ...(p.tarifas_categoria[id] || TARIFAS_DEFAULT[id]), [campo]: v === "" ? "" : Number(v) } },
  }));
  const setGarantia = (id, v) => setCfg((p) => ({ ...p, garantia_categoria_clp: { ...p.garantia_categoria_clp, [id]: v === "" ? "" : Number(v) } }));

  async function guardar() {
    setGuardando(true); setMsg(null); setError(null);
    try {
      const tarifas = Object.fromEntries(CATEGORIAS.map(({ id }) => {
        const t = cfg.tarifas_categoria[id] || TARIFAS_DEFAULT[id];
        const base = aTramo(t.base);
        return [id, { base, min: Math.min(aTramo(t.min), base) }];
      }));
      const garantias = Object.fromEntries(CATEGORIAS.map(({ id }) => [id, Number(cfg.garantia_categoria_clp[id]) || GARANTIAS_DEFAULT[id]]));
      const payload = {
        ...Object.fromEntries(CAMPOS.map((c) => [c.key, cfg[c.key]])),
        ...Object.fromEntries(REFERIDOS.map((r) => [r.key, cfg[r.key]])),
        tarifas_categoria: tarifas,
        garantia_categoria_clp: garantias,
      };
      const nueva = await ApiClient.actualizarConfiguracion(payload);
      setCfg({ ...nueva, tarifas_categoria: { ...TARIFAS_DEFAULT, ...(nueva.tarifas_categoria || {}) }, garantia_categoria_clp: { ...GARANTIAS_DEFAULT, ...(nueva.garantia_categoria_clp || {}) } });
      setMsg("Configuración actualizada.");
    } catch (e) {
      setError(e.message);
    } finally {
      setGuardando(false);
    }
  }

  const GuardarBtn = (
    <button className="btn btn-mint" onClick={guardar} disabled={guardando} style={{ marginTop: 16 }}>
      <Check size={14} />{guardando ? "Guardando…" : "Guardar cambios"}
    </button>
  );

  return (
    <Shell title="Configuración">
      <PageIntro title="Configuración de plataforma">
        Parámetros que la app lee en vivo. Cambiarlos no requiere un despliegue. Solo un Admin puede guardar.
      </PageIntro>

      {!esAdmin ? (
        <StateMsg kind="warn">Tu cuenta puede ver estos parámetros pero solo un Admin puede editarlos.</StateMsg>
      ) : null}
      {error ? <StateMsg>{error}</StateMsg> : null}
      {msg ? <StateMsg kind="ok">{msg}</StateMsg> : null}

      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { key: "general", label: "Parámetros generales", icon: SlidersHorizontal },
          { key: "tarifas", label: "Tarifas por categoría" },
          { key: "garantias", label: "Garantías por categoría" },
          { key: "referidos", label: "Programa de referidos" },
        ]}
      />

      {!cfg ? (
        <div className="empty" style={{ maxWidth: 640 }}>Cargando configuración…</div>
      ) : tab === "general" ? (
        <div className="card card-pad" style={{ maxWidth: 640 }}>
          <div className="grid g-2">
            {CAMPOS.map((c) => (
              <div className="field" key={c.key}>
                <label>{c.label}</label>
                <input className="input" type="number" step={c.step || "1"} disabled={!esAdmin}
                  value={cfg[c.key] ?? ""} onChange={(e) => setNum(c.key, e.target.value)} />
              </div>
            ))}
          </div>
          {esAdmin ? GuardarBtn : null}
        </div>
      ) : tab === "tarifas" ? (
        <div className="card card-pad" style={{ maxWidth: 640 }}>
          <p style={{ margin: "0 0 14px", fontSize: 12.5, color: "var(--muted)" }}>
            <b style={{ color: "var(--ink)" }}>Precio base</b>: lo que fija RentACar y tope para el dueño.
            {" "}<b style={{ color: "var(--ink)" }}>Mínimo</b>: piso hasta donde puede descontar. Se redondean a tramos de $5.000.
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 120px 120px", gap: 10, fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".04em", paddingBottom: 6 }}>
            <span>Categoría</span><span>Precio base</span><span>Mínimo</span>
          </div>
          {CATEGORIAS.map(({ id, label }) => {
            const t = cfg.tarifas_categoria[id] || TARIFAS_DEFAULT[id];
            return (
              <div key={id} style={{ display: "grid", gridTemplateColumns: "1fr 120px 120px", gap: 10, alignItems: "center", padding: "7px 0", borderTop: "1px solid var(--line)" }}>
                <span style={{ fontSize: 13 }}>{label}</span>
                <input className="input" type="number" step="5000" disabled={!esAdmin} value={t.base ?? ""} onChange={(e) => setTarifa(id, "base", e.target.value)} />
                <input className="input" type="number" step="5000" disabled={!esAdmin} value={t.min ?? ""} onChange={(e) => setTarifa(id, "min", e.target.value)} />
              </div>
            );
          })}
          {esAdmin ? GuardarBtn : null}
        </div>
      ) : tab === "garantias" ? (
        <div className="card card-pad" style={{ maxWidth: 520 }}>
          <p style={{ margin: "0 0 14px", fontSize: 12.5, color: "var(--muted)" }}>
            Monto del <b style={{ color: "var(--ink)" }}>hold de garantía</b> que se retiene en la tarjeta de crédito del arrendatario, por categoría. No se cobra si el auto vuelve sin novedad.
          </p>
          {CATEGORIAS.map(({ id, label }) => (
            <div key={id} style={{ display: "grid", gridTemplateColumns: "1fr 140px", gap: 10, alignItems: "center", padding: "8px 0", borderTop: "1px solid var(--line)" }}>
              <span style={{ fontSize: 13 }}>{label}</span>
              <input className="input" type="number" step="10000" disabled={!esAdmin}
                value={cfg.garantia_categoria_clp[id] ?? ""} onChange={(e) => setGarantia(id, e.target.value)} />
            </div>
          ))}
          {esAdmin ? GuardarBtn : null}
        </div>
      ) : (
        <div className="card card-pad" style={{ maxWidth: 640 }}>
          <p style={{ margin: "0 0 14px", fontSize: 12.5, color: "var(--muted)" }}>
            Bono decreciente por tramos. El invitado ancla en su fecha de registro; quien invita, en la fecha en que un invitado suyo completó su primera actividad.
          </p>
          <div className="grid g-2">
            {REFERIDOS.map((r) => (
              <div className="field" key={r.key}>
                <label>{r.label}</label>
                <input className="input" type="number" step="0.5" disabled={!esAdmin}
                  value={cfg[r.key] ?? ""} onChange={(e) => setNum(r.key, e.target.value)} />
                <div className="hint">{r.hint}</div>
              </div>
            ))}
          </div>
          {esAdmin ? GuardarBtn : null}
        </div>
      )}
    </Shell>
  );
}
