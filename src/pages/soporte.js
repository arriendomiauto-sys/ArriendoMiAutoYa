import { useEffect, useMemo, useState } from "react";
import { Search, LifeBuoy, Gavel, Check } from "lucide-react";
import Shell from "../components/Shell";
import { PageIntro, Chip, Segmented, StateMsg, EmptyState, Drawer, useAsync } from "../components/ui";
import { ApiClient } from "../lib/api";
import { fecha } from "../lib/format";

const FILTROS = [
  { value: "abierto", label: "Abiertos" },
  { value: "cerrado", label: "Cerrados" },
  { value: "todos", label: "Todos" },
];

export default function Soporte() {
  const { data, error, cargando, recargar } = useAsync(() => ApiClient.getTickets());
  const [filtro, setFiltro] = useState("abierto");
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(null);
  const [escalar, setEscalar] = useState(null);
  const [reservaId, setReservaId] = useState("");
  const [accionMsg, setAccionMsg] = useState(null);
  const [respuesta, setRespuesta] = useState("");

  useEffect(() => { setRespuesta(""); }, [sel]);

  const tickets = useMemo(() => (Array.isArray(data) ? data : []), [data]);
  const filtrados = useMemo(() => {
    const t = q.toLowerCase().trim();
    return tickets.filter((k) => {
      if (filtro !== "todos" && k.estado !== filtro) return false;
      if (!t) return true;
      return [k.asunto, k.descripcion, k.usuario_nombre, k.id].some((v) => (v || "").toLowerCase().includes(t));
    });
  }, [tickets, filtro, q]);

  async function cerrar(id) {
    try { await ApiClient.cerrarTicket(id); setSel(null); recargar(); }
    catch (e) { setAccionMsg({ ok: false, t: e.message }); }
  }
  async function doEscalar() {
    if (!reservaId.trim()) return;
    try {
      await ApiClient.escalarTicket(escalar.id, reservaId.trim());
      setEscalar(null); setReservaId(""); setSel(null); recargar();
    } catch (e) { setAccionMsg({ ok: false, t: e.message }); }
  }

  return (
    <Shell title="Soporte">
      <PageIntro title="Soporte">
        Bandeja de tickets. Ciérralos cuando queden resueltos, o escálalos a disputa formal si hay dinero en juego entre dos partes.
      </PageIntro>

      {error ? <StateMsg>{error}</StateMsg> : null}
      {accionMsg ? <StateMsg kind={accionMsg.ok ? "ok" : "err"}>{accionMsg.t}</StateMsg> : null}

      <div className="filters">
        <Segmented options={FILTROS} value={filtro} onChange={setFiltro} />
        <div className="search fsearch"><Search size={14} /><input placeholder="Asunto o usuario…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <span className="count-hint"><b>{tickets.filter((t) => t.estado === "abierto").length}</b> abiertos</span>
      </div>

      {cargando ? (
        <EmptyState icon={LifeBuoy} title="Cargando tickets…" />
      ) : filtrados.length === 0 ? (
        <EmptyState icon={LifeBuoy} title="Bandeja vacía" />
      ) : (
        <div className="table-wrap">
          <table className="t">
            <thead><tr><th>Ticket</th><th>Asunto</th><th>Usuario</th><th>Estado</th><th>Fecha</th><th /></tr></thead>
            <tbody>
              {filtrados.map((t) => (
                <tr key={t.id}>
                  <td className="mono" style={{ fontWeight: 600 }}>{String(t.id).slice(0, 8)}</td>
                  <td className="cell-2">
                    <b>{t.asunto}</b>
                    <span>{t.escalado_a_disputa ? "Escalado a disputa" : (t.descripcion || "").slice(0, 56) + "…"}</span>
                  </td>
                  <td>{t.usuario_nombre || t.usuario?.nombre || "—"}</td>
                  <td><Chip estado={t.estado} /></td>
                  <td style={{ color: "var(--muted)", fontSize: 12 }}>{fecha(t.timestamp)}</td>
                  <td><button className="row-link" onClick={() => setSel(t)}>Abrir</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Detalle del ticket */}
      <Drawer
        open={!!sel}
        onOpenChange={(o) => !o && setSel(null)}
        title={sel?.asunto || ""}
        sub={sel ? `${String(sel.id).slice(0, 8)} · ${sel.usuario_nombre || "—"} · ${fecha(sel.timestamp)}` : ""}
        footer={sel?.estado === "abierto" ? <>
          <button className="btn btn-mint" onClick={() => cerrar(sel.id)}><Check size={14} />Responder y cerrar</button>
          {!sel.escalado_a_disputa ? <button className="btn" onClick={() => setEscalar(sel)}><Gavel size={14} />Escalar</button> : null}
        </> : <span style={{ fontSize: 12, color: "var(--muted)", alignSelf: "center" }}>Ticket cerrado</span>}
      >
        {sel ? (
          <>
            <h4>Estado</h4>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Chip estado={sel.estado} />
              {sel.escalado_a_disputa ? <span className="chip danger"><span className="dot" />Escalado a disputa</span> : null}
            </div>
            <h4>Mensaje del usuario</h4>
            <div style={{ background: "var(--surface-2)", border: "1px solid var(--line)", borderRadius: 10, padding: "12px 14px", fontSize: 13 }}>
              {sel.descripcion}
            </div>
            <h4>Responder</h4>
            <textarea className="input" rows={4} style={{ width: "100%" }} placeholder="Escribe tu respuesta al usuario…" value={respuesta} onChange={(e) => setRespuesta(e.target.value)} />
            <div className="hint" style={{ marginTop: 6 }}>
              El envío de la respuesta todavía no está disponible: la API no expone un endpoint para responder tickets. Por ahora el botón “Responder y cerrar” solo cierra el ticket.
            </div>
            {!sel.escalado_a_disputa ? (
              <div className="state-msg warn" style={{ marginTop: 14, marginBottom: 0 }}>
                ¿Hay dinero en juego entre dos partes? Escala a disputa formal e ingresa la reserva asociada.
              </div>
            ) : null}
          </>
        ) : null}
      </Drawer>

      {/* Escalar */}
      <Drawer
        open={!!escalar}
        onOpenChange={(o) => !o && setEscalar(null)}
        title="Escalar a disputa formal"
        sub={escalar?.asunto}
        footer={<button className="btn btn-mint" onClick={doEscalar}><Gavel size={14} />Escalar</button>}
      >
        <div className="field">
          <label>ID de la reserva asociada</label>
          <input className="input" value={reservaId} onChange={(e) => setReservaId(e.target.value)} placeholder="RSV-…" />
          <div className="hint">La disputa quedará vinculada a esta reserva para tener el contexto de montos y checklists.</div>
        </div>
      </Drawer>
    </Shell>
  );
}
