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

export default function Configuracion() {
  const { esAdmin } = useAuth();
  const [config, setConfig] = useState(null);
  const [error, setError] = useState(null);
  const [mensaje, setMensaje] = useState(null);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    ApiClient.getConfiguracion()
      .then(setConfig)
      .catch((err) => setError(err.message));
  }, []);

  function handleChange(key, value) {
    setConfig((prev) => ({ ...prev, [key]: value === "" ? "" : Number(value) }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setGuardando(true);
    setMensaje(null);
    setError(null);
    try {
      const payload = Object.fromEntries(CAMPOS.map((c) => [c.key, config[c.key]]));
      const actualizada = await ApiClient.actualizarConfiguracion(payload);
      setConfig(actualizada);
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
          <form onSubmit={handleSubmit} className="max-w-xl rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
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
            <button
              type="submit"
              disabled={guardando}
              className="mt-6 rounded-md bg-brand-mint px-4 py-2 text-sm font-medium text-brand-tealDark hover:bg-brand-mintHover disabled:opacity-50"
            >
              {guardando ? "Guardando…" : "Guardar cambios"}
            </button>
          </form>
        )}
      </Layout>
    </RequireAuth>
  );
}
