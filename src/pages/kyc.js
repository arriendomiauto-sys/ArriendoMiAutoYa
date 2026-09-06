import { useEffect, useState, useMemo } from "react";
import RequireAuth from "../components/RequireAuth";
import Layout from "../components/Layout";
import DocumentViewerModal from "../components/DocumentViewerModal";
import { useAuth } from "../context/AuthContext";
import { ApiClient } from "../lib/api";
import {
  UserCheck,
  CreditCard,
  Car,
  AlertTriangle,
  Search,
  CheckCircle,
  XCircle,
  Eye,
  RefreshCw,
  FileText,
  ShieldAlert,
  Clock,
  ExternalLink
} from "lucide-react";

export default function KycPage() {
  const { esAdmin } = useAuth();
  
  // Estado principal
  const [tabActiva, setTabActiva] = useState("identidad"); // "identidad" | "licencias" | "autos" | "alertas"
  const [usuarios, setUsuarios] = useState([]);
  const [autos, setAutos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [error, setError] = useState(null);
  const [mensajeExito, setMensajeExito] = useState(null);

  // Modal de Inspección
  const [itemInspeccion, setItemInspeccion] = useState(null);
  const [tipoInspeccion, setTipoInspeccion] = useState("usuario"); // "usuario" | "auto"
  const [modalAbierto, setModalAbierto] = useState(false);
  const [procesandoAccion, setProcesandoAccion] = useState(false);

  // Cargar datos del backend
  async function cargarDatos() {
    setCargando(true);
    setError(null);
    try {
      const [dataUsuarios, dataAutos] = await Promise.all([
        ApiClient.getDocumentosPendientes().catch((e) => {
          console.error("Error cargando usuarios KYC:", e);
          return [];
        }),
        ApiClient.getAutosDocumentosPendientes().catch((e) => {
          console.error("Error cargando autos KYC:", e);
          return [];
        }),
      ]);

      setUsuarios(Array.isArray(dataUsuarios) ? dataUsuarios : []);
      setAutos(Array.isArray(dataAutos) ? dataAutos : []);
    } catch (err) {
      setError(err.message || "Error al cargar la lista de documentos.");
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    cargarDatos();
  }, []);

  // Filtrado de Usuarios por Categoría
  const usuariosIdentidad = useMemo(() => {
    return usuarios.filter(
      (u) =>
        u.estado_documentos === "requiere_revision_manual" ||
        u.estado_documentos === "pendiente" ||
        u.estado_documentos === "rechazado"
    );
  }, [usuarios]);

  const usuariosLicencias = useMemo(() => {
    return usuarios.filter(
      (u) =>
        u.licencia_estado === "revision" ||
        u.licencia_estado === "pendiente" ||
        u.licencia_url != null
    );
  }, [usuarios]);

  const autosPendientes = useMemo(() => {
    return autos.filter((a) => !a.documentos_verificados);
  }, [autos]);

  const itemsConAlertas = useMemo(() => {
    const usersBadOcr = usuarios.filter((u) => (u.confianza_ocr ?? 1.0) < 0.8 || u.estado_documentos === "rechazado");
    const autosSinDocs = autos.filter((a) => !a.doc_inscripcion_url || !a.doc_soap_url);
    return { usuarios: usersBadOcr, autos: autosSinDocs };
  }, [usuarios, autos]);

  // Lista filtrada según pestaña y búsqueda
  const listaFiltrada = useMemo(() => {
    const q = busqueda.toLowerCase().trim();

    if (tabActiva === "identidad") {
      return usuariosIdentidad.filter(
        (u) =>
          !q ||
          (u.nombre || "").toLowerCase().includes(q) ||
          (u.rut || "").toLowerCase().includes(q) ||
          (u.email || "").toLowerCase().includes(q)
      );
    }

    if (tabActiva === "licencias") {
      return usuariosLicencias.filter(
        (u) =>
          !q ||
          (u.nombre || "").toLowerCase().includes(q) ||
          (u.rut || "").toLowerCase().includes(q) ||
          (u.licencia_clase || "").toLowerCase().includes(q)
      );
    }

    if (tabActiva === "autos") {
      return autosPendientes.filter(
        (a) =>
          !q ||
          (a.patente || "").toLowerCase().includes(q) ||
          (a.marca || "").toLowerCase().includes(q) ||
          (a.modelo || "").toLowerCase().includes(q) ||
          (a.dueno_nombre || "").toLowerCase().includes(q)
      );
    }

    if (tabActiva === "alertas") {
      const uFiltrados = itemsConAlertas.usuarios.filter(
        (u) =>
          !q ||
          (u.nombre || "").toLowerCase().includes(q) ||
          (u.rut || "").toLowerCase().includes(q)
      );
      const aFiltrados = itemsConAlertas.autos.filter(
        (a) =>
          !q ||
          (a.patente || "").toLowerCase().includes(q) ||
          (a.marca || "").toLowerCase().includes(q)
      );
      return { usuarios: uFiltrados, autos: aFiltrados };
    }

    return [];
  }, [tabActiva, busqueda, usuariosIdentidad, usuariosLicencias, autosPendientes, itemsConAlertas]);

  // Manejadores de Aprobación y Rechazo
  const handleAprobar = async (id, notas) => {
    setProcesandoAccion(true);
    try {
      if (tipoInspeccion === "usuario") {
        await ApiClient.revisarDocumento(id, "aprobar", notas);
        setMensajeExito("Documentos de identidad y conductor aprobados exitosamente.");
      } else {
        await ApiClient.revisarDocumentosAuto(id, "aprobar", notas);
        setMensajeExito("Documentación del vehículo aprobada y activada.");
      }
      setModalAbierto(false);
      await cargarDatos();
    } catch (err) {
      setError(err.message || "Error al procesar la aprobación.");
    } finally {
      setProcesandoAccion(false);
      setTimeout(() => setMensajeExito(null), 4000);
    }
  };

  const handleRechazar = async (id, notas) => {
    setProcesandoAccion(true);
    try {
      if (tipoInspeccion === "usuario") {
        await ApiClient.revisarDocumento(id, "rechazar", notas);
        setMensajeExito("Documentos rechazados. Se notificó al usuario con las observaciones.");
      } else {
        await ApiClient.revisarDocumentosAuto(id, "rechazar", notas);
        setMensajeExito("Documentos del vehículo rechazados. Se notificó al dueño.");
      }
      setModalAbierto(false);
      await cargarDatos();
    } catch (err) {
      setError(err.message || "Error al procesar el rechazo.");
    } finally {
      setProcesandoAccion(false);
      setTimeout(() => setMensajeExito(null), 4000);
    }
  };

  const abrirInspeccion = (item, tipo) => {
    setItemInspeccion(item);
    setTipoInspeccion(tipo);
    setModalAbierto(true);
  };

  return (
    <RequireAuth>
      <Layout>
        <div className="space-y-6 pb-12">
          
          {/* HEADER SECCIÓN */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                Centro de Verificación & KYC
              </h1>
              <p className="text-sm text-slate-500 mt-1">
                Auditoría y validación documental organizada por identidad, licencias de conducir y documentación de vehículos.
              </p>
            </div>

            <button
              onClick={cargarDatos}
              disabled={cargando}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-sm transition disabled:opacity-50"
            >
              <RefreshCw size={14} className={cargando ? "animate-spin" : ""} />
              Actualizar
            </button>
          </div>

          {/* ALERTAS Y MENSAJES */}
          {error && (
            <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700 flex items-center gap-2 animate-in fade-in">
              <AlertTriangle size={18} className="text-red-500 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {mensajeExito && (
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-sm text-emerald-800 flex items-center gap-2 animate-in fade-in">
              <CheckCircle size={18} className="text-emerald-600 flex-shrink-0" />
              <span>{mensajeExito}</span>
            </div>
          )}

          {/* PESTAÑAS PRINCIPALES POR TIPO DE DOCUMENTO */}
          <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-2">
            
            {/* Pestaña 1: Identidad */}
            <button
              onClick={() => setTabActiva("identidad")}
              className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
                tabActiva === "identidad"
                  ? "bg-[#061E1F] text-[#2FBF9B] shadow-md"
                  : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
              }`}
            >
              <UserCheck size={16} />
              <span>Identidad & Cédulas</span>
              <span
                className={`px-2 py-0.5 rounded-full text-[11px] ${
                  tabActiva === "identidad"
                    ? "bg-[#2FBF9B]/20 text-[#2FBF9B]"
                    : "bg-slate-100 text-slate-600"
                }`}
              >
                {usuariosIdentidad.length}
              </span>
            </button>

            {/* Pestaña 2: Licencias */}
            <button
              onClick={() => setTabActiva("licencias")}
              className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
                tabActiva === "licencias"
                  ? "bg-[#061E1F] text-[#2FBF9B] shadow-md"
                  : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
              }`}
            >
              <CreditCard size={16} />
              <span>Licencias de Conducir</span>
              <span
                className={`px-2 py-0.5 rounded-full text-[11px] ${
                  tabActiva === "licencias"
                    ? "bg-[#2FBF9B]/20 text-[#2FBF9B]"
                    : "bg-slate-100 text-slate-600"
                }`}
              >
                {usuariosLicencias.length}
              </span>
            </button>

            {/* Pestaña 3: Vehículos */}
            <button
              onClick={() => setTabActiva("autos")}
              className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
                tabActiva === "autos"
                  ? "bg-[#061E1F] text-[#2FBF9B] shadow-md"
                  : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
              }`}
            >
              <Car size={16} />
              <span>Documentación de Autos</span>
              <span
                className={`px-2 py-0.5 rounded-full text-[11px] ${
                  tabActiva === "autos"
                    ? "bg-[#2FBF9B]/20 text-[#2FBF9B]"
                    : "bg-slate-100 text-slate-600"
                }`}
              >
                {autosPendientes.length}
              </span>
            </button>

            {/* Pestaña 4: Alertas OCR */}
            <button
              onClick={() => setTabActiva("alertas")}
              className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
                tabActiva === "alertas"
                  ? "bg-amber-950 text-amber-300 shadow-md"
                  : "bg-white text-amber-700 hover:bg-amber-50 border border-amber-200"
              }`}
            >
              <ShieldAlert size={16} />
              <span>Con Problemas / OCR Bajo</span>
              <span
                className={`px-2 py-0.5 rounded-full text-[11px] ${
                  tabActiva === "alertas"
                    ? "bg-amber-500/20 text-amber-300"
                    : "bg-amber-100 text-amber-800"
                }`}
              >
                {itemsConAlertas.usuarios.length + itemsConAlertas.autos.length}
              </span>
            </button>

          </div>

          {/* BARRA DE BÚSQUEDA Y FILTROS RÁPIDOS */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200 shadow-sm">
            <div className="relative w-full sm:w-96">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder={
                  tabActiva === "autos"
                    ? "Buscar por patente, marca, modelo o dueño..."
                    : "Buscar por nombre, RUT o correo..."
                }
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                className="w-full pl-10 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-teal-500 text-slate-800"
              />
            </div>
            
            <div className="text-xs text-slate-500 font-medium">
              Mostrando{" "}
              <span className="font-bold text-slate-900">
                {tabActiva === "alertas"
                  ? listaFiltrada.usuarios.length + listaFiltrada.autos.length
                  : listaFiltrada.length}
              </span>{" "}
              registros pendientes
            </div>
          </div>

          {/* CONTENIDO PRINCIPAL: GRILLA / TABLA DE REGISTROS */}
          {cargando ? (
            <div className="py-20 text-center space-y-3">
              <RefreshCw size={28} className="animate-spin text-teal-600 mx-auto" />
              <p className="text-sm font-medium text-slate-500">Cargando registros documentales...</p>
            </div>
          ) : tabActiva === "alertas" ? (
            /* VISTA ESPECIAL: ALERTAS OCR Y FOTOS CON PROBLEMAS */
            <div className="space-y-6">
              
              {/* Sección Usuarios con Alerta */}
              <div className="space-y-3">
                <h3 className="text-sm font-bold uppercase tracking-wider text-amber-800 flex items-center gap-2">
                  <AlertTriangle size={16} /> Usuarios con Confianza OCR &lt; 80% o Rechazos
                </h3>
                {listaFiltrada.usuarios.length === 0 ? (
                  <div className="p-6 rounded-2xl bg-white border border-slate-200 text-center text-xs text-slate-400">
                    No hay usuarios con alertas críticas de OCR.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {listaFiltrada.usuarios.map((u) => (
                      <CardUsuarioKYC
                        key={u.id}
                        usuario={u}
                        onInspeccionar={() => abrirInspeccion(u, "usuario")}
                        destacarAlerta
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Sección Autos con Documentación Incompleta */}
              <div className="space-y-3">
                <h3 className="text-sm font-bold uppercase tracking-wider text-amber-800 flex items-center gap-2">
                  <Car size={16} /> Vehículos sin Documentación Legal Completa
                </h3>
                {listaFiltrada.autos.length === 0 ? (
                  <div className="p-6 rounded-2xl bg-white border border-slate-200 text-center text-xs text-slate-400">
                    Todos los autos tienen documentos adjuntos.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {listaFiltrada.autos.map((a) => (
                      <CardAutoKYC
                        key={a.id}
                        auto={a}
                        onInspeccionar={() => abrirInspeccion(a, "auto")}
                        destacarAlerta
                      />
                    ))}
                  </div>
                )}
              </div>

            </div>
          ) : tabActiva === "autos" ? (
            /* VISTA DE VEHÍCULOS (PADRÓN, SOAP, REVISIÓN) */
            listaFiltrada.length === 0 ? (
              <div className="py-16 text-center rounded-2xl bg-white border border-slate-200 p-8 space-y-2">
                <Car size={36} className="text-slate-300 mx-auto" />
                <h4 className="text-sm font-bold text-slate-700">No hay vehículos pendientes de revisión</h4>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  Todos los autos publicados tienen su padrón, SOAP y revisión técnica aprobados.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {listaFiltrada.map((auto) => (
                  <CardAutoKYC
                    key={auto.id}
                    auto={auto}
                    onInspeccionar={() => abrirInspeccion(auto, "auto")}
                  />
                ))}
              </div>
            )
          ) : (
            /* VISTA DE USUARIOS (IDENTIDAD O LICENCIAS) */
            listaFiltrada.length === 0 ? (
              <div className="py-16 text-center rounded-2xl bg-white border border-slate-200 p-8 space-y-2">
                <UserCheck size={36} className="text-slate-300 mx-auto" />
                <h4 className="text-sm font-bold text-slate-700">No hay documentos pendientes</h4>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  {tabActiva === "licencias"
                    ? "Todas las licencias de conducir están verificadas al día."
                    : "Todos los enrolamientos de identidad han sido procesados."}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {listaFiltrada.map((usuario) => (
                  <CardUsuarioKYC
                    key={usuario.id}
                    usuario={usuario}
                    tab={tabActiva}
                    onInspeccionar={() => abrirInspeccion(usuario, "usuario")}
                  />
                ))}
              </div>
            )
          )}

          {/* MODAL DE INSPECCIÓN DETALLADA CON VISOR */}
          <DocumentViewerModal
            open={modalAbierto}
            onOpenChange={setModalAbierto}
            tipo={tipoInspeccion}
            item={itemInspeccion}
            onAprobar={handleAprobar}
            onRechazar={handleRechazar}
            procesando={procesandoAccion}
            esAdmin={esAdmin}
          />

        </div>
      </Layout>
    </RequireAuth>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENTES AUXILIARES DE TARJETAS
// ─────────────────────────────────────────────────────────────────────────────

function CardUsuarioKYC({ usuario, onInspeccionar, tab = "identidad", destacarAlerta = false }) {
  const ocrScore = Math.round((usuario.confianza_ocr ?? 1.0) * 100);
  const esOcrBajo = ocrScore < 80;

  return (
    <div
      className={`rounded-2xl bg-white p-5 border transition-all duration-200 hover:shadow-md flex flex-col justify-between space-y-4 ${
        destacarAlerta || esOcrBajo
          ? "border-amber-300 bg-amber-50/20"
          : "border-slate-200"
      }`}
    >
      <div>
        {/* Cabecera Tarjeta */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600 font-bold overflow-hidden">
              {usuario.foto_perfil_verificada_url ? (
                <img
                  src={usuario.foto_perfil_verificada_url}
                  alt=""
                  className="w-full h-full object-cover"
                />
              ) : (
                <User size={18} />
              )}
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-900 leading-tight">
                {usuario.nombre || usuario.email || "Usuario sin nombre"}
              </h4>
              <p className="text-xs text-slate-500 font-mono mt-0.5">
                RUT: {usuario.rut || usuario.numero_documento || "No informado"}
              </p>
            </div>
          </div>

          {/* Badge OCR */}
          <span
            className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
              ocrScore >= 85
                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                : ocrScore >= 70
                ? "bg-amber-50 text-amber-700 border-amber-200"
                : "bg-red-50 text-red-700 border-red-200"
            }`}
          >
            OCR {ocrScore}%
          </span>
        </div>

        {/* Detalles según contexto */}
        <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 text-xs space-y-1.5 text-slate-600">
          <div className="flex justify-between">
            <span className="text-slate-400">Estado Identidad:</span>
            <span className="font-semibold text-slate-800 capitalize">{usuario.estado_documentos}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Licencia:</span>
            <span className="font-semibold text-slate-800">
              {usuario.licencia_clase ? `Clase ${usuario.licencia_clase}` : "Sin clase"} · {usuario.licencia_estado || "Pendiente"}
            </span>
          </div>
          {usuario.licencia_vencimiento && (
            <div className="flex justify-between">
              <span className="text-slate-400">Vencimiento:</span>
              <span className="font-semibold text-slate-800">
                {new Date(usuario.licencia_vencimiento).toLocaleDateString("es-CL")}
              </span>
            </div>
          )}
          {usuario.telefono && (
            <div className="flex justify-between">
              <span className="text-slate-400">Teléfono:</span>
              <span className="font-mono text-slate-800">{usuario.telefono}</span>
            </div>
          )}
        </div>

        {/* Observación / Notas */}
        {usuario.notas_auditoria && (
          <p className="text-[11px] text-slate-500 italic mt-2 line-clamp-2">
            "{usuario.notas_auditoria}"
          </p>
        )}
      </div>

      {/* Botón CTA Inspección */}
      <button
        onClick={onInspeccionar}
        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#061E1F] hover:bg-[#092B2C] text-[#2FBF9B] font-bold text-xs shadow-sm transition"
      >
        <Eye size={15} />
        Inspeccionar Documentos & Fotos
      </button>
    </div>
  );
}

function CardAutoKYC({ auto, onInspeccionar, destacarAlerta = false }) {
  const tienePadron = !!auto.doc_inscripcion_url;
  const tieneSoap = !!auto.doc_soap_url;
  const tienePermiso = !!auto.doc_permiso_circulacion_url;
  const tieneRevTecnica = !!auto.doc_revision_tecnica_url;

  return (
    <div
      className={`rounded-2xl bg-white p-5 border transition-all duration-200 hover:shadow-md flex flex-col justify-between space-y-4 ${
        destacarAlerta
          ? "border-amber-300 bg-amber-50/20"
          : "border-slate-200"
      }`}
    >
      <div>
        {/* Cabecera Auto */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600 font-bold overflow-hidden">
              {Array.isArray(auto.fotos) && auto.fotos[0] ? (
                <img src={auto.fotos[0]} alt="" className="w-full h-full object-cover" />
              ) : (
                <Car size={18} />
              )}
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-900 leading-tight">
                {auto.marca} {auto.modelo} ({auto.anio})
              </h4>
              <p className="text-xs font-bold text-amber-700 tracking-wider font-mono uppercase mt-0.5">
                {auto.patente}
              </p>
            </div>
          </div>

          <span
            className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
              auto.documentos_verificados
                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                : "bg-amber-50 text-amber-700 border-amber-200"
            }`}
          >
            {auto.documentos_verificados ? "Aprobado" : "Pendiente"}
          </span>
        </div>

        {/* Resumen de Documentos Adjuntos */}
        <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 text-xs space-y-2 text-slate-600">
          <div className="flex justify-between">
            <span className="text-slate-400">Dueño:</span>
            <span className="font-semibold text-slate-800">{auto.dueno_nombre || "Dueño registrado"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">RUT Dueño:</span>
            <span className="font-mono text-slate-800">{auto.dueno_rut || "—"}</span>
          </div>

          {/* Checklist de Documentos */}
          <div className="pt-2 border-t border-slate-200/60 grid grid-cols-2 gap-1.5 text-[11px]">
            <span className={`flex items-center gap-1 ${tienePadron ? "text-emerald-600" : "text-slate-400"}`}>
              {tienePadron ? "✓ Padrón" : "✗ Sin Padrón"}
            </span>
            <span className={`flex items-center gap-1 ${tieneSoap ? "text-emerald-600" : "text-slate-400"}`}>
              {tieneSoap ? "✓ SOAP" : "✗ Sin SOAP"}
            </span>
            <span className={`flex items-center gap-1 ${tienePermiso ? "text-emerald-600" : "text-slate-400"}`}>
              {tienePermiso ? "✓ Permiso" : "✗ Sin Permiso"}
            </span>
            <span className={`flex items-center gap-1 ${tieneRevTecnica ? "text-emerald-600" : "text-slate-400"}`}>
              {tieneRevTecnica ? "✓ Rev. Técnica" : "✗ Sin Rev. Téc."}
            </span>
          </div>
        </div>
      </div>

      {/* Botón CTA Inspección */}
      <button
        onClick={onInspeccionar}
        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#061E1F] hover:bg-[#092B2C] text-[#2FBF9B] font-bold text-xs shadow-sm transition"
      >
        <Eye size={15} />
        Inspeccionar Documentos del Auto
      </button>
    </div>
  );
}
