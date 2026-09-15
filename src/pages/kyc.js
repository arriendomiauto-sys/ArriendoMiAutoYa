import { useEffect, useMemo, useRef, useState } from "react";
import {
  ShieldCheck, CreditCard, Car, ShieldAlert, RefreshCw, Search, Eye, User, Check, X,
} from "lucide-react";
import Shell from "../components/Shell";
import { PageIntro, Tabs, Chip, StateMsg } from "../components/ui";
import DocumentViewerModal from "../components/DocumentViewerModal";
import { useAuth } from "../context/AuthContext";
import { ApiClient } from "../lib/api";

const OCR_BAJO = 0.8;
const ocrPct = (u) => Math.round((u.confianza_ocr ?? 1) * 100);

export default function KycPage() {
  const { esAdmin } = useAuth();
  const [tab, setTab] = useState("identidad");
  const [usuarios, setUsuarios] = useState([]);
  const [autos, setAutos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [error, setError] = useState(null);
  const [exito, setExito] = useState(null);

  const [inspItem, setInspItem] = useState(null);
  const [inspTipo, setInspTipo] = useState("usuario");
  const [modal, setModal] = useState(false);
  const [procesando, setProcesando] = useState(false);
  const exitoTimer = useRef(null);

  useEffect(() => () => clearTimeout(exitoTimer.current), []);

  async function cargar() {
    setCargando(true);
    setError(null);
    try {
      const [u, a] = await Promise.all([
        ApiClient.getDocumentosPendientes().catch(() => []),
        ApiClient.getAutosDocumentosPendientes().catch(() => []),
      ]);
      setUsuarios(Array.isArray(u) ? u : []);
      setAutos(Array.isArray(a) ? a : []);
    } catch (e) {
      setError(e.message || "No se pudo cargar la cola de revisión.");
    } finally {
      setCargando(false);
    }
  }
  useEffect(() => { cargar(); }, []);

  const identidad = useMemo(
    () => usuarios.filter((u) => ["requiere_revision_manual", "pendiente", "rechazado"].includes(u.estado_documentos)),
    [usuarios]
  );
  const licencias = useMemo(
    () => usuarios.filter((u) => ["revision", "pendiente", "rechazada"].includes(u.licencia_estado)),
    [usuarios]
  );
  const autosPend = useMemo(() => autos.filter((a) => !a.documentos_verificados), [autos]);
  const alertas = useMemo(() => ({
    usuarios: usuarios.filter((u) => (u.confianza_ocr ?? 1) < OCR_BAJO || u.estado_documentos === "rechazado"),
    autos: autos.filter((a) => !a.doc_inscripcion_url || !a.doc_soap_url),
  }), [usuarios, autos]);

  const q = busqueda.toLowerCase().trim();
  const matchU = (u) => !q || [u.nombre, u.rut, u.email, u.licencia_clase].some((v) => (v || "").toLowerCase().includes(q));
  const matchA = (a) => !q || [a.patente, a.marca, a.modelo, a.dueno_nombre].some((v) => (v || "").toLowerCase().includes(q));

  const inspeccionar = (item, tipo) => { setInspItem(item); setInspTipo(tipo); setModal(true); };

  async function revisar(id, accion, notas) {
    setProcesando(true);
    try {
      if (inspTipo === "usuario") await ApiClient.revisarDocumento(id, accion, notas);
      else await ApiClient.revisarDocumentosAuto(id, accion, notas);
      setExito(accion === "aprobar" ? "Documentos aprobados." : "Documentos rechazados. Se notificó al usuario.");
      setModal(false);
      await cargar();
    } catch (e) {
      setError(e.message || "No se pudo procesar la revisión.");
    } finally {
      setProcesando(false);
      clearTimeout(exitoTimer.current);
      exitoTimer.current = setTimeout(() => setExito(null), 4000);
    }
  }

  const TABS = [
    { key: "identidad", label: "Identidad", icon: ShieldCheck, badge: identidad.length },
    { key: "licencias", label: "Licencias", icon: CreditCard, badge: licencias.length },
    { key: "autos", label: "Documentación de autos", icon: Car, badge: autosPend.length },
    { key: "alertas", label: "Alertas OCR", icon: ShieldAlert, badge: alertas.usuarios.length + alertas.autos.length },
  ];

  const lista = tab === "identidad" ? identidad.filter(matchU)
    : tab === "licencias" ? licencias.filter(matchU)
    : tab === "autos" ? autosPend.filter(matchA)
    : null;

  return (
    <Shell title="Verificación & KYC" counts={{ kyc: identidad.length + licencias.length + autosPend.length || undefined }}>
      <PageIntro
        title="Verificación & KYC"
        actions={
          <button className="btn" onClick={cargar} disabled={cargando}>
            <RefreshCw size={14} className={cargando ? "spin" : ""} />Actualizar
          </button>
        }
      >
        Cola de auditoría documental, separada por tipo. La confianza del OCR marca lo que hay que mirar con lupa.
      </PageIntro>

      {error ? <StateMsg>{error}</StateMsg> : null}
      {exito ? <StateMsg kind="ok">{exito}</StateMsg> : null}

      <Tabs tabs={TABS} value={tab} onChange={setTab} />

      <div className="filters">
        <div className="search fsearch">
          <Search size={14} />
          <input
            placeholder={tab === "autos" ? "Patente, marca o dueño…" : "Nombre, RUT o correo…"}
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
        </div>
        <span className="count-hint">
          <b>{tab === "alertas" ? alertas.usuarios.length + alertas.autos.length : (lista?.length ?? 0)}</b> pendientes
        </span>
      </div>

      {cargando ? (
        <div className="empty"><RefreshCw size={26} className="spin" style={{ opacity: 1, color: "var(--mint-600)" }} /><b>Cargando registros…</b></div>
      ) : tab === "alertas" ? (
        <div style={{ display: "grid", gap: 22 }}>
          <div>
            <StateMsg kind="warn">
              {alertas.usuarios.length} usuario(s) con confianza OCR bajo el 80% o rechazos. Compara la foto de la cédula con el rostro antes de aprobar.
            </StateMsg>
            <div className="grid g-3">
              {alertas.usuarios.filter(matchU).map((u) => <CardUsuario key={u.id} u={u} alerta onInspeccionar={() => inspeccionar(u, "usuario")} />)}
            </div>
          </div>
          <div>
            <h4 style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".06em", color: "var(--warn)", margin: "0 0 10px" }}>
              Vehículos sin documentación legal completa
            </h4>
            <div className="grid g-3">
              {alertas.autos.filter(matchA).map((a) => <CardAuto key={a.id} a={a} onInspeccionar={() => inspeccionar(a, "auto")} />)}
            </div>
          </div>
        </div>
      ) : lista.length === 0 ? (
        <div className="empty">
          {tab === "autos" ? <Car style={{ opacity: .4 }} /> : <ShieldCheck style={{ opacity: .4 }} />}
          <b>No hay documentos pendientes</b>
          <div>{tab === "licencias" ? "Todas las licencias están verificadas." : tab === "autos" ? "Toda la flota tiene su documentación aprobada." : "Todos los enrolamientos de identidad fueron procesados."}</div>
        </div>
      ) : (
        <div className="grid g-3">
          {tab === "autos"
            ? lista.map((a) => <CardAuto key={a.id} a={a} onInspeccionar={() => inspeccionar(a, "auto")} />)
            : lista.map((u) => <CardUsuario key={u.id} u={u} onInspeccionar={() => inspeccionar(u, "usuario")} />)}
        </div>
      )}

      <DocumentViewerModal
        open={modal}
        onOpenChange={setModal}
        tipo={inspTipo}
        item={inspItem}
        onAprobar={(id, notas) => revisar(id, "aprobar", notas)}
        onRechazar={(id, notas) => revisar(id, "rechazar", notas)}
        procesando={procesando}
        esAdmin={esAdmin}
      />
    </Shell>
  );
}

function CardUsuario({ u, alerta, onInspeccionar }) {
  const pct = ocrPct(u);
  const foto = u.foto_perfil_verificada_url || u.foto_perfil_url;
  return (
    <div className="card card-pad" style={{ display: "flex", flexDirection: "column", gap: 12, ...(alerta ? { borderColor: "var(--warn)" } : {}) }}>
      <div style={{ display: "flex", gap: 11, alignItems: "flex-start" }}>
        <span className="avatar" style={{ width: 40, height: 40, overflow: "hidden" }}>
          {foto ? <img src={foto} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} onError={(e) => { e.currentTarget.style.display = "none"; }} /> : <User size={16} />}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <b style={{ fontSize: 13.5, display: "block" }}>{u.nombre || u.email || "Sin nombre"}</b>
          <span className="mono" style={{ fontSize: 11.5, color: "var(--muted)" }}>{u.rut || u.numero_documento || "No informado"}</span>
        </div>
        <span className={`chip ${pct >= 85 ? "ok" : pct >= 70 ? "warn" : "danger"}`}>OCR {pct}%</span>
      </div>
      <div style={{ background: "var(--surface-2)", border: "1px solid var(--line)", borderRadius: 10, padding: "10px 12px", fontSize: 12, display: "grid", gap: 5 }}>
        <Row k="Identidad" v={<Chip estado={u.estado_documentos} />} />
        <Row k="Licencia" v={`${u.licencia_clase ? `Clase ${u.licencia_clase} · ` : ""}${u.licencia_estado || "Pendiente"}`} />
        {u.telefono ? <Row k="Teléfono" v={<span className="mono">{u.telefono}</span>} /> : null}
      </div>
      {u.notas_auditoria ? <p style={{ fontSize: 11.5, color: "var(--muted)", fontStyle: "italic", margin: 0 }}>“{u.notas_auditoria}”</p> : null}
      <button className="btn btn-primary" style={{ justifyContent: "center" }} onClick={onInspeccionar}>
        <Eye size={14} />Inspeccionar documentos
      </button>
    </div>
  );
}

function CardAuto({ a, onInspeccionar }) {
  const docs = [
    ["Padrón", !!a.doc_inscripcion_url], ["SOAP", !!a.doc_soap_url],
    ["Permiso", !!a.doc_permiso_circulacion_url], ["Rev. técnica", !!a.doc_revision_tecnica_url],
  ];
  return (
    <div className="card card-pad" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", gap: 11, alignItems: "flex-start" }}>
        <span className="avatar sq" style={{ width: 40, height: 40, borderRadius: 10, overflow: "hidden" }}>
          {Array.isArray(a.fotos) && a.fotos[0] ? <img src={a.fotos[0]} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <Car size={18} />}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <b style={{ fontSize: 13.5, display: "block" }}>{a.marca} {a.modelo} {a.anio}</b>
          <span className="mono" style={{ fontSize: 11.5, color: "var(--warn)", fontWeight: 600 }}>{a.patente}</span>
        </div>
        <Chip estado={a.documentos_verificados ? "aprobado" : "pendiente_docs"} />
      </div>
      <div style={{ background: "var(--surface-2)", border: "1px solid var(--line)", borderRadius: 10, padding: "10px 12px", fontSize: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
        {docs.map(([l, ok]) => (
          <span key={l} style={{ display: "flex", alignItems: "center", gap: 5, color: ok ? "var(--ok)" : "var(--muted)" }}>
            {ok ? <Check size={12} /> : <X size={12} />}{l}
          </span>
        ))}
      </div>
      <div style={{ fontSize: 12, color: "var(--muted)" }}>Dueño: <b style={{ color: "var(--ink)" }}>{a.dueno_nombre || "—"}</b>{a.dueno_rut ? <> · <span className="mono">{a.dueno_rut}</span></> : null}</div>
      <button className="btn btn-primary" style={{ justifyContent: "center" }} onClick={onInspeccionar}>
        <Eye size={14} />Revisar documentos del auto
      </button>
    </div>
  );
}

function Row({ k, v }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <span style={{ color: "var(--muted)" }}>{k}</span>
      <span style={{ fontWeight: 600 }}>{v}</span>
    </div>
  );
}
