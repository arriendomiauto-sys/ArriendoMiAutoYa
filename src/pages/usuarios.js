import { useMemo, useState } from "react";
import { Search, Users as UsersIcon, Star } from "lucide-react";
import Shell from "../components/Shell";
import { PageIntro, Chip, Segmented, StateMsg, EmptyState, Drawer, useAsync } from "../components/ui";
import { ApiClient } from "../lib/api";

const FILTROS = [
  { value: "todos", label: "Todos" },
  { value: "cliente", label: "Clientes" },
  { value: "dueno", label: "Dueños" },
  { value: "staff", label: "Staff" },
  { value: "problema", label: "Con problemas" },
];
const ROLES = [
  { k: "cliente", label: "Cliente" }, { k: "dueno", label: "Dueño" },
  { k: "manager", label: "Manager" }, { k: "admin", label: "Admin" }, { k: "soporte", label: "Soporte" },
];
const initials = (s) => (s || "?").split(/\s+/).slice(0, 2).map((w) => w[0] || "").join("").toUpperCase();
const rolLabel = (r) => (r || []).map((x) => (ROLES.find((y) => y.k === x) || { label: x }).label).join(" · ");

export default function Usuarios() {
  const { data, error, cargando } = useAsync(() => ApiClient.getUsuarios());
  const [filtro, setFiltro] = useState("todos");
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(null);

  const usuarios = Array.isArray(data) ? data : data?.items || [];
  const filtrados = useMemo(() => {
    const t = q.toLowerCase().trim();
    return usuarios.filter((u) => {
      const roles = u.roles_activos || [];
      if (filtro === "cliente" && !roles.includes("cliente")) return false;
      if (filtro === "dueno" && !roles.includes("dueno")) return false;
      if (filtro === "staff" && !roles.some((r) => ["admin", "manager", "soporte"].includes(r))) return false;
      if (filtro === "problema" && !["rechazado", "requiere_revision_manual"].includes(u.estado_documentos)) return false;
      if (!t) return true;
      return [u.nombre, u.rut, u.email].some((v) => (v || "").toLowerCase().includes(t));
    });
  }, [usuarios, filtro, q]);

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

      <div className="filters">
        <Segmented options={FILTROS} value={filtro} onChange={setFiltro} />
        <div className="search fsearch"><Search size={14} /><input placeholder="Nombre, RUT o correo…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <span className="count-hint"><b>{filtrados.length}</b> usuarios</span>
      </div>

      {cargando ? (
        <EmptyState icon={UsersIcon} title="Cargando usuarios…" />
      ) : filtrados.length === 0 ? (
        <EmptyState icon={UsersIcon} title="Nada que mostrar" />
      ) : (
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
      )}

      <Drawer
        open={!!sel}
        onOpenChange={(o) => !o && setSel(null)}
        title={sel?.nombre || sel?.email || ""}
        sub={sel ? `${rolLabel(sel.roles_activos)} · registrado ${sel.fecha_registro ? new Date(sel.fecha_registro).toLocaleDateString("es-CL") : "—"}` : ""}
      >
        {sel ? <FichaUsuario u={sel} onClose={() => setSel(null)} /> : null}
      </Drawer>
    </Shell>
  );
}

function FichaUsuario({ u, onClose }) {
  const [roles, setRoles] = useState(u.roles_activos || []);
  const [guardando, setGuardando] = useState(false);
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

  return (
    <>
      <h4>Identidad</h4>
      <dl className="dl">
        <dt>RUT</dt><dd className="mono">{u.rut || u.numero_documento || "—"}</dd>
        <dt>Correo</dt><dd style={{ overflowWrap: "anywhere" }}>{u.email}</dd>
        <dt>Teléfono</dt><dd className="mono">{u.telefono || "—"}</dd>
        <dt>Estado docs</dt><dd><Chip estado={u.estado_documentos} /></dd>
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
        <button className="btn btn-danger" onClick={onClose}>Suspender cuenta</button>
      </div>
    </>
  );
}
