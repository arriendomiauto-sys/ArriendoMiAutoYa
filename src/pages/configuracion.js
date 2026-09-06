import { useEffect, useState } from "react";
import RequireAuth from "../components/RequireAuth";
import Layout from "../components/Layout";
import { useAuth } from "../context/AuthContext";
import { ApiClient } from "../lib/api";

const CAMPOS = [
  { key: "valor_uf_clp", label: "Valor UF (CLP)", step: "0.01" },
  { key: "comision_plataforma_pct", label: "Comisión plataforma (%)", step: "0.1" },
  { key: "hold_enrolamiento_clp", label: "Hold de enrolamiento (CLP)" },
  { key: "cargo_limpieza_estandar_clp", label: "Cargo limpieza estándar (CLP)" },
  { key: "cargo_limpieza_profunda_clp", label: "Cargo limpieza profunda (CLP)" },
  { key: "cargo_combustible_cuarto_clp", label: "Cargo combustible 1/4 (CLP)" },
  { key: "cargo_km_extra_clp", label: "Cargo km extra (CLP)" },
  { key: "km_diarios_incluidos", label: "Km diarios incluidos" },
  { key: "periodo_gracia_minutos", label: "Período de gracia (min)" },
];

// Tarifas por categoría de vehículo. `base` = precio que fija la plataforma y
// tope para el dueño; `min` = piso hasta donde puede descontar (de $5.000 en
// $5.000). Debe coincidir con packages/mobile-shared/vehiculo/catalogoPrecios.js.
const CATEGORIAS_TARIFA = [
  { id: "economico", label: "Económico / Citycar" },
  { id: "sedan", label: "Sedán" },
  { id: "suv", label: "SUV / Crossover" },
  { id: "camioneta", label: "Camioneta / Pickup" },
  { id: "premium", label: "Premium / Alta Gama" },
];

const TARIFAS_DEFAULT = {
  economico: { base: 40000, min: 25000 },
  sedan: { base: 55000, min: 35000 },
  suv: { base: 80000, min: 45000 },
  camioneta: { base: 95000, min: 55000 },
  premium: { base: 180000, min: 80000 },
};

const PASO_CLP = 5000;
const aTramo = (n) => Math.max(PASO_CLP, Math.round((Number(n) || 0) / PASO_CLP) * PASO_CLP);

export default function Configuracion() {
  const { esAdmin } = useAuth();
  const [config, setConfig] = useState(null);
  const [error, setError] = useState(null);
  const [mensaje, setMensaje] = useState(null);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    ApiClient.getConfiguracion()
      .then((data) => setConfig({ ...data, tarifas_categoria: { ...TARIFAS_DEFAULT, ...(data.tarifas_categoria || {}) } }))
      .catch((err) => setError(err.message));
  }, []);

  function handleChange(key, value) {
    setConfig((prev) => ({ ...prev, [key]: value === "" ? "" : Number(value) }));
  }

  function handleTarifa(catId, campo, value) {
    setConfig((prev) => ({
      ...prev,
      tarifas_categoria: {
        ...prev.tarifas_categoria,
        [catId]: {
          ...(prev.tarifas_categoria?.[catId] || TARIFAS_DEFAULT[catId]),
          [campo]: value === "" ? "" : Number(value),
        },
      },
    }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setGuardando(true);
    setMensaje(null);
    setError(null);
    try {
      // Las tarifas van redondeadas a tramos de $5.000 y con el piso nunca
      // por sobre el tope.
      const tarifas = Object.fromEntries(
        CATEGORIAS_TARIFA.map(({ id }) => {
          const t = config.tarifas_categoria[id] || TARIFAS_DEFAULT[id];
          const base = aTramo(t.base);
          const min = Math.min(aTramo(t.min), base);
          return [id, { base, min }];
        })
      );
      const payload = {
        ...Object.fromEntries(CAMPOS.map((c) => [c.key, config[c.key]])),
        tarifas_categoria: tarifas,
      };
      const actualizada = await ApiClient.actualizarConfiguracion(payload);
      setConfig({ ...actualizada, tarifas_categoria: { ...TARIFAS_DEFAULT, ...(actualizada.tarifas_categoria || {}) } });
      setMensaje("Configuración actualizada.");
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  }

  if (!esAdmin) {
    return (
      <RequireAuth>
        <Layout>
          <h1 className="mb-4 text-xl font-semibold text-brand-tealDark">Configuración de plataforma</h1>
          <p className="text-sm text-amber-600">Solo un Admin puede ver y editar estos parámetros.</p>
        </Layout>
      </RequireAuth>
    );
  }

  return (
    <RequireAuth>
      <Layout>
        <h1 className="mb-6 text-xl font-semibold text-brand-tealDark">Configuración de plataforma</h1>
        {error && <div className="mb-4 rounded-md bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>}
        {mensaje && <div className="mb-4 rounded-md bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{mensaje}</div>}

        {config && (
          <form onSubmit={handleSubmit} className="max-w-2xl space-y-6">
            <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-sm font-semibold text-slate-700">Parámetros generales</h2>
              <div className="grid grid-cols-2 gap-4">
                {CAMPOS.map((campo) => (
                  <div key={campo.key}>
                    <label className="mb-1 block text-xs font-medium text-slate-500">{campo.label}</label>
                    <input
                      type="number"
                      step={campo.step || "1"}
                      value={config[campo.key] ?? ""}
                      onChange={(e) => handleChange(campo.key, e.target.value)}
                      className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-mint focus:outline-none"
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="mb-1 text-sm font-semibold text-slate-700">Tarifas por categoría</h2>
              <p className="mb-4 text-xs text-slate-500">
                <span className="font-medium">Precio base</span>: lo que fija RentACar y tope para el dueño.{" "}
                <span className="font-medium">Mínimo</span>: piso hasta donde puede descontar. Se redondean a tramos de $5.000.
              </p>
              <div className="space-y-3">
                <div className="grid grid-cols-[1fr_7rem_7rem] gap-3 text-xs font-medium text-slate-400">
                  <span>Categoría</span>
                  <span>Precio base</span>
                  <span>Mínimo</span>
                </div>
                {CATEGORIAS_TARIFA.map(({ id, label }) => {
                  const t = config.tarifas_categoria[id] || TARIFAS_DEFAULT[id];
                  return (
                    <div key={id} className="grid grid-cols-[1fr_7rem_7rem] items-center gap-3">
                      <span className="text-sm text-slate-700">{label}</span>
                      <input
                        type="number"
                        step="5000"
                        min="5000"
                        value={t.base ?? ""}
                        onChange={(e) => handleTarifa(id, "base", e.target.value)}
                        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-mint focus:outline-none"
                      />
                      <input
                        type="number"
                        step="5000"
                        min="5000"
                        value={t.min ?? ""}
                        onChange={(e) => handleTarifa(id, "min", e.target.value)}
                        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-mint focus:outline-none"
                      />
                    </div>
                  );
                })}
              </div>
            </div>

            <button
              type="submit"
              disabled={guardando}
              className="rounded-md bg-brand-mint px-4 py-2 text-sm font-medium text-brand-tealDark hover:bg-brand-mintHover disabled:opacity-50"
            >
              {guardando ? "Guardando…" : "Guardar cambios"}
            </button>
          </form>
        )}
      </Layout>
    </RequireAuth>
  );
}
