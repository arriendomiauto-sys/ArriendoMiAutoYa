import { useEffect, useState } from "react";
import RequireAuth from "../components/RequireAuth";
import Layout from "../components/Layout";
import StatCard from "../components/StatCard";
import { ApiClient } from "../lib/api";

function formatoCLP(monto) {
  return new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP" }).format(monto || 0);
}

export default function Dashboard() {
  const [metricas, setMetricas] = useState(null);
  const [financiero, setFinanciero] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    Promise.all([ApiClient.getMetricasGlobales(), ApiClient.getPanelFinanciero()])
      .then(([m, f]) => {
        setMetricas(m);
        setFinanciero(f);
      })
      .catch((err) => setError(err.message));
  }, []);

  return (
    <RequireAuth>
      <Layout>
        <h1 className="mb-6 text-xl font-semibold text-brand-tealDark">Dashboard</h1>

        {error && <div className="mb-4 rounded-md bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>}

        <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-4">
          <StatCard label="Usuarios" value={metricas?.total_usuarios ?? "—"} />
          <StatCard label="Autos activos" value={metricas?.total_autos_activos ?? "—"} />
          <StatCard label="Reservas" value={metricas?.total_reservas ?? "—"} />
          <StatCard label="Disputas abiertas" value={metricas?.total_disputas_abiertas ?? "—"} />
        </div>

        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Panel financiero
        </h2>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <StatCard label="Holds capturados" value={formatoCLP(financiero?.total_holds_capturados_clp)} />
          <StatCard label="Cobros finales" value={formatoCLP(financiero?.total_cobros_finales_clp)} />
          <StatCard
            label="Liquidaciones pendientes"
            value={formatoCLP(financiero?.total_liquidaciones_pendientes_clp)}
          />
          <StatCard label="Liquidaciones pagadas" value={formatoCLP(financiero?.total_liquidaciones_pagadas_clp)} />
        </div>
      </Layout>
    </RequireAuth>
  );
}
