import { useState } from "react";
import { Gavel, Eye } from "lucide-react";
import Shell from "../components/Shell";
import { PageIntro, Chip, Segmented, StateMsg, EmptyState, Drawer, useAsync, formatoCLP } from "../components/ui";
import { useAuth } from "../context/AuthContext";
import ArchivoPrivado, { abrirArchivo } from "../components/ArchivoPrivado";
import { ApiClient } from "../lib/api";
import { fecha } from "../lib/format";

const TIPO = {
  dano: "Daño", limpieza: "Limpieza", combustible: "Combustible",
  no_coincidencia_identidad: "Identidad", incumplimiento: "Incumplimiento", atraso: "Atraso", otro: "Otro",
};
const ACCIONES_PAGO = [
  { value: "reembolso_total", label: "Reembolso total al cliente" },
  { value: "cobro_cliente", label: "Cobro al cliente" },
  { value: "division_deducible_50_50", label: "División del deducible 50/50" },
  { value: "cargo_limpieza_dueno", label: "Cargo de limpieza al dueño" },
  { value: "sin_cobro", label: "Sin cobro" },
];

export default function Disputas() {
  const [estado, setEstado] = useState("abierta");
  const { data, error, cargando, recargar } = useAsync(() => ApiClient.getDisputas(estado), [estado]);
  const [sel, setSel] = useState(null);

  const disputas = Array.isArray(data) ? data : [];
  const abiertas = disputas.filter((d) => d.estado !== "resuelta");
  const resueltas = disputas.filter((d) => d.estado === "resuelta");

  return (
    <Shell title="Disputas">
      <PageIntro title="Disputas">
        Casos formales entre cliente y dueño. Revisa la evidencia, la reserva de contexto y aplica una resolución de pago.
      </PageIntro>

      {error ? <StateMsg>{error}</StateMsg> : null}

      <div className="filters">
        <Segmented
          options={[{ value: "abierta", label: "Abiertas" }, { value: "resuelta", label: "Resueltas" }]}
          value={estado}
          onChange={setEstado}
        />
        <span className="count-hint"><b>{disputas.length}</b> {estado === "abierta" ? "abiertas" : "resueltas"}</span>
      </div>

      {cargando ? (
        <EmptyState icon={Gavel} title="Cargando disputas…" />
      ) : estado === "abierta" ? (
        abiertas.length === 0
          ? <EmptyState icon={Gavel} title="Sin disputas abiertas">Nada que resolver por ahora.</EmptyState>
          : <div className="grid" style={{ gap: 12 }}>{abiertas.map((d) => <CardDisputa key={d.id} d={d} onResolver={() => setSel(d)} />)}</div>
      ) : (
        resueltas.length === 0
          ? <EmptyState icon={Gavel} title="Sin disputas resueltas" />
          : (
            <div className="table-wrap">
              <table className="t">
                <thead><tr><th>Caso</th><th>Tipo</th><th>Reserva</th><th>Resolución</th><th>Fecha</th></tr></thead>
                <tbody>
                  {resueltas.map((d) => (
                    <tr key={d.id}>
                      <td className="mono" style={{ fontWeight: 600 }}>{String(d.id).slice(0, 8)}</td>
                      <td>{TIPO[d.tipo] || d.tipo}</td>
                      <td className="mono">{String(d.reserva_id).slice(0, 8)}</td>
                      <td style={{ fontSize: 12, color: "var(--muted)", maxWidth: 360 }}>{d.resolucion || "—"}</td>
                      <td style={{ color: "var(--muted)", fontSize: 12 }}>{fecha(d.timestamp)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
      )}

      <Drawer
        open={!!sel}
        onOpenChange={(o) => !o && setSel(null)}
        title={sel ? `Disputa ${String(sel.id).slice(0, 8)}` : ""}
        sub={sel ? `${TIPO[sel.tipo] || sel.tipo} · reserva ${String(sel.reserva_id).slice(0, 8)}` : ""}
      >
        {sel ? <Resolver d={sel} onDone={() => { setSel(null); recargar(); }} /> : null}
      </Drawer>
    </Shell>
  );
}

function CardDisputa({ d, onResolver }) {
  const nFotos = (Array.isArray(d.evidencia_fotos) ? d.evidencia_fotos.length : 0) + (d.foto_evidencia_url ? 1 : 0);
  return (
    <div className="card card-pad" style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
      <div style={{ flex: "none", width: 44, height: 44, borderRadius: 11, background: "var(--danger-tint)", color: "var(--danger)", display: "grid", placeItems: "center" }}>
        <Gavel size={18} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
          <b className="mono" style={{ fontSize: 13 }}>{String(d.id).slice(0, 8)}</b>
          <Chip estado={d.estado} />
          <span className="chip neutral">{TIPO[d.tipo] || d.tipo}</span>
          <span style={{ fontSize: 11.5, color: "var(--muted)", marginLeft: "auto" }}>{fecha(d.timestamp)}</span>
        </div>
        <p style={{ margin: "0 0 8px", fontSize: 13, color: "var(--ink-2)" }}>{d.motivo || "Sin descripción."}</p>
        <div style={{ fontSize: 12, color: "var(--muted)" }}>
          Reserva <b className="mono" style={{ color: "var(--ink)" }}>{String(d.reserva_id).slice(0, 8)}</b>
          {nFotos ? ` · ${nFotos} foto${nFotos > 1 ? "s" : ""} de evidencia` : ""}
        </div>
      </div>
      <button className="btn btn-mint" style={{ flex: "none" }} onClick={onResolver}>Resolver</button>
    </div>
  );
}

function Resolver({ d, onDone }) {
  const { esAdmin } = useAuth();
  const [accion, setAccion] = useState(ACCIONES_PAGO[0].value);
  const [texto, setTexto] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [err, setErr] = useState(null);
  const [analisisIA, setAnalisisIA] = useState(null);
  const [cargandoIA, setCargandoIA] = useState(false);

  const fotos = useMemo(
    () => [...(d?.foto_evidencia_url ? [d.foto_evidencia_url] : []), ...(Array.isArray(d?.evidencia_fotos) ? d.evidencia_fotos : [])],
    [d?.foto_evidencia_url, d?.evidencia_fotos]
  );

  useEffect(() => {
    if (d?.reserva_id && fotos.length) {
      setCargandoIA(true);
      ApiClient.analizarDanosIA(d.reserva_id, { fotos_despues: fotos, notas: d?.motivo })
        .then(setAnalisisIA)
        .catch(() => {})
        .finally(() => setCargandoIA(false));
    }
  }, [d?.id, d?.reserva_id, d?.motivo, fotos]);

  async function resolver() {
    if (!texto.trim()) { setErr("Escribe el fundamento de la resolución."); return; }
    setGuardando(true); setErr(null);
    try {
      await ApiClient.resolverDisputa(d.id, texto.trim(), accion);
      onDone();
    } catch (e) {
      setErr(e.message || "No se pudo resolver.");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <>
      <h4>El caso</h4>
      <p style={{ margin: "0 0 8px", fontSize: 13 }}>{d.motivo || "Sin descripción."}</p>
      <dl className="dl">
        <dt>Reserva</dt><dd className="mono">{d.reserva_id}</dd>
        <dt>Abierta</dt><dd className="mono">{fecha(d.timestamp)}</dd>
        <dt>Estado</dt><dd><Chip estado={d.estado} /></dd>
      </dl>

      {fotos.length ? (
        <>
          <h4>Evidencia ({fotos.length})</h4>
          <div className="doc-grid">
            {fotos.map((u, i) => (
              <button type="button" className="doc-thumb" key={i} onClick={() => abrirArchivo(u).catch(() => {})}>
                <ArchivoPrivado url={u} alt={`Evidencia ${i + 1}`} />
                <span className="tag">Foto {i + 1}</span>
              </button>
            ))}
          </div>
        </>
      ) : null}

      {/* Dictamen Asistido por IA */}
      <div style={{ margin: "16px 0", padding: 12, borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface-2)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <b style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>
            ✦ Peritaje Asistido por IA (Visión Multimodal)
          </b>
          {cargandoIA ? (
            <span style={{ fontSize: 11, color: "var(--muted)" }}>Analizando...</span>
          ) : (
            <span className={`chip ${analisisIA?.anomalia_detectada ? "warn" : "ok"}`}>
              {analisisIA?.anomalia_detectada ? "Anomalía confirmada" : "Sin daño evidente"}
            </span>
          )}
        </div>
        {analisisIA ? (
          <div style={{ fontSize: 12, display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6 }}>
              <div style={{ padding: "6px 8px", background: "var(--surface)", borderRadius: 6 }}>
                <div style={{ color: "var(--muted)", fontSize: 10 }}>Rayón</div>
                <b>{analisisIA.probabilidades?.rayon || 0}%</b>
              </div>
              <div style={{ padding: "6px 8px", background: "var(--surface)", borderRadius: 6 }}>
                <div style={{ color: "var(--muted)", fontSize: 10 }}>Golpe</div>
                <b>{analisisIA.probabilidades?.abolladura || 0}%</b>
              </div>
              <div style={{ padding: "6px 8px", background: "var(--surface)", borderRadius: 6 }}>
                <div style={{ color: "var(--muted)", fontSize: 10 }}>Choque</div>
                <b>{analisisIA.probabilidades?.choque || 0}%</b>
              </div>
              <div style={{ padding: "6px 8px", background: "var(--surface)", borderRadius: 6 }}>
                <div style={{ color: "var(--muted)", fontSize: 10 }}>Suciedad</div>
                <b>{analisisIA.probabilidades?.suciedad || 0}%</b>
              </div>
            </div>
            <p style={{ margin: "4px 0 0", color: "var(--ink-2)", lineHeight: 1.4 }}>
              {analisisIA.sugerencia_dueno}
            </p>
          </div>
        ) : cargandoIA ? (
          <p style={{ margin: 0, fontSize: 12, color: "var(--muted)" }}>Evaluando fotografías con el motor de visión...</p>
        ) : null}
      </div>

      <h4>Resolución</h4>
      {!esAdmin ? <div className="state-msg warn">Solo un Admin puede resolver formalmente una disputa.</div> : null}
      <div className="field">
        <label>Acción de pago</label>
        <select className="input" style={{ width: "100%" }} value={accion} onChange={(e) => setAccion(e.target.value)} disabled={!esAdmin}>
          {ACCIONES_PAGO.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
        </select>
        <div style={{ marginTop: 6, padding: "8px 10px", background: "var(--surface-2)", borderRadius: 6, fontSize: 11.5, color: "var(--muted)", borderLeft: "3px solid var(--primary)" }}>
          {accion === "reembolso_total" && "• Reembolso total: Se devuelve el 100% del arriendo al arrendatario vía Mercado Pago, se libera el 100% del hold de garantía y se anula la liquidación al dueño."}
          {accion === "cobro_cliente" && "• Cobro cliente: Se capturan los cargos/daños pendientes de la garantía para transferir al dueño y se libera el remanente al arrendatario."}
          {accion === "division_deducible_50_50" && "• División 50/50: Se captura el 50% de la garantía/deducible para el dueño y se libera el otro 50% al arrendatario."}
          {accion === "cargo_limpieza_dueno" && "• Cargo limpieza: Se captura solo el cargo de limpieza de la garantía para el dueño y se libera el resto al arrendatario."}
          {accion === "sin_cobro" && "• Sin cobro: No procede cobro de daños ni extras; la garantía se libera íntegramente al arrendatario."}
        </div>
      </div>
      <div className="field">
        <label>Fundamento (queda en el registro legal)</label>
        <textarea className="input" rows={3} style={{ width: "100%" }} value={texto} onChange={(e) => setTexto(e.target.value)} disabled={!esAdmin}
          placeholder="Ej.: El daño no aparece en el checklist de entrega y sí en 2 fotos de la devolución…" />
      </div>
      {err ? <div className="state-msg err" style={{ marginBottom: 0 }}>{err}</div> : null}
      <button className="btn btn-mint" style={{ width: "100%", justifyContent: "center", marginTop: 12 }} onClick={resolver} disabled={!esAdmin || guardando}>
        <Gavel size={14} />{guardando ? "Resolviendo…" : "Resolver disputa"}
      </button>
    </>
  );
}
