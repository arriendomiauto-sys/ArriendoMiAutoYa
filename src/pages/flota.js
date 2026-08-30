import { useEffect, useState } from "react";
import RequireAuth from "../components/RequireAuth";
import Layout from "../components/Layout";
import DataTable from "../components/DataTable";
import { ApiClient } from "../lib/api";

function formatoCLP(monto) {
  return new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP" }).format(monto || 0);
}

export default function Flota() {
  const [autos, setAutos] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    ApiClient.getFlota()
      .then(setAutos)
      .catch((err) => setError(err.message));
  }, []);

  const columns = [
    { key: "marca", label: "Marca" },
    { key: "modelo", label: "Modelo" },
    { key: "anio", label: "Año" },
    { key: "patente", label: "Patente" },
    { key: "tarifa_dia", label: "Tarifa/día", render: (a) => formatoCLP(a.tarifa_dia) },
    { key: "estado", label: "Estado" },
    { key: "ubicacion_base", label: "Ubicación" },
    { key: "dueno_nombre", label: "Dueño" },
    { key: "dueno_rut", label: "RUT dueño" },
  ];

  return (
    <RequireAuth>
      <Layout>
        <h1 className="mb-6 text-xl font-semibold text-brand-tealDark">Flota</h1>
        {error && <div className="mb-4 rounded-md bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>}
        <DataTable columns={columns} rows={autos} emptyLabel="No hay autos registrados." />
      </Layout>
    </RequireAuth>
  );
}
