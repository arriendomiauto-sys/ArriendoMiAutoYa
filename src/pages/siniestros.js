import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Siren, Phone, Send, Check, Gavel, UserCheck } from "lucide-react";
import Shell from "../components/Shell";
import { PageIntro, Chip, Segmented, StateMsg, EmptyState, Drawer, useAsync } from "../components/ui";
import { ApiClient } from "../lib/api";
import { fecha } from "../lib/format";

const FILTROS = [
  { value: "", label: "Abiertos" },
  { value: "reportado", label: "Sin tomar" },
  { value: "en_atencion", label: "En atención" },
  { value: "cerrado", label: "Cerrados" },
];

const ESTADO = {
  reportado: ["danger", "Sin tomar"],
  en_atencion: ["warn", "En atención"],
  cerrado: ["neutral", "Cerrado"],
};

function EstadoChip({ estado }) {
  const [tone, label] = ESTADO[estado] || ["neutral", estado];
  return <Chip tone={tone}>{label}</Chip>;
}

function Tel({ numero }) {
  if (!numero) return <span style={{ color: "var(--muted)" }}>sin celular</span>;
  return <a href={`tel:${numero.replace(/\s/g, "")}`}><Phone size={12} /> {numero}</a>;
}

export default function Siniestros() {
  const [filtro, setFiltro] = useState("");
  const { data, error, cargando, recargar } = useAsync(() => ApiClient.getSiniestros(filtro), [filtro]);
  const [sel, setSel] = useState(null);
  const [mensaje, setMensaje] = useState("");
  const [accionMsg, setAccionMsg] = useState(null);
  const [ocupado, setOcupado] = useState(false);

  const casos = useMemo(() => (Array.isArray(data) ? data : []), [data]);
  useEffect(() => { setMensaje(""); }, [sel?.id]);

  // Revisa la bandeja cada 30 s: un accidente no puede esperar a que alguien recargue.
  useEffect(() => {
    const t = setInterval(recargar, 30000);
    return () => clearInterval(t);
  }, [recargar]);

  async function accion(fn, exito) {
    if (ocupado) return;
    setOcupado(true);
    setAccionMsg(null);
    try {
      const actualizado = await fn();
      setSel(actualizado);
      if (exito) setMensaje("");
      setAccionMsg(exito ? { ok: true, t: exito } : null);
      recargar();
    } catch (e) {
      setAccionMsg({ ok: false, t: e.message });
    } finally {
      setOcupado(false);
    }
  }

  const sinTomar = casos.filter((c) => c.estado === "reportado").length;

  return (
    <Shell title="Accidentes 24/7">
      <PageIntro title="Accidentes 24/7">
        Accidentes reportados por arrendatarios. Toma el caso, llama a ambas partes y deja por escrito cada novedad:
        les llega a los dos con el mismo texto. El dinero (qué se cobra de la garantía) se decide en Disputas; el caso
        se cierra después.
      </PageIntro>

      {error ? <StateMsg>{error}</StateMsg> : null}
      {accionMsg && !sel ? <StateMsg kind={accionMsg.ok ? "ok" : "err"}>{accionMsg.t}</StateMsg> : null}

      <div className="filters">
        <Segmented options={FILTROS} value={filtro} onChange={setFiltro} />
        {sinTomar ? <span className="count-hint"><b>{sinTomar}</b> sin tomar</span> : null}
      </div>

      {cargando && !casos.length ? (
        <EmptyState icon={Siren} title="Cargando accidentes…" />
      ) : casos.length === 0 ? (
        <EmptyState icon={Siren} title="Sin accidentes en esta vista" />
      ) : (
        <div className="table-wrap">
          <table className="t">
            <thead><tr><th>Caso</th><th>Auto</th><th>Gravedad</th><th>Estado</th><th>Reportado</th><th /></tr></thead>
            <tbody>
              {casos.map((c) => (
                <tr key={c.id}>
                  <td className="mono" style={{ fontWeight: 600 }}>{c.codigo}</td>
                  <td className="cell-2">
                    <b>{c.auto_descripcion || "—"}</b>
                    <span>{(c.descripcion || "").slice(0, 60)}{(c.descripcion || "").length > 60 ? "…" : ""}</span>
                  </td>
                  <td style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {c.hubo_lesionados ? <Chip tone="danger">Lesionados</Chip> : null}
                    {!c.auto_puede_circular ? <Chip tone="warn">No circula</Chip> : null}
                    {c.hay_terceros ? <Chip tone="warn">Terceros</Chip> : null}
                    {!c.hubo_lesionados && c.auto_puede_circular && !c.hay_terceros ? <Chip tone="neutral">Leve</Chip> : null}
                  </td>
                  <td><EstadoChip estado={c.estado} /></td>
                  <td style={{ color: "var(--muted)", fontSize: 12 }}>{fecha(c.creado_en)}</td>
                  <td><button className="row-link" onClick={() => { setAccionMsg(null); setSel(c); }}>Abrir</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Drawer
        open={!!sel}
        onOpenChange={(o) => !o && setSel(null)}
        title={sel ? `Caso ${sel.codigo}` : ""}
        sub={sel ? `${sel.auto_descripcion || "—"} · ${fecha(sel.creado_en)}` : ""}
        footer={sel && sel.estado !== "cerrado" ? <>
          {sel.estado === "reportado" ? (
            <button className="btn btn-mint" disabled={ocupado} onClick={() => accion(() => ApiClient.atenderSiniestro(sel.id), "Caso tomado: se avisó a ambas partes.")}>
              <UserCheck size={14} />Tomar el caso
            </button>
          ) : null}
          <button className="btn" disabled={ocupado || mensaje.trim().length < 5} onClick={() => accion(() => ApiClient.informarSiniestro(sel.id, mensaje.trim()), "Informado a ambas partes.")}>
            <Send size={14} />Informar a ambas partes
          </button>
          <button className="btn" disabled={ocupado || mensaje.trim().length < 5} onClick={() => accion(() => ApiClient.cerrarSiniestro(sel.id, mensaje.trim()), "Caso cerrado e informado.")}>
            <Check size={14} />Cerrar con este mensaje
          </button>
        </> : <span style={{ fontSize: 12, color: "var(--muted)", alignSelf: "center" }}>Caso cerrado</span>}
      >
        {sel ? (
          <>
            {accionMsg ? <StateMsg kind={accionMsg.ok ? "ok" : "err"}>{accionMsg.t}</StateMsg> : null}
            <h4>Estado</h4>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <EstadoChip estado={sel.estado} />
              {sel.hubo_lesionados ? <Chip tone="danger">Con lesionados</Chip> : null}
              {!sel.auto_puede_circular ? <Chip tone="warn">El auto no circula</Chip> : null}
              {sel.hay_terceros ? <Chip tone="warn">Terceros involucrados</Chip> : null}
            </div>

            <h4>Contactos</h4>
            <div style={{ display: "grid", gap: 6, fontSize: 13 }}>
              <div><b>Arrendatario:</b> {sel.cliente_nombre || "—"} · <Tel numero={sel.cliente_telefono} /></div>
              <div>
                <b>Dueño:</b> {sel.dueno_nombre || "—"} · <Tel numero={sel.dueno_telefono} />
                {sel.dueno_contactado_en ? (
                  <span style={{ color: "var(--muted)" }}> · contactado {fecha(sel.dueno_contactado_en)}</span>
                ) : sel.estado !== "cerrado" ? (
                  <> · <button className="row-link" disabled={ocupado} onClick={() => accion(() => ApiClient.marcarDuenoContactado(sel.id), "Registrado: soporte habló con el dueño.")}>Marcar como contactado</button></>
                ) : null}
              </div>
            </div>

            <h4>Reporte del arrendatario</h4>
            <div style={{ background: "var(--surface-2)", border: "1px solid var(--line)", borderRadius: 10, padding: "12px 14px", fontSize: 13, display: "grid", gap: 6 }}>
              <div>{sel.descripcion}</div>
              {sel.datos_tercero ? <div><b>Tercero:</b> {sel.datos_tercero}</div> : null}
              {sel.parte_policial ? <div><b>Parte policial:</b> {sel.parte_policial}</div> : null}
              {sel.ubicacion ? <div><b>Lugar:</b> {sel.ubicacion}</div> : null}
              {sel.latitud != null && sel.longitud != null ? (
                <div><a href={`https://maps.google.com/?q=${sel.latitud},${sel.longitud}`} target="_blank" rel="noreferrer">Ver ubicación en el mapa</a></div>
              ) : null}
            </div>

            {sel.fotos?.length ? (
              <>
                <h4>Fotos</h4>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {sel.fotos.map((u, i) => (
                    <a key={u + i} href={u} target="_blank" rel="noreferrer">
                      <img src={u} alt={`Foto ${i + 1}`} style={{ width: 88, height: 88, objectFit: "cover", borderRadius: 8, border: "1px solid var(--line)" }} />
                    </a>
                  ))}
                </div>
              </>
            ) : null}

            <h4>Garantía y cobros</h4>
            <div className="state-msg warn" style={{ marginBottom: 0 }}>
              <Gavel size={16} />
              <span>
                La garantía quedó asegurada con una disputa de tipo accidente. Decide qué se cobra en{" "}
                <Link href="/disputas">Disputas</Link>; recién con la disputa resuelta se puede cerrar el caso.
              </span>
            </div>

            {sel.estado !== "cerrado" ? (
              <>
                <h4>Mensaje para ambas partes</h4>
                <textarea className="input" rows={4} style={{ width: "100%" }} placeholder="Ej: El taller revisará el auto el lunes; el presupuesto se envía a ambos." value={mensaje} onChange={(e) => setMensaje(e.target.value)} />
                <div className="hint" style={{ marginTop: 6 }}>Les llega a los dos por la app y por correo, con este mismo texto, y queda en el historial del caso.</div>
              </>
            ) : sel.resumen_cierre ? (
              <>
                <h4>Cierre</h4>
                <div style={{ fontSize: 13 }}>{sel.resumen_cierre}</div>
              </>
            ) : null}

            <h4>Historial</h4>
            <div style={{ display: "grid", gap: 10 }}>
              {[...(sel.actualizaciones || [])].reverse().map((a, i) => (
                <div key={`${a.fecha}-${i}`} style={{ fontSize: 13 }}>
                  <div style={{ fontSize: 11, color: "var(--muted)" }}>{fecha(a.fecha)} · {a.autor === "soporte" ? "Soporte" : "Sistema"}</div>
                  <div>{a.mensaje}</div>
                </div>
              ))}
            </div>
          </>
        ) : null}
      </Drawer>
    </Shell>
  );
}
