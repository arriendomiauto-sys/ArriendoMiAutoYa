import { useEffect, useState } from "react";
import RequireAuth from "../components/RequireAuth";
import Layout from "../components/Layout";
import DataTable from "../components/DataTable";
import Modal from "../components/Modal";
import { ApiClient } from "../lib/api";

function Badge({ estado }) {
  const estilos = {
    abierto: "bg-amber-50 text-amber-700",
    cerrado: "bg-slate-100 text-slate-500",
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${estilos[estado] || "bg-slate-100 text-slate-500"}`}>
      {estado}
    </span>
  );
}

export default function Soporte() {
  const [tickets, setTickets] = useState([]);
  const [error, setError] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [ticketEscalar, setTicketEscalar] = useState(null);
  const [reservaId, setReservaId] = useState("");

  async function cargar() {
    setCargando(true);
    try {
      const data = await ApiClient.getTickets();
      setTickets(data);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    cargar();
  }, []);

  async function handleCerrar(ticketId) {
    try {
      await ApiClient.cerrarTicket(ticketId);
      await cargar();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleEscalar() {
    if (!reservaId.trim()) return;
    try {
      await ApiClient.escalarTicket(ticketEscalar.id, reservaId.trim());
      setTicketEscalar(null);
      setReservaId("");
      await cargar();
    } catch (err) {
      setError(err.message);
    }
  }

  const columns = [
    { key: "asunto", label: "Asunto" },
    { key: "descripcion", label: "Descripción" },
    { key: "estado", label: "Estado", render: (t) => <Badge estado={t.estado} /> },
    {
      key: "timestamp",
      label: "Fecha",
      render: (t) => new Date(t.timestamp).toLocaleString("es-CL"),
    },
    {
      key: "acciones",
      label: "Acciones",
      render: (t) =>
        t.estado === "abierto" ? (
          <div className="flex gap-3">
            <button onClick={() => handleCerrar(t.id)} className="text-xs font-medium text-brand-mintHover hover:underline">
              Cerrar
            </button>
            {!t.escalado_a_disputa && (
              <button
                onClick={() => setTicketEscalar(t)}
                className="text-xs font-medium text-amber-600 hover:underline"
              >
                Escalar a disputa
              </button>
            )}
          </div>
        ) : (
          <span className="text-xs text-slate-400">—</span>
        ),
    },
  ];

  return (
    <RequireAuth>
      <Layout>
        <h1 className="mb-6 text-xl font-semibold text-brand-tealDark">Soporte — Tickets</h1>
        {error && <div className="mb-4 rounded-md bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>}
        {!cargando && <DataTable columns={columns} rows={tickets} emptyLabel="No hay tickets de soporte." />}

        <Modal open={!!ticketEscalar} onOpenChange={(open) => !open && setTicketEscalar(null)} title="Escalar a disputa formal">
          <p className="mb-3 text-sm text-slate-500">
            Ticket: <span className="font-medium text-slate-700">{ticketEscalar?.asunto}</span>
          </p>
          <label className="mb-1 block text-xs font-medium text-slate-500">ID de la reserva asociada</label>
          <input
            value={reservaId}
            onChange={(e) => setReservaId(e.target.value)}
            className="mb-4 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-mint focus:outline-none"
            placeholder="reserva-id"
          />
          <button
            onClick={handleEscalar}
            className="w-full rounded-md bg-amber-500 py-2 text-sm font-medium text-white hover:bg-amber-600"
          >
            Escalar
          </button>
        </Modal>
      </Layout>
    </RequireAuth>
  );
}
