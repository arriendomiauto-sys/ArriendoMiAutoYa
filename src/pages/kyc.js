import { useEffect, useState } from "react";
import RequireAuth from "../components/RequireAuth";
import Layout from "../components/Layout";
import DataTable from "../components/DataTable";
import Modal from "../components/Modal";
import { useAuth } from "../context/AuthContext";
import { ApiClient } from "../lib/api";

export default function Kyc() {
  const { esAdmin } = useAuth();
  const [usuarios, setUsuarios] = useState([]);
  const [error, setError] = useState(null);
  const [revisando, setRevisando] = useState(null); // { usuario, accion }
  const [notas, setNotas] = useState("");
  const [guardando, setGuardando] = useState(false);

  async function cargar() {
    try {
      const data = await ApiClient.getDocumentosPendientes();
      setUsuarios(data);
      setError(null);
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    cargar();
  }, []);

  async function handleConfirmar() {
    setGuardando(true);
    try {
      await ApiClient.revisarDocumento(revisando.usuario.id, revisando.accion, notas);
      setRevisando(null);
      setNotas("");
      await cargar();
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  }

  const columns = [
    { key: "nombre", label: "Nombre" },
    { key: "rut", label: "RUT" },
    { key: "telefono", label: "Teléfono" },
    {
      key: "confianza_ocr",
      label: "Confianza OCR",
      render: (u) => `${Math.round((u.confianza_ocr ?? 0) * 100)}%`,
    },
    { key: "notas_auditoria", label: "Notas", render: (u) => u.notas_auditoria || "—" },
    {
      key: "acciones",
      label: "Acciones",
      render: (u) =>
        esAdmin ? (
          <div className="flex gap-3">
            <button
              onClick={() => setRevisando({ usuario: u, accion: "aprobar" })}
              className="text-xs font-medium text-brand-mintHover hover:underline"
            >
              Aprobar
            </button>
            <button
              onClick={() => setRevisando({ usuario: u, accion: "rechazar" })}
              className="text-xs font-medium text-red-600 hover:underline"
            >
              Rechazar
            </button>
          </div>
        ) : (
          <span className="text-xs text-slate-400">Solo Admin</span>
        ),
    },
  ];

  return (
    <RequireAuth>
      <Layout>
        <h1 className="mb-6 text-xl font-semibold text-brand-tealDark">Revisión manual de documentos (KYC)</h1>
        {error && <div className="mb-4 rounded-md bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>}
        <DataTable columns={columns} rows={usuarios} emptyLabel="No hay documentos pendientes de revisión." />

        <Modal
          open={!!revisando}
          onOpenChange={(open) => !open && setRevisando(null)}
          title={revisando?.accion === "aprobar" ? "Aprobar documentos" : "Rechazar documentos"}
        >
          <p className="mb-3 text-sm text-slate-500">
            Usuario: <span className="font-medium text-slate-700">{revisando?.usuario?.nombre}</span>
          </p>
          <label className="mb-1 block text-xs font-medium text-slate-500">Notas</label>
          <textarea
            required
            rows={3}
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            className="mb-4 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-mint focus:outline-none"
          />
          <button
            onClick={handleConfirmar}
            disabled={guardando}
            className={`w-full rounded-md py-2 text-sm font-medium text-white disabled:opacity-50 ${
              revisando?.accion === "aprobar" ? "bg-brand-mintHover hover:bg-brand-mint" : "bg-red-600 hover:bg-red-700"
            }`}
          >
            {guardando ? "Guardando…" : revisando?.accion === "aprobar" ? "Confirmar aprobación" : "Confirmar rechazo"}
          </button>
        </Modal>
      </Layout>
    </RequireAuth>
  );
}
