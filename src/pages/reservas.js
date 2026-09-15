import { useEffect, useMemo, useState } from "react";
import { Search, FileText, Calendar, MessageSquare } from "lucide-react";
import Shell from "../components/Shell";
import { PageIntro, Chip, Segmented, StateMsg, EmptyState, Drawer, formatoCLP } from "../components/ui";
import { ApiClient } from "../lib/api";
import { fecha } from "../lib/format";

const FILTROS = [
  { value: "todas", label: "Todas" },
  { value: "en_curso", label: "En curso" },
  { value: "pendiente_pago", label: "Pendiente pago" },
  { value: "disputada", label: "En disputa" },
  { value: "finalizada", label: "Finalizada" },
];

// GET /admin/reservas filtra con estado/q y pagina con limit/cursor. Tanto la
// búsqueda como el filtro de estado van server-side.
const LIMITE = 50;

export default function Reservas() {
  const [items, setItems] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [cargandoMas, setCargandoMas] = useState(false);
  const [error, setError] = useState(null);
  const [filtro, setFiltro] = useState("todas");
  const [q, setQ] = useState("");
  const [qDeb, setQDeb] = useState("");
  const [sel, setSel] = useState(null);
  const [descargando, setDescargando] = useState(false);
  const [contratoErr, setContratoErr] = useState(null);
  const [chat, setChat] = useState(null);
  const [chatMsgs, setChatMsgs] = useState(null);
  const [chatErr, setChatErr] = useState(null);
  const [chatCargando, setChatCargando] = useState(false);

  // Debounce de la búsqueda (300ms) para no pegarle a la API por cada tecla.
  useEffect(() => {
    const t = setTimeout(() => setQDeb(q), 300);
    return () => clearTimeout(t);
  }, [q]);

  const serverParams = useMemo(() => {
    const p = { limit: LIMITE };
    const t = qDeb.trim();
    if (t) p.q = t;
    if (filtro !== "todas") p.estado = filtro;
    return p;
  }, [qDeb, filtro]);

  // Carga inicial y recarga al cambiar búsqueda/filtro (página 1, reemplaza).
  useEffect(() => {
    let vivo = true;
    setCargando(true);
    setError(null);
    setCursor(null);
    ApiClient.getReservas(serverParams)
      .then((d) => {
        if (!vivo) return;
        setItems(Array.isArray(d) ? d : d?.items || []);
        setCursor(d?.next_cursor || null);
      })
      .catch((e) => vivo && setError(e.message || "No se pudo cargar la lista de reservas."))
      .finally(() => vivo && setCargando(false));
    return () => { vivo = false; };
  }, [serverParams]);

  async function cargarMas() {
    if (!cursor || cargandoMas) return;
    setCargandoMas(true);
    try {
      const d = await ApiClient.getReservas({ ...serverParams, cursor });
      const arr = Array.isArray(d) ? d : d?.items || [];
      setItems((prev) => {
        const ids = new Set(prev.map((x) => x.id));
        return [...prev, ...arr.filter((x) => !ids.has(x.id))];
      });
      setCursor(d?.next_cursor || null);
    } catch (e) {
      setError(e.message || "No se pudo cargar más reservas.");
    } finally {
      setCargandoMas(false);
    }
  }

  const mapaAutores = useMemo(() => {
    const m = {};
    if (chat?.cliente?.id) m[chat.cliente.id] = `Arrendatario${chat.cliente.nombre ? ` · ${chat.cliente.nombre}` : ""}`;
    if (chat?.dueno?.id) m[chat.dueno.id] = `Dueño${chat.dueno.nombre ? ` · ${chat.dueno.nombre}` : ""}`;
    return m;
  }, [chat]);

  async function verContrato(r) {
    setDescargando(true); setContratoErr(null);
    try {
      const url = await ApiClient.getContratoPdfUrl(r.id);
      const a = document.createElement("a");
      a.href = url; a.target = "_blank"; a.rel = "noreferrer";
      document.body.appendChild(a); a.click(); a.remove();
    } catch (e) {
      setContratoErr(e.message || "No se pudo descargar el contrato.");
    } finally {
      setDescargando(false);
    }
  }

  async function verChat(r) {
    setChat(r); setChatMsgs(null); setChatErr(null); setChatCargando(true);
    try {
      const msgs = await ApiClient.getReservaMensajes(r.id);
      setChatMsgs(Array.isArray(msgs) ? msgs : []);
    } catch (e) {
      setChatErr(e.message || "No se pudieron cargar los mensajes del chat.");
    } finally {
      setChatCargando(false);
    }
  }

  return (
    <Shell title="Reservas">
      <PageIntro title="Reservas">
        Todas las reservas de la plataforma. Abre una para ver el auto, las dos partes, los montos, las firmas y los checklists.
      </PageIntro>

      {error ? (
        <StateMsg>
          {error} — no se pudo obtener <code className="mono">GET /admin/reservas</code>.
        </StateMsg>
      ) : null}

      <div className="filters">
        <Segmented options={FILTROS} value={filtro} onChange={setFiltro} />
        <div className="search fsearch">
          <Search size={14} />
          <input placeholder="Buscar por ID, patente o cliente…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <span className="count-hint"><b>{items.length}</b> reservas</span>
      </div>

      {cargando ? (
        <EmptyState icon={Calendar} title="Cargando reservas…" />
      ) : items.length === 0 ? (
        <EmptyState icon={Calendar} title={error ? "Sin datos" : "No hay reservas que coincidan"}>
          {error ? "Se muestra vacío hasta que la API responda." : "Prueba con otro filtro o término de búsqueda."}
        </EmptyState>
      ) : (
        <>
          <div className="table-wrap">
            <table className="t">
              <thead>
                <tr>
                  <th>Reserva</th><th>Auto</th><th>Cliente</th><th>Dueño</th><th>Fechas</th>
                  <th>Estado</th><th className="num">Cobro</th><th className="num">Garantía</th><th />
                </tr>
              </thead>
              <tbody>
                {items.map((r) => (
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
          {cursor ? (
            <div style={{ display: "flex", justifyContent: "center", marginTop: 14 }}>
              <button className="btn" onClick={cargarMas} disabled={cargandoMas}>
                {cargandoMas ? "Cargando…" : "Cargar más"}
              </button>
            </div>
          ) : null}
        </>
      )}

      <Drawer
        open={!!sel}
        onOpenChange={(o) => !o && setSel(null)}
        title={sel ? `Reserva ${sel.id}` : ""}
        sub={sel ? `${sel.auto ? `${sel.auto.marca} ${sel.auto.modelo}` : sel.auto_nombre || ""} · ${sel.auto?.patente || sel.patente || ""}` : ""}
        footer={<>
          <button className="btn" onClick={() => verContrato(sel)} disabled={descargando}><FileText size={14} />{descargando ? "Descargando…" : "Ver contrato PDF"}</button>
          <button className="btn btn-ghost" onClick={() => verChat(sel)}><MessageSquare size={14} />Ver chat de la reserva</button>
        </>}
      >
        {contratoErr ? <StateMsg>{contratoErr}</StateMsg> : null}
        {sel ? <DetalleReserva r={sel} /> : null}
      </Drawer>

      <Drawer
        open={!!chat}
        onOpenChange={(o) => { if (!o) { setChat(null); setChatMsgs(null); setChatErr(null); } }}
        title={chat ? `Chat de la reserva ${chat.id}` : ""}
        sub={chat ? `${chat.auto ? `${chat.auto.marca} ${chat.auto.modelo}` : chat.auto_nombre || ""}` : ""}
      >
        {chatCargando ? <EmptyState icon={MessageSquare} title="Cargando mensajes…" />
          : chatErr ? <StateMsg>{chatErr}</StateMsg>
          : !chatMsgs || chatMsgs.length === 0 ? <EmptyState icon={MessageSquare} title="Sin mensajes">Aún no hay conversación en esta reserva.</EmptyState>
          : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: 420, overflow: "auto" }}>
              {chatMsgs.map((m) => (
                <div key={m.id} style={{ background: "var(--surface-2)", border: "1px solid var(--line)", borderRadius: 10, padding: "10px 12px" }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 4 }}>
                    <b style={{ fontSize: 12 }}>{mapaAutores[m.autor_id] || "Usuario"}</b>
                    <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--muted)" }}>{fecha(m.timestamp)}</span>
                  </div>
                  <div style={{ fontSize: 13, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{m.texto}</div>
                </div>
              ))}
            </div>
          )}
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