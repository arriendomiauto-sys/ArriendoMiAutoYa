import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import RequireAuth from "../../components/RequireAuth";
import Layout from "../../components/Layout";
import { useAuth } from "../../context/AuthContext";
import { ApiClient } from "../../lib/api";

const ACCIONES_PAGO = [
  { value: "reembolso_total", label: "Reembolso total al cliente" },
  { value: "cobro_cliente", label: "Cobro al cliente" },
  { value: "division_deducible_50_50", label: "División del deducible 50/50" },
  { value: "cargo_limpieza_dueno", label: "Cargo de limpieza al dueño" },
  { value: "sin_cobro", label: "Sin cobro" },
];

export default function DetalleDisputa() {
  const router = useRouter();
  const { id } = router.query;
  const { esAdmin } = useAuth();

  const [disputa, setDisputa] = useState(null);
  const [error, setError] = useState(null);
  const [resolucion, setResolucion] = useState("");
  const [accionPago, setAccionPago] = useState(ACCIONES_PAGO[0].value);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (!id) return;
    ApiClient.getDisputa(id)
      .then(setDisputa)
      .catch((err) => setError(err.message));
  }, [id]);

  async function handleResolver(e) {
    e.preventDefault();
    setGuardando(true);
    setError(null);
    try {
      const actualizada = await ApiClient.resolverDisputa(id, resolucion, accionPago);
      setDisputa(actualizada);
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <RequireAuth>
      <Layout>
        <Link href="/disputas" className="mb-4 inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700">
          <ArrowLeft size={14} /> Volver a disputas
        </Link>
        <h1 className="mb-6 text-xl font-semibold text-brand-tealDark">Disputa {id}</h1>

        {error && <div className="mb-4 rounded-md bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>}

        {disputa && (
          <div className="mb-6 grid grid-cols-2 gap-4 rounded-lg border border-slate-200 bg-white p-5 text-sm shadow-sm">
            <div>
              <div className="text-xs uppercase text-slate-400">Reserva</div>
              <div>{disputa.reserva_id}</div>
            </div>
            <div>
              <div className="text-xs uppercase text-slate-400">Estado</div>
              <div className="capitalize">{disputa.estado}</div>
            </div>
            <div>
              <div className="text-xs uppercase text-slate-400">Tipo</div>
              <div>{disputa.tipo}</div>
            </div>
            <div>
              <div className="text-xs uppercase text-slate-400">Fecha</div>
              <div>{new Date(disputa.timestamp).toLocaleString("es-CL")}</div>
            </div>
            <div className="col-span-2">
              <div className="text-xs uppercase text-slate-400">Motivo</div>
              <div>{disputa.motivo || "—"}</div>
            </div>
            {disputa.foto_evidencia_url && (
              <div className="col-span-2">
                <div className="mb-1 text-xs uppercase text-slate-400">Evidencia</div>
                <img src={disputa.foto_evidencia_url} alt="Evidencia" className="max-h-64 rounded-md border border-slate-200" />
              </div>
            )}
            {disputa.resolucion && (
              <div className="col-span-2">
                <div className="text-xs uppercase text-slate-400">Resolución</div>
                <div>{disputa.resolucion}</div>
              </div>
            )}
          </div>
        )}

        {disputa && disputa.estado === "abierta" && (
          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-3 text-sm font-semibold text-brand-tealDark">Resolver disputa</h2>
            {!esAdmin && (
              <p className="mb-3 text-xs text-amber-600">
                Solo un Admin puede resolver formalmente una disputa. Como Manager, podés ver el detalle pero no resolverla.
              </p>
            )}
            <form onSubmit={handleResolver}>
              <label className="mb-1 block text-xs font-medium text-slate-500">Acción de pago</label>
              <select
                value={accionPago}
                onChange={(e) => setAccionPago(e.target.value)}
                disabled={!esAdmin}
                className="mb-4 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-mint focus:outline-none disabled:bg-slate-50"
              >
                {ACCIONES_PAGO.map((a) => (
                  <option key={a.value} value={a.value}>
                    {a.label}
                  </option>
                ))}
              </select>

              <label className="mb-1 block text-xs font-medium text-slate-500">Resolución</label>
              <textarea
                required
                rows={3}
                value={resolucion}
                onChange={(e) => setResolucion(e.target.value)}
                disabled={!esAdmin}
                className="mb-4 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-mint focus:outline-none disabled:bg-slate-50"
              />

              <button
                type="submit"
                disabled={!esAdmin || guardando}
                className="rounded-md bg-brand-mint px-4 py-2 text-sm font-medium text-brand-tealDark hover:bg-brand-mintHover disabled:opacity-50"
              >
                {guardando ? "Guardando…" : "Resolver disputa"}
              </button>
            </form>
          </div>
        )}
      </Layout>
    </RequireAuth>
  );
}
