import { useEffect, useState } from "react";
import Link from "next/link";
import RequireAuth from "../../components/RequireAuth";
import Layout from "../../components/Layout";
import DataTable from "../../components/DataTable";
import { ApiClient } from "../../lib/api";

const ESTADOS = ["abierta", "resuelta"];

export default function Disputas() {
  const [estado, setEstado] = useState("abierta");
  const [disputas, setDisputas] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    ApiClient.getDisputas(estado)
      .then(setDisputas)
      .catch((err) => setError(err.message));
  }, [estado]);

  const columns = [
    { key: "reserva_id", label: "Reserva" },
    { key: "tipo", label: "Tipo" },
    { key: "motivo", label: "Motivo" },
    {
      key: "timestamp",
      label: "Fecha",
      render: (d) => new Date(d.timestamp).toLocaleString("es-CL"),
    },
    {
      key: "acciones",
      label: "",
      render: (d) => (
        <Link href={`/disputas/${d.id}`} className="text-xs font-medium text-brand-mintHover hover:underline">
          Ver detalle
        </Link>
      ),
    },
  ];

  return (
    <RequireAuth>
      <Layout>
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-xl font-semibold text-brand-tealDark">Disputas</h1>
          <div className="flex gap-1 rounded-md border border-slate-200 bg-white p-1">
            {ESTADOS.map((e) => (
              <button
                key={e}
                onClick={() => setEstado(e)}
                className={`rounded px-3 py-1 text-xs font-medium capitalize ${
                  estado === e ? "bg-brand-mint text-brand-tealDark" : "text-slate-500"
                }`}
              >
                {e}
              </button>
            ))}
          </div>
        </div>
        {error && <div className="mb-4 rounded-md bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>}
        <DataTable columns={columns} rows={disputas} emptyLabel="No hay disputas en este estado." />
      </Layout>
    </RequireAuth>
  );
}
