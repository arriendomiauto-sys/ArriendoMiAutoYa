import { useEffect, useState } from "react";
import { Wallet, CheckCircle2, Clock, Gavel, Download, CreditCard, Play, AlertCircle, ShieldAlert } from "lucide-react";
import Shell from "../components/Shell";
import { PageIntro, Kpi, Chip, StateMsg, EmptyState, formatoCLP } from "../components/ui";
import { ApiClient } from "../lib/api";
import { fecha } from "../lib/format";

const TIPO_PAGO = {
  cobro_final: "Cobro arriendo", hold_reserva: "Hold garantía", hold_enrolamiento: "Hold enrolamiento",
  cargo_limpieza: "Cargo limpieza", cargo_combustible: "Cargo combustible",
  liquidacion_dueno: "Liquidación dueño", deducible_seguro: "Deducible seguro",
  multa_dueno: "Multa a dueño", cargo_dano: "Cargo daño",
};

export default function Finanzas() {
  const [fin, setFin] = useState(null);
  const [liq, setLiq] = useState(null);
  const [multas, setMultas] = useState(null);
  const [pagos, setPagos] = useState(null);
  const [error, setError] = useState(null);
  const [exito, setExito] = useState(null);
  const [pagando, setPagando] = useState(null);
  const [ejecutandoBarrido, setEjecutandoBarrido] = useState(false);

  useEffect(() => { cargar(); }, []);

  function cargar() {
    Promise.all([
      ApiClient.getPanelFinanciero().catch(() => null),
      ApiClient.getLiquidaciones().catch(() => null),
      ApiClient.getMultasDuenos().catch(() => null),
      ApiClient.getPagos().catch(() => null),
    ]).then(([f, l, m, p]) => {
      setFin(f); setLiq(l); setMultas(m); setPagos(p);
      setError(f ? null : "El resumen financiero no está disponible.");
    });
  }

  async function marcarPagada(id) {
    setPagando(id);
    setError(null);
    setExito(null);
    try {
      await ApiClient.marcarLiquidacionPagada(id);
      setExito("Liquidación marcada como pagada.");
      cargar();
    } catch (e) {
      setError(e.message || "No se pudo marcar como pagada.");
    } finally {
      setPagando(null);
    }
  }

  async function ejecutarBarrido() {
    setEjecutandoBarrido(true);
    setError(null);
    setExito(null);
    try {
      const res = await ApiClient.ejecutarLiquidaciones();
      const r = res.resumen || {};
      setExito(`Barrido BCI completado: ${r.pagadas || 0} transferidas/compensadas, ${r.fallidas || 0} fallidas, ${r.sin_cuenta || 0} sin cuenta.`);
      cargar();
    } catch (e) {
      setError(e.message || "Error al ejecutar el barrido de liquidaciones.");
    } finally {
      setEjecutandoBarrido(false);
    }
  }

  const liquidaciones = Array.isArray(liq) ? liq : [];
  const listaMultas = Array.isArray(multas) ? multas : [];
  const transacciones = Array.isArray(pagos) ? pagos : [];
  const pendPorLiquidar = fin?.total_liquidaciones_pendientes_clp ?? 0;
  const totalMultasPendientes = listaMultas
    .filter((m) => m.estado === "pendiente")
    .reduce((acc, m) => acc + (m.monto_clp || 0), 0);

  return (
    <Shell title="Finanzas">
      <PageIntro title="Finanzas">
        El dinero de la plataforma: liquidaciones bancarias, compensaciones legales de multas y transacciones en pasarela.
      </PageIntro>

      {error ? <StateMsg kind="err">{error}</StateMsg> : null}
      {exito ? <StateMsg kind="ok">{exito}</StateMsg> : null}

      <div className="grid g-4" style={{ marginBottom: 20 }}>
        <Kpi icon={Wallet} label="Holds capturados" value={fin ? formatoCLP(fin.total_holds_capturados_clp) : "—"} />
        <Kpi icon={CheckCircle2} label="Cobros finales" value={fin ? formatoCLP(fin.total_cobros_finales_clp) : "—"} sub={fin ? `${fin.cantidad_transacciones} transacciones` : ""} />
        <Kpi icon={Clock} label="Por liquidar a dueños" value={fin ? formatoCLP(pendPorLiquidar) : "—"} />
        <Kpi icon={ShieldAlert} label="Multas pendientes a cobrar" value={formatoCLP(totalMultasPendientes)} sub={`${listaMultas.filter(m => m.estado === "pendiente").length} multas`} />
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-head">
          <Clock />
          <h3>Liquidaciones a dueños (BCI Payouts)</h3>
          <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
            <button
              className="btn btn-primary btn-sm"
              onClick={ejecutarBarrido}
              disabled={ejecutandoBarrido}
              title="Ejecuta transferencias BCI y compensa deudas de multas pendientes según Art. 1655 Código Civil"
            >
              <Play size={13} />
              {ejecutandoBarrido ? "Procesando…" : "Procesar pagos y compensaciones BCI"}
            </button>
            <button className="btn btn-mint btn-sm" disabled title="Próximamente: exportación bancaria"><Download size={13} />Nómina</button>
          </div>
        </div>
        {liquidaciones.length === 0 ? (
          <div style={{ padding: 24 }}>
            <EmptyState icon={Wallet} title={liq ? "Sin liquidaciones" : "Cargando..."}>
              {liq ? "No hay transferencias pendientes ni recientes." : "Cargando liquidaciones..."}
            </EmptyState>
          </div>
        ) : (
          <div className="table-wrap flush">
            <table className="t">
              <thead>
                <tr>
                  <th>Dueño</th>
                  <th>Cuenta bancaria</th>
                  <th className="num">Reservas</th>
                  <th className="num">Bruto</th>
                  <th className="num">Comisión</th>
                  <th className="num">Multas por compensar</th>
                  <th className="num">A transferir neto</th>
                  <th>Estado</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {liquidaciones.map((l) => (
                  <tr key={l.id}>
                    <td className="cell-2">
                      <b>{l.dueno_nombre}</b>
                      <span className="mono">{l.dueno_rut || "—"}</span>
                    </td>
                    <td style={{ fontSize: 12, color: "var(--muted)" }}>{l.cuenta_bancaria || "—"}</td>
                    <td className="num tnum">{l.reservas_count ?? "—"}</td>
                    <td className="num tnum" style={{ color: "var(--muted)" }}>{formatoCLP(l.bruto_clp)}</td>
                    <td className="num tnum" style={{ color: "var(--muted)" }}>−{formatoCLP(l.comision_clp)}</td>
                    <td className="num tnum" style={{ color: (l.multas_pendientes_clp > 0) ? "var(--danger, #e53e3e)" : "var(--muted)" }}>
                      {l.multas_pendientes_clp > 0 ? `−${formatoCLP(l.multas_pendientes_clp)}` : "—"}
                    </td>
                    <td className="num tnum" style={{ fontWeight: 700, color: "var(--ink)" }}>
                      {formatoCLP(l.neto_a_transferir_clp !== undefined ? l.neto_a_transferir_clp : l.neto_clp)}
                    </td>
                    <td><Chip estado={l.estado} /></td>
                    <td>
                      {l.estado === "pendiente"
                        ? <button className="btn btn-sm" disabled={pagando === l.id} onClick={() => marcarPagada(l.id)}>{pagando === l.id ? "…" : "Marcar pagada"}</button>
                        : <span style={{ fontSize: 11.5, color: "var(--muted)" }}>{fecha(l.pagada_en)}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Multas a dueños y compensación legal */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-head">
          <ShieldAlert />
          <h3>Multas a dueños (Incumplimientos y Compensación Legal)</h3>
        </div>
        <div style={{ padding: "12px 16px", background: "var(--surface-2)", borderBottom: "1px solid var(--border)", fontSize: 12, color: "var(--muted)", display: "flex", alignItems: "center", gap: 8 }}>
          <AlertCircle size={15} style={{ flexShrink: 0, color: "var(--primary)" }} />
          <span>
            <b>Marco legal chileno (Art. 1655 Código Civil):</b> La compensación de deudas opera de pleno derecho cuando dos partes son deudoras una de otra. Las multas impagas del dueño se descuentan automáticamente de sus próximas liquidaciones bancarias.
          </span>
        </div>
        {listaMultas.length === 0 ? (
          <div style={{ padding: 24 }}>
            <EmptyState icon={Gavel} title="Sin multas a dueños">No se registran penalizaciones aplicadas a dueños.</EmptyState>
          </div>
        ) : (
          <div className="table-wrap flush">
            <table className="t">
              <thead>
                <tr>
                  <th>Multa ID</th>
                  <th>Dueño</th>
                  <th>Reserva</th>
                  <th className="num">Monto</th>
                  <th>Estado</th>
                  <th>Motivo</th>
                  <th>Referencia / Compensación</th>
                  <th>Fecha</th>
                </tr>
              </thead>
              <tbody>
                {listaMultas.map((m) => (
                  <tr key={m.id}>
                    <td className="mono" style={{ fontWeight: 600 }}>{String(m.id).slice(0, 8)}</td>
                    <td className="cell-2">
                      <b>{m.dueno_nombre}</b>
                      <span className="mono">{m.dueno_rut || "—"}</span>
                    </td>
                    <td className="mono">{m.reserva_id ? String(m.reserva_id).slice(0, 8) : "—"}</td>
                    <td className="num tnum" style={{ fontWeight: 600 }}>{formatoCLP(m.monto_clp)}</td>
                    <td><Chip estado={m.estado} /></td>
                    <td style={{ fontSize: 12, maxWidth: 280, color: "var(--muted)" }}>{m.motivo}</td>
                    <td className="mono" style={{ fontSize: 11 }}>{m.referencia_pago || "Pendiente de liquidación"}</td>
                    <td style={{ color: "var(--muted)", fontSize: 12 }}>{fecha(m.fecha)}</td>
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
            <EmptyState icon={CreditCard} title={pagos ? "Sin transacciones" : "Cargando..."}>
              {pagos ? "No hay movimientos registrados." : "Cargando transacciones..."}
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
