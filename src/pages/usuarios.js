import { useEffect, useMemo, useState } from "react";
import { Search, Users as UsersIcon, Star, UserPlus, Copy, Check } from "lucide-react";
import Shell from "../components/Shell";
import { PageIntro, Chip, Segmented, StateMsg, EmptyState, Drawer } from "../components/ui";
import { ApiClient } from "../lib/api";
import { initials } from "../lib/format";

const FILTROS = [
  { value: "todos", label: "Todos" },
  { value: "cliente", label: "Clientes" },
  { value: "dueno", label: "Dueños" },
  { value: "staff", label: "Staff" },
  { value: "problema", label: "Con problemas" },
];
const ROLES = [
  { k: "cliente", label: "Cliente" }, { k: "dueno", label: "Dueño" },
  { k: "promotor", label: "Promotor" },
  { k: "manager", label: "Manager" }, { k: "admin", label: "Admin" }, { k: "soporte", label: "Soporte" },
];
const rolLabel = (r) => (r || []).map((x) => (ROLES.find((y) => y.k === x) || { label: x }).label).join(" · ");

// El backend filtra con q/rol/limit/cursor (GET /admin/usuarios). Los filtros
// "staff" y "problema" son combinaciones de roles/estados que la API no acepta
// como un solo parámetro, así que se aplican en cliente sobre la página cargada.
const LIMITE = 50;

export default function Usuarios() {
  const [items, setItems] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [cargandoMas, setCargandoMas] = useState(false);
  const [error, setError] = useState(null);
  const [filtro, setFiltro] = useState("todos");
  const [q, setQ] = useState("");
  const [qDeb, setQDeb] = useState("");
  const [sel, setSel] = useState(null);
  const [openPromotores, setOpenPromotores] = useState(false);

  // Debounce de la búsqueda (300ms) para no pegarle a la API por cada tecla.
  useEffect(() => {
    const t = setTimeout(() => setQDeb(q), 300);
    return () => clearTimeout(t);
  }, [q]);

  const serverParams = useMemo(() => {
    const p = { limit: LIMITE };
    const t = qDeb.trim();
    if (t) p.q = t;
    if (filtro === "cliente") p.rol = "cliente";
    else if (filtro === "dueno") p.rol = "dueno";
    return p;
  }, [qDeb, filtro]);

  // Carga inicial y recarga al cambiar búsqueda/filtro (página 1, reemplaza).
  useEffect(() => {
    let vivo = true;
    setCargando(true);
    setError(null);
    setCursor(null);
    ApiClient.getUsuarios(serverParams)
      .then((d) => {
        if (!vivo) return;
        setItems(Array.isArray(d) ? d : d?.items || []);
        setCursor(d?.next_cursor || null);
      })
      .catch((e) => vivo && setError(e.message || "No se pudo cargar la lista."))
      .finally(() => vivo && setCargando(false));
    return () => { vivo = false; };
  }, [serverParams]);

  async function cargarMas() {
    if (!cursor || cargandoMas) return;
    setCargandoMas(true);
    try {
      const d = await ApiClient.getUsuarios({ ...serverParams, cursor });
      const arr = Array.isArray(d) ? d : d?.items || [];
      setItems((prev) => {
        const ids = new Set(prev.map((x) => x.id));
        return [...prev, ...arr.filter((x) => !ids.has(x.id))];
      });
      setCursor(d?.next_cursor || null);
    } catch (e) {
      setError(e.message || "No se pudo cargar más usuarios.");
    } finally {
      setCargandoMas(false);
    }
  }

  // Filtros compuestos sin soporte server-side: se aplican sobre lo cargado.
  const filtrados = useMemo(() => {
    return items.filter((u) => {
      const roles = u.roles_activos || [];
      if (filtro === "staff" && !roles.some((r) => ["admin", "manager", "soporte"].includes(r))) return false;
      if (filtro === "problema" && !["rechazado", "requiere_revision_manual"].includes(u.estado_documentos)) return false;
      return true;
    });
  }, [items, filtro]);

  return (
    <Shell title="Usuarios">
      <PageIntro title="Usuarios">
        Personas registradas: arrendatarios, dueños y equipo. Busca, revisa identidad y licencia, y ajusta roles.
      </PageIntro>

      {error ? (
        <StateMsg>
          {error} — falta el endpoint <code className="mono">GET /admin/usuarios</code> en el backend.
        </StateMsg>
      ) : null}

      <div className="filters" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 280 }}>
          <Segmented options={FILTROS} value={filtro} onChange={setFiltro} />
          <div className="search fsearch"><Search size={14} /><input placeholder="Nombre, RUT o correo…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span className="count-hint"><b>{filtrados.length}</b> usuarios</span>
          <button
            className="btn btn-mint"
            onClick={() => setOpenPromotores(true)}
            style={{ display: "inline-flex", alignItems: "center", gap: 6, fontWeight: 600 }}
          >
            <UserPlus size={15} /> Invitar Promotor
          </button>
        </div>
      </div>

      {cargando ? (
        <EmptyState icon={UsersIcon} title="Cargando usuarios…" />
      ) : filtrados.length === 0 ? (
        <EmptyState icon={UsersIcon} title="Nada que mostrar" />
      ) : (
        <>
          <div className="table-wrap">
            <table className="t">
              <thead>
                <tr><th>Usuario</th><th>Rol</th><th>Identidad</th><th>Licencia</th><th className="num">Arriendos</th><th>Rating</th><th /></tr>
              </thead>
              <tbody>
                {filtrados.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <div className="idline">
                        <span className="avatar">{initials(u.nombre || u.email)}</span>
                        <div className="cell-2"><b>{u.nombre || u.email || "—"}</b><span className="mono">{u.rut || u.numero_documento || "—"}</span></div>
                      </div>
                    </td>
                    <td style={{ fontSize: 12 }}>{rolLabel(u.roles_activos)}</td>
                    <td><Chip estado={u.estado_documentos} /></td>
                    <td>{u.licencia_estado ? <Chip estado={u.licencia_estado} /> : <span style={{ color: "var(--muted)" }}>—</span>}</td>
                    <td className="num tnum">{u.total_arriendos ?? u.reservas_count ?? "—"}</td>
                    <td>{u.rating_promedio ? (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontWeight: 600 }}>
                        <Star size={12} style={{ fill: "var(--mint)", color: "var(--mint)" }} />
                        {Number(u.rating_promedio).toFixed(1).replace(".", ",")}
                      </span>
                    ) : <span style={{ color: "var(--muted)" }}>—</span>}</td>
                    <td><button className="row-link" onClick={() => setSel(u)}>Abrir ficha</button></td>
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
        title={sel?.nombre || sel?.email || ""}
        sub={sel ? `${rolLabel(sel.roles_activos)} · registrado ${sel.fecha_registro ? new Date(sel.fecha_registro).toLocaleDateString("es-CL") : "—"}` : ""}
      >
        {sel ? <FichaUsuario u={sel} /> : null}
      </Drawer>

      <Drawer
        open={openPromotores}
        onOpenChange={setOpenPromotores}
        title="Invitaciones a Promotores"
        sub="Genera enlaces y códigos de un solo uso para autorizar nuevos promotores en la plataforma."
      >
        <PanelInvitacionesPromotores />
      </Drawer>
    </Shell>
  );
}

function FichaUsuario({ u }) {
  const [roles, setRoles] = useState(u.roles_activos || []);
  const [guardando, setGuardando] = useState(false);
  const [suspendido, setSuspendido] = useState(!!u.suspendido);
  const [suspendiendo, setSuspendiendo] = useState(false);
  const [msg, setMsg] = useState(null);
  const ocr = Math.round((u.confianza_ocr ?? 1) * 100);
  const toggle = (k) => setRoles((prev) => (prev.includes(k) ? prev.filter((x) => x !== k) : [...prev, k]));

  async function guardar() {
    setGuardando(true); setMsg(null);
    try {
      await ApiClient.actualizarRolesUsuario(u.id, roles);
      setMsg({ ok: true, t: "Roles actualizados." });
    } catch (e) {
      setMsg({ ok: false, t: e.message || "No se pudo guardar (endpoint pendiente)." });
    } finally {
      setGuardando(false);
    }
  }

  async function toggleSuspension() {
    setSuspendiendo(true); setMsg(null);
    try {
      const actualizado = await ApiClient.suspenderUsuario(u.id, !suspendido);
      setSuspendido(actualizado.suspendido ?? !suspendido);
      setMsg({ ok: true, t: actualizado.suspendido ? "Cuenta suspendida." : "Cuenta reactivada." });
    } catch (e) {
      setMsg({ ok: false, t: e.message || "No se pudo cambiar la suspensión (endpoint pendiente)." });
    } finally {
      setSuspendiendo(false);
    }
  }

  return (
    <>
      <h4>Identidad</h4>
      <dl className="dl">
        <dt>RUT</dt><dd className="mono">{u.rut || u.numero_documento || "—"}</dd>
        <dt>Correo</dt><dd style={{ overflowWrap: "anywhere" }}>{u.email}</dd>
        <dt>Teléfono</dt><dd className="mono">{u.telefono || "—"}</dd>
        <dt>Estado docs</dt><dd><Chip estado={u.estado_documentos} /></dd>
        <dt>Cuenta</dt><dd>{suspendido ? <Chip estado="suspendido" /> : <span className="chip ok"><span className="dot" />Activa</span>}</dd>
        <dt>Confianza OCR</dt><dd>{ocr}%<div className="ocr-meter"><i style={{ width: `${ocr}%`, background: ocr < 80 ? "var(--warn)" : "var(--ok)" }} /></div></dd>
      </dl>

      <h4>Licencia de conducir</h4>
      <dl className="dl">
        <dt>Estado</dt><dd>{u.licencia_estado ? <Chip estado={u.licencia_estado} /> : "No aplica"}</dd>
        <dt>Clase</dt><dd>{u.licencia_clase ? `Clase ${u.licencia_clase}` : "—"}</dd>
      </dl>

      <h4>Actividad</h4>
      <dl className="dl">
        <dt>Arriendos</dt><dd>{u.total_arriendos ?? "—"}</dd>
        <dt>Autos publicados</dt><dd>{u.total_autos ?? "—"}</dd>
        <dt>Tarjetas</dt><dd>{u.tarjetas_count ?? (u.tarjeta_estado === "validada" ? "1+" : "0")}</dd>
        <dt>Reputación</dt><dd>{u.rating_promedio ? `${Number(u.rating_promedio).toFixed(1).replace(".", ",")} / 5` : "Sin evaluaciones"}</dd>
      </dl>

      <h4>Roles</h4>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {ROLES.map((r) => (
          <button
            key={r.k}
            className={`chip ${roles.includes(r.k) ? "ok" : "neutral"}`}
            style={{ cursor: "pointer", border: "1px solid var(--line)" }}
            onClick={() => toggle(r.k)}
          >
            <span className="dot" />{r.label}
          </button>
        ))}
      </div>
      <p style={{ fontSize: 11, color: "var(--muted)", marginTop: 8 }}>
        Toca un rol para activarlo o quitarlo. Cambiar roles queda en la auditoría.
      </p>

      {msg ? <div style={{ marginTop: 10 }}><div className={`state-msg ${msg.ok ? "ok" : "err"}`} style={{ marginBottom: 0 }}>{msg.t}</div></div> : null}

      <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
        <button className="btn btn-mint" onClick={guardar} disabled={guardando}>{guardando ? "Guardando…" : "Guardar roles"}</button>
        <button className="btn btn-danger" onClick={toggleSuspension} disabled={suspendiendo}>{suspendiendo ? "Procesando…" : (suspendido ? "Reactivar cuenta" : "Suspender cuenta")}</button>
      </div>
    </>
  );
}

function PanelInvitacionesPromotores() {
  const [invitaciones, setInvitaciones] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [generando, setGenerando] = useState(false);
  const [nota, setNota] = useState("");
  const [ultima, setUltima] = useState(null);
  const [copiadoId, setCopiadoId] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    cargar();
  }, []);

  async function cargar() {
    setCargando(true);
    try {
      const d = await ApiClient.getInvitacionesPromotores();
      setInvitaciones(d || []);
    } catch (e) {
      setError(e.message || "No se pudo cargar la lista de invitaciones.");
    } finally {
      setCargando(false);
    }
  }

  async function generar() {
    setGenerando(true);
    setError(null);
    try {
      const res = await ApiClient.crearInvitacionPromotor(nota.trim() || undefined);
      setUltima(res);
      setNota("");
      await cargar();
    } catch (e) {
      setError(e.message || "No se pudo generar la invitación.");
    } finally {
      setGenerando(false);
    }
  }

  async function copiar(id, texto) {
    if (!texto) return;
    try {
      await navigator.clipboard.writeText(texto);
      setCopiadoId(id);
      setTimeout(() => setCopiadoId(null), 2000);
    } catch (e) {
      // fallback
    }
  }

  return (
    <div>
      <div style={{ background: "var(--card)", padding: 16, borderRadius: 12, border: "1px solid var(--line)", marginBottom: 16 }}>
        <h4 style={{ margin: "0 0 8px 0", fontSize: 14 }}>Generar invitación de un solo uso</h4>
        <p style={{ fontSize: 12, color: "var(--muted)", margin: "0 0 12px 0", lineHeight: 1.4 }}>
          Cada enlace otorgará automáticamente el rol de <b>Promotor</b> al usuario al registrarse o canjearlo, activando el acceso a invitar en ambas apps (owner y renter).
        </p>
        <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
          <input
            placeholder="Nota opcional (ej: Promotor Santiago Norte)..."
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            style={{ flex: 1, padding: "8px 12px", borderRadius: 8, border: "1px solid var(--line)", background: "var(--bg)", color: "var(--fg)", fontSize: 13 }}
          />
          <button className="btn btn-mint" onClick={generar} disabled={generando} style={{ whiteSpace: "nowrap" }}>
            {generando ? "Generando…" : "Crear código"}
          </button>
        </div>
        {error ? <div className="state-msg err" style={{ marginTop: 8 }}>{error}</div> : null}
      </div>

      {ultima ? (
        <div style={{ background: "rgba(16,185,129,0.08)", border: "1px solid var(--mint)", borderRadius: 12, padding: 16, marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: "var(--mint)" }}>Invitación generada exitosamente</span>
            <button className="btn" style={{ fontSize: 11, padding: "4px 8px" }} onClick={() => copiar("ultima", ultima.link)}>
              {copiadoId === "ultima" ? "¡Copiado!" : "Copiar enlace"}
            </button>
          </div>
          <div style={{ fontSize: 24, fontWeight: 900, letterSpacing: 2, margin: "6px 0", color: "var(--fg)" }}>
            {ultima.codigo}
          </div>
          <div className="mono" style={{ fontSize: 11, color: "var(--muted)", wordBreak: "break-all" }}>
            {ultima.link}
          </div>
        </div>
      ) : null}

      <h4 style={{ fontSize: 13, marginBottom: 8 }}>Historial de invitaciones a promotores</h4>
      {cargando ? (
        <p style={{ fontSize: 12, color: "var(--muted)" }}>Cargando invitaciones…</p>
      ) : invitaciones.length === 0 ? (
        <p style={{ fontSize: 12, color: "var(--muted)" }}>Aún no hay invitaciones creadas.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {invitaciones.map((inv) => (
            <div
              key={inv.id || inv.codigo}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "10px 12px",
                borderRadius: 8,
                border: "1px solid var(--line)",
                background: "var(--card)",
              }}
            >
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <b className="mono" style={{ fontSize: 14 }}>{inv.codigo}</b>
                  <span className={`chip ${inv.usado ? "neutral" : "ok"}`} style={{ fontSize: 10, padding: "2px 6px" }}>
                    <span className="dot" />{inv.usado ? "Canjeado" : "Disponible"}
                  </span>
                </div>
                <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
                  {inv.usado ? `Canjeado por ${inv.usado_por_nombre || "Usuario"}` : "Un solo uso · Sin canjear"}
                </div>
              </div>

              {!inv.usado ? (
                <button
                  className="btn"
                  style={{ fontSize: 11, padding: "4px 8px" }}
                  onClick={() => copiar(inv.id, inv.link)}
                >
                  {copiadoId === inv.id ? "¡Copiado!" : "Copiar link"}
                </button>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}