import { useMemo, useState } from "react";
import { Search, FileText, Calendar } from "lucide-react";
import Shell from "../components/Shell";
import { PageIntro, Chip, Segmented, StateMsg, EmptyState, Drawer, useAsync, formatoCLP } from "../components/ui";
import { ApiClient } from "../lib/api";

const FILTROS = [
  { value: "todas", label: "Todas" },
  { value: "en_curso", label: "En curso" },
  { value: "pendiente_pago", label: "Pendiente pago" },
  { value: "disputada", label: "En disputa" },
  { value: "finalizada", label: "Finalizada" },
];

const fecha = (d) => (d ? new Date(d).toLocaleString("es-CL", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—");

export default function Reservas() {
  const { data, error, cargando } = useAsync(() => ApiClient.getReservas());
  const [filtro, setFiltro] = useState("todas");
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(null);

  const reservas = Array.isArray(data) ? data : data?.items || [];
  const filtradas = useMemo(() => {
    const t = q.toLowerCase().trim();
    return reservas.filter((r) => {
      if (filtro !== "todas" && r.estado !== filtro) return false;
      if (!t) return true;
      return [r.id, r.auto?.patente, r.patente, r.cliente_nombre, r.cliente?.nombre]
        .some((v) => (v || "").toString().toLowerCase().includes(t));
    });
  }, [reservas, filtro, q]);

  return (
    <Shell title="Reservas">
      <PageIntro title="Reservas">
        Todas las reservas de la plataforma. Abre una para ver el auto, las dos partes, los montos, las firmas y los checklists.
      </PageIntro>

      {error ? (
        <StateMsg>
          {error} — el panel necesita el endpoint <code className="mono">GET /admin/reservas</code>, que el backend todavía no expone.
        </StateMsg>
      ) : null}

      <div className="filters">
        <Segmented options={FILTROS} value={filtro} onChange={setFiltro} />
        <div className="search fsearch">
          <Search size={14} />
          <input placeholder="Buscar por ID, patente o cliente…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <span className="count-hint"><b>{filtradas.length}</b> reservas</span>
      </div>

      {cargando ? (
        <EmptyState icon={Calendar} title="Cargando reservas…" />
      ) : filtradas.length === 0 ? (
        <EmptyState icon={Calendar} title={error ? "Sin datos" : "No hay reservas que coincidan"}>
          {error ? "Se muestra vacío hasta que el endpoint esté disponible." : "Prueba con otro filtro o término de búsqueda."}
        </EmptyState>
      ) : (
        <div className="table-wrap">
          <table className="t">
            <thead>
              <tr>
                <th>Reserva</th><th>Auto</th><th>Cliente</th><th>Dueño</th><th>Fechas</th>
                <th>Estado</th><th className="num">Cobro</th><th className="num">Garantía</th><th />
              </tr>
            </thead>
            <tbody>
              {filtradas.map((r) => (
                <tr key={r.id}>
                  <td className="mono" style={{ fontWeight: 600 }}>{r.id}</td>
                  <td className="cell-2">
                    <b>{r.auto ? `${r.auto.marca} ${r.auto.modelo} ${r.auto.anio || ""}` : r.auto_nombre || "—"}</b>
                    <span className="mono">{r.auto?.patente || r.patente || ""}</span>
                  </td>
                  <td>{r.cliente?.nombre || r.cliente_nombre || "—"}</td>
                  <td style={{ color: "var(--muted)" }}>{r.dueno?.nombre || r.dueno_nombre || "—"}</td>
                  <td style={{ color: "var(--muted)", fontSize: 12 }}>{fecha(r.fecha_inicio)} → {fecha(r.fecha_fin)}</td>
                  <td><Chip estado={r.estado} /></td>
                  <td className="num tnum">{r.monto_cobro ? formatoCLP(r.monto_cobro) : "—"}</td>
                  <td className="num tnum" style={{ color: "var(--muted)" }}>{r.monto_hold ? formatoCLP(r.monto_hold) : "—"}</td>
                  <td><button className="row-link" onClick={() => setSel(r)}>Ver detalle</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Drawer
        open={!!sel}
        onOpenChange={(o) => !o && setSel(null)}
        title={sel ? `Reserva ${sel.id}` : ""}
        sub={sel ? `${sel.auto ? `${sel.auto.marca} ${sel.auto.modelo}` : sel.auto_nombre || ""} · ${sel.auto?.patente || sel.patente || ""}` : ""}
        footer={<>
          <button className="btn"><FileText size={14} />Ver contrato PDF</button>
          <button className="btn btn-ghost">Ver chat de la reserva</button>
        </>}
      >
        {sel ? <DetalleReserva r={sel} /> : null}
      </Drawer>
    </Shell>
  );
}

function DetalleReserva({ r }) {
  const cobro = r.monto_cobro || 0;
  const neto = Math.round(cobro / 1.19);
  const iva = cobro - neto;
  const comis = Math.round(cobro * 0.2);
  const cargos = (r.cargo_limpieza_clp || 0) + (r.cargo_combustible_clp || 0) + (r.cargo_km_extra_clp || 0) + (r.cargo_atraso_clp || 0) + (r.cargos_adicionales_clp || 0) + (r.cargo_falta_grave_clp || 0);
  const firmas = Array.isArray(r.firmas) ? r.firmas : [];

  return (
    <>
      <h4>Estado</h4>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <Chip estado={r.estado} />
        <span className="chip neutral">{fecha(r.fecha_inicio)} → {fecha(r.fecha_fin)}</span>
      </div>

      <h4>Partes</h4>
      <dl className="dl">
        <dt>Arrendatario</dt><dd>{r.cliente?.nombre || r.cliente_nombre || "—"}</dd>
        <dt>Dueño</dt><dd>{r.dueno?.nombre || r.dueno_nombre || "—"}</dd>
        <dt>Punto de entrega</dt><dd>{r.lugar_entrega_acordado || "—"}</dd>
      </dl>

      <h4>Dinero</h4>
      <div className="money-row"><span className="muted">Arriendo (neto)</span><span className="m">{formatoCLP(neto)}</span></div>
      <div className="money-row"><span className="muted">IVA 19%</span><span className="m">{formatoCLP(iva)}</span></div>
      <div className="money-row"><span>Cobrado a débito</span><span className="m">{formatoCLP(cobro)}</span></div>
      {cargos ? <div className="money-row"><span style={{ color: "var(--danger)" }}>Cargos posteriores</span><span className="m" style={{ color: "var(--danger)" }}>{formatoCLP(cargos)}</span></div> : null}
      <div className="money-row"><span className="muted">Garantía retenida (crédito)</span><span className="m muted">{formatoCLP(r.monto_hold)}</span></div>
      <div className="money-row"><span className="muted">Comisión plataforma (20%)</span><span className="m muted">{formatoCLP(comis)}</span></div>
      <div className="money-row total"><span>Liquidación al dueño</span><span className="m">{formatoCLP(r.liquidacion_dueno_clp || (cobro - comis + cargos))}</span></div>

      <h4>Contrato &amp; entrega</h4>
      <div className="timeline">
        <div className="tl-item"><b>Reserva creada</b><span>{fecha(r.creado_en)}</span></div>
        {firmas.length ? firmas.map((s, i) => (
          <div className="tl-item" key={i}><b>Contrato firmado — {s.rol}</b><span>{s.metodo} · {fecha(s.firmado_en)}</span></div>
        )) : <div className="tl-item"><b>Contrato</b><span>Sin firmas registradas</span></div>}
        {r.checklist_entrega ? <div className="tl-item"><b>Checklist de entrega</b><span>{r.checklist_entrega.kilometraje} km · {r.checklist_entrega.nivel_combustible}</span></div> : null}
        {r.checklist_devolucion ? <div className="tl-item"><b>Checklist de devolución</b><span>{r.checklist_devolucion.kilometraje} km · {r.checklist_devolucion.estado_limpieza}</span></div> : null}
      </div>
    </>
  );
}
