import { useEffect, useState } from "react";
import { Wallet, CheckCircle2, Clock, Gavel, Download, CreditCard } from "lucide-react";
import Shell from "../components/Shell";
import { PageIntro, Kpi, Chip, StateMsg, EmptyState, formatoCLP } from "../components/ui";
import { ApiClient } from "../lib/api";

const TIPO_PAGO = {
  cobro_final: "Cobro arriendo", hold_reserva: "Hold garantía", hold_enrolamiento: "Hold enrolamiento",
  cargo_limpieza: "Cargo limpieza", cargo_combustible: "Cargo combustible",
  liquidacion_dueno: "Liquidación dueño", deducible_seguro: "Deducible seguro",
};
const fecha = (d) => (d ? new Date(d).toLocaleString("es-CL", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—");

export default function Finanzas() {
  const [fin, setFin] = useState(null);
  const [liq, setLiq] = useState(null);
  const [pagos, setPagos] = useState(null);
  const [error, setError] = useState(null);
  const [pagando, setPagando] = useState(null);

  useEffect(() => { cargar(); }, []);

  function cargar() {
    Promise.all([
      ApiClient.getPanelFinanciero().catch(() => null),
      ApiClient.getLiquidaciones().catch(() => null),
      ApiClient.getPagos().catch(() => null),
    ]).then(([f, l, p]) => {
      setFin(f); setLiq(l); setPagos(p);
      if (!f) setError("El resumen financiero no está disponible.");
    });
  }

  async function marcarPagada(id) {
    setPagando(id);
    try {
      await ApiClient.marcarLiquidacionPagada(id);
      cargar();
    } catch (e) {
      setError(e.message || "No se pudo marcar como pagada (endpoint pendiente).");
    } finally {
      setPagando(null);
    }
  }

  const liquidaciones = Array.isArray(liq) ? liq : [];
  const transacciones = Array.isArray(pagos) ? pagos : [];
  const pendPorLiquidar = fin?.total_liquidaciones_pendientes_clp ?? 0;

  return (
    <Shell title="Finanzas">
      <PageIntro title="Finanzas">
        El dinero de la plataforma: lo que se retuvo, lo que se cobró y lo que hay que transferir a los dueños.
      </PageIntro>

      {error ? <StateMsg>{error}</StateMsg> : null}

      <div className="grid g-4" style={{ marginBottom: 20 }}>
        <Kpi icon={Wallet} label="Holds capturados" value={fin ? formatoCLP(fin.total_holds_capturados_clp) : "—"} />
        <Kpi icon={CheckCircle2} label="Cobros finales" value={fin ? formatoCLP(fin.total_cobros_finales_clp) : "—"} sub={fin ? `${fin.cantidad_transacciones} transacciones` : ""} />
        <Kpi icon={Clock} label="Por liquidar a dueños" value={fin ? formatoCLP(pendPorLiquidar) : "—"} />
        <Kpi icon={Gavel} label="Liquidaciones pagadas" value={fin ? formatoCLP(fin.total_liquidaciones_pagadas_clp) : "—"} />
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-head">
          <Clock />
          <h3>Liquidaciones a dueños</h3>
          <button className="btn btn-mint btn-sm" style={{ marginLeft: "auto" }}><Download size={13} />Exportar nómina</button>
        </div>
        {liquidaciones.length === 0 ? (
          <div style={{ padding: 24 }}>
            <EmptyState icon={Wallet} title={liq ? "Sin liquidaciones" : "Endpoint pendiente"}>
              {liq ? "No hay transferencias pendientes ni recientes." : <>Falta <code className="mono">GET /admin/liquidaciones</code> en el backend.</>}
            </EmptyState>
          </div>
        ) : (
          <div className="table-wrap flush">
            <table className="t">
              <thead>
                <tr><th>Dueño</th><th>Cuenta</th><th className="num">Reservas</th><th className="num">Bruto</th><th className="num">Comisión</th><th className="num">A transferir</th><th>Estado</th><th /></tr>
              </thead>
              <tbody>
                {liquidaciones.map((l) => (
                  <tr key={l.id}>
                    <td className="cell-2"><b>{l.dueno_nombre}</b><span className="mono">{l.dueno_rut || "—"}</span></td>
                    <td style={{ fontSize: 12, color: "var(--muted)" }}>{l.cuenta_bancaria || "—"}</td>
                    <td className="num tnum">{l.reservas_count ?? "—"}</td>
                    <td className="num tnum" style={{ color: "var(--muted)" }}>{formatoCLP(l.bruto_clp)}</td>
                    <td className="num tnum" style={{ color: "var(--muted)" }}>−{formatoCLP(l.comision_clp)}</td>
                    <td className="num tnum" style={{ fontWeight: 700 }}>{formatoCLP(l.neto_clp)}</td>
                    <td><Chip estado={l.estado} /></td>
                    <td>
                      {l.estado === "pendiente"
                        ? <button className="btn btn-primary btn-sm" disabled={pagando === l.id} onClick={() => marcarPagada(l.id)}>{pagando === l.id ? "…" : "Marcar pagada"}</button>
                        : <span style={{ fontSize: 11.5, color: "var(--muted)" }}>{fecha(l.pagada_en)}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card">
        <div className="card-head">
          <CreditCard />
          <h3>Transacciones (Mercado Pago)</h3>
        </div>
        {transacciones.length === 0 ? (
          <div style={{ padding: 24 }}>
            <EmptyState icon={CreditCard} title={pagos ? "Sin transacciones" : "Endpoint pendiente"}>
              {pagos ? "No hay movimientos registrados." : <>Falta <code className="mono">GET /admin/pagos</code> en el backend.</>}
            </EmptyState>
          </div>
        ) : (
          <div className="table-wrap flush">
            <table className="t">
              <thead><tr><th>Pago</th><th>Reserva</th><th>Tipo</th><th className="num">Monto</th><th>Estado</th><th>Fecha</th></tr></thead>
              <tbody>
                {transacciones.map((p) => (
                  <tr key={p.id}>
                    <td className="mono" style={{ fontWeight: 600 }}>{p.id}</td>
                    <td className="mono">{p.reserva_id || "—"}</td>
                    <td style={{ fontSize: 12 }}>{TIPO_PAGO[p.tipo] || p.tipo}</td>
                    <td className="num tnum">{formatoCLP(p.monto)}</td>
                    <td><Chip estado={p.estado} /></td>
                    <td style={{ color: "var(--muted)", fontSize: 12 }}>{fecha(p.timestamp)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Shell>
  );
}
