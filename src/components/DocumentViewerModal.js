import { useState, useEffect } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import {
  X,
  ZoomIn,
  ZoomOut,
  RotateCw,
  CheckCircle,
  XCircle,
  AlertTriangle,
  FileText,
  User,
  Car,
  CreditCard,
  ShieldCheck,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Maximize2
} from "lucide-react";

const MOTIVOS_RECHAZO_COMUNES = [
  "Foto borrosa / no legible",
  "Documento vencido o no vigente",
  "Datos no coinciden con los declarados",
  "Falta foto del reverso del documento",
  "Reflejo de luz o documento cortado",
  "Documento no corresponde a formato oficial",
  "Vehículo no coincide con el padrón / registro",
];

export default function DocumentViewerModal({
  open,
  onOpenChange,
  tipo = "usuario", // "usuario" | "auto"
  item, // usuario o auto seleccionado
  onAprobar,
  onRechazar,
  procesando = false,
  esAdmin = true,
}) {
  const [documentos, setDocumentos] = useState([]);
  const [docActualIndex, setDocActualIndex] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [rotacion, setRotacion] = useState(0);
  const [modoAccion, setModoAccion] = useState(null); // null | "aprobar" | "rechazar"
  const [motivoRapido, setMotivoRapido] = useState("");
  const [notas, setNotas] = useState("");

  // Construir lista de documentos adjuntos según el tipo
  useEffect(() => {
    if (!item) {
      setDocumentos([]);
      return;
    }

    const docs = [];

    if (tipo === "usuario") {
      // Cédula / Identidad
      const fotoUrl = item.foto_perfil_verificada_url || item.foto_perfil_url;
      if (fotoUrl) {
        docs.push({
          id: "selfie",
          titulo: item.foto_perfil_verificada_url ? "Selfie Biométrica / Perfil" : "Foto de Perfil",
          categoria: "Identidad",
          url: fotoUrl,
          estado: item.foto_perfil_verificada_url ? "verificado" : "pendiente",
        });
      }
      if (item.carnet_frontal_url) {
        docs.push({
          id: "carnet_frontal",
          titulo: "Cédula / Documento (Frente)",
          categoria: "Identidad",
          url: item.carnet_frontal_url,
          estado: item.estado_documentos,
        });
      }
      if (item.carnet_trasero_url) {
        docs.push({
          id: "carnet_trasero",
          titulo: "Cédula / Documento (Reverso)",
          categoria: "Identidad",
          url: item.carnet_trasero_url,
          estado: item.estado_documentos,
        });
      }

      // Licencia de Conducir
      if (item.licencia_url) {
        docs.push({
          id: "licencia",
          titulo: "Licencia de Conducir",
          categoria: "Licencia",
          url: item.licencia_url,
          estado: item.licencia_estado || "pendiente",
        });
      }
      if (item.pic_url) {
        docs.push({
          id: "pic",
          titulo: "Permiso Internacional (PIC)",
          categoria: "Licencia",
          url: item.pic_url,
          estado: item.licencia_estado || "pendiente",
        });
      }

      // Si no tiene URLs específicas pero tiene notas o registro
      if (docs.length === 0) {
        docs.push({
          id: "sin_doc",
          titulo: "Documento en Proceso",
          categoria: "General",
          url: null,
          placeholder: "Documentos cargados desde la app móvil en revisión OCR.",
        });
      }
    } else if (tipo === "auto") {
      // Documentación del Auto
      if (item.doc_inscripcion_url) {
        docs.push({
          id: "padron",
          titulo: "Certificado de Inscripción (Padrón)",
          categoria: "Vehículo",
          url: item.doc_inscripcion_url,
        });
      }
      if (item.doc_permiso_circulacion_url) {
        docs.push({
          id: "permiso",
          titulo: "Permiso de Circulación",
          categoria: "Vehículo",
          url: item.doc_permiso_circulacion_url,
        });
      }
      if (item.doc_soap_url) {
        docs.push({
          id: "soap",
          titulo: "Seguro Obligatorio (SOAP)",
          categoria: "Vehículo",
          url: item.doc_soap_url,
        });
      }
      if (item.doc_revision_tecnica_url) {
        docs.push({
          id: "rev_tecnica",
          titulo: "Revisión Técnica",
          categoria: "Vehículo",
          url: item.doc_revision_tecnica_url,
        });
      }
      if (item.doc_seguro_url) {
        docs.push({
          id: "seguro_comercial",
          titulo: "Póliza de Seguro",
          categoria: "Vehículo",
          url: item.doc_seguro_url,
        });
      }

      // Fotos del Vehículo
      if (Array.isArray(item.fotos)) {
        item.fotos.forEach((fotoUrl, idx) => {
          docs.push({
            id: `foto_auto_${idx}`,
            titulo: `Foto del Vehículo #${idx + 1}`,
            categoria: "Inspección Auto",
            url: fotoUrl,
          });
        });
      }

      if (docs.length === 0) {
        docs.push({
          id: "sin_doc_auto",
          titulo: "Documentos del Vehículo",
          categoria: "Vehículo",
          url: null,
          placeholder: "No se adjuntaron fotos directas o están en almacenamiento privado.",
        });
      }
    }

    setDocumentos(docs);
    setDocActualIndex(0);
    setZoom(1);
    setRotacion(0);
    setModoAccion(null);
    setNotas("");
    setMotivoRapido("");
  }, [item, tipo]);

  if (!item) return null;

  const docActual = documentos[docActualIndex] || documentos[0];

  const handleNextDoc = () => {
    if (docActualIndex < documentos.length - 1) {
      setDocActualIndex(docActualIndex + 1);
      setZoom(1);
      setRotacion(0);
    }
  };

  const handlePrevDoc = () => {
    if (docActualIndex > 0) {
      setDocActualIndex(docActualIndex - 1);
      setZoom(1);
      setRotacion(0);
    }
  };

  const ejecutarAccion = (accion) => {
    const notaFinal = motivoRapido
      ? `${motivoRapido}. ${notas}`.trim()
      : notas.trim() || (accion === "aprobar" ? "Documentos verificados correctamente." : "Documentos rechazados por inconsistencias.");

    if (accion === "aprobar") {
      onAprobar(item.id, notaFinal);
    } else {
      onRechazar(item.id, notaFinal);
    }
  };

  const confianzaOcr = item.confianza_ocr ?? 1.0;
  const esOcrBajo = confianzaOcr < 0.8;

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 animate-in fade-in" />
        <Dialog.Content className="fixed inset-4 md:inset-8 lg:inset-12 z-50 flex flex-col rounded-2xl bg-[#0B1528] border border-slate-700/60 shadow-2xl text-white overflow-hidden animate-in zoom-in-95">
          
          {/* HEADER MODAL */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-[#0E1A32]">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-teal-500/10 border border-teal-500/20 text-teal-400">
                {tipo === "usuario" ? <User size={20} /> : <Car size={20} />}
              </div>
              <div>
                <Dialog.Title className="text-base font-bold text-white flex items-center gap-2">
                  {tipo === "usuario"
                    ? `Revisión de Identidad & KYC: ${item.nombre || item.email || "Usuario"}`
                    : `Inspección de Vehículo: ${item.marca} ${item.modelo} (${item.patente})`}
                </Dialog.Title>
                <p className="text-xs text-slate-400">
                  {tipo === "usuario"
                    ? `RUT / Documento: ${item.rut || item.numero_documento || "No informado"} · Teléfono: ${item.telefono || "No informado"}`
                    : `Dueño: ${item.dueno_nombre || "No informado"} · RUT: ${item.dueno_rut || "—"}`}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {esOcrBajo && tipo === "usuario" && (
                <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/30">
                  <AlertTriangle size={14} /> Confianza OCR Baja: {Math.round(confianzaOcr * 100)}%
                </span>
              )}
              <Dialog.Close className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition">
                <X size={20} />
              </Dialog.Close>
            </div>
          </div>

          {/* CUERPO PRINCIPAL (2 COLUMNAS) */}
          <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-hidden">
            
            {/* COLUMNA IZQUIERDA: VISOR DE IMÁGENES / FOTOS (8 COLS) */}
            <div className="lg:col-span-8 flex flex-col bg-[#060D1A] border-r border-slate-800 relative">
              
              {/* Toolbar del Visor */}
              <div className="flex items-center justify-between px-4 py-2 bg-[#091324] border-b border-slate-800 text-xs text-slate-300">
                <div className="flex items-center gap-2 font-medium text-teal-300">
                  <FileText size={15} />
                  <span>{docActual?.titulo || "Documento"}</span>
                  <span className="text-slate-500">
                    ({docActualIndex + 1} de {documentos.length})
                  </span>
                </div>

                {/* Controles de Zoom y Rotación */}
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
                    title="Alejar"
                  >
                    <ZoomOut size={15} />
                  </button>
                  <span className="px-1.5 text-[11px] font-mono">{Math.round(zoom * 100)}%</span>
                  <button
                    onClick={() => setZoom((z) => Math.min(3, z + 0.25))}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
                    title="Acercar"
                  >
                    <ZoomIn size={15} />
                  </button>
                  <button
                    onClick={() => setRotacion((r) => (r + 90) % 360)}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition ml-1"
                    title="Rotar 90°"
                  >
                    <RotateCw size={15} />
                  </button>
                  {docActual?.url && (
                    <a
                      href={docActual.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition ml-1"
                      title="Abrir imagen original"
                    >
                      <ExternalLink size={15} />
                    </a>
                  )}
                </div>
              </div>

              {/* Área del Visor de Imagen */}
              <div className="flex-1 flex items-center justify-center p-4 overflow-hidden relative select-none">
                {docActual?.url ? (
                  <div
                    className="transition-transform duration-200 ease-out max-h-full max-w-full flex items-center justify-center"
                    style={{
                      transform: `scale(${zoom}) rotate(${rotacion}deg)`,
                    }}
                  >
                    <img
                      src={docActual.url}
                      alt={docActual.titulo}
                      className="max-h-[60vh] max-w-full object-contain rounded-lg shadow-2xl border border-slate-700/50"
                    />
                  </div>
                ) : (
                  <div className="text-center p-8 max-w-md">
                    <div className="w-16 h-16 rounded-2xl bg-slate-800/80 border border-slate-700 mx-auto flex items-center justify-center text-slate-400 mb-3">
                      <FileText size={32} />
                    </div>
                    <h4 className="text-sm font-semibold text-slate-200 mb-1">{docActual?.titulo}</h4>
                    <p className="text-xs text-slate-400">
                      {docActual?.placeholder || "Este archivo se encuentra almacenado de forma privada o fue validado digitalmente por el SDK de captura."}
                    </p>
                  </div>
                )}

                {/* Flechas de navegación rápida */}
                {documentos.length > 1 && (
                  <>
                    <button
                      onClick={handlePrevDoc}
                      disabled={docActualIndex === 0}
                      className="absolute left-3 p-2 rounded-full bg-slate-900/80 border border-slate-700 text-white disabled:opacity-30 hover:bg-slate-800 transition shadow-lg"
                    >
                      <ChevronLeft size={18} />
                    </button>
                    <button
                      onClick={handleNextDoc}
                      disabled={docActualIndex === documentos.length - 1}
                      className="absolute right-3 p-2 rounded-full bg-slate-900/80 border border-slate-700 text-white disabled:opacity-30 hover:bg-slate-800 transition shadow-lg"
                    >
                      <ChevronRight size={18} />
                    </button>
                  </>
                )}
              </div>

              {/* Tira de Miniaturas (Carousel de Documentos) */}
              <div className="p-3 bg-[#091324] border-t border-slate-800 flex gap-2 overflow-x-auto">
                {documentos.map((doc, idx) => (
                  <button
                    key={doc.id || idx}
                    onClick={() => {
                      setDocActualIndex(idx);
                      setZoom(1);
                      setRotacion(0);
                    }}
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs whitespace-nowrap transition-all ${
                      docActualIndex === idx
                        ? "bg-teal-500/20 border-teal-500 text-white font-semibold shadow-md shadow-teal-500/10"
                        : "bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                    }`}
                  >
                    <div className="w-6 h-6 rounded-md bg-slate-800 flex items-center justify-center text-slate-300 overflow-hidden">
                      {doc.url ? (
                        <img src={doc.url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <FileText size={12} />
                      )}
                    </div>
                    <span>{doc.titulo}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* COLUMNA DERECHA: METADATOS, AUDITORÍA & ACCIONES (4 COLS) */}
            <div className="lg:col-span-4 flex flex-col bg-[#0B1528] overflow-y-auto p-5 space-y-4">
              
              {/* Tarjeta de Diagnóstico / OCR */}
              <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Diagnóstico OCR</span>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                      confianzaOcr >= 0.85
                        ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                        : confianzaOcr >= 0.7
                        ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
                        : "bg-red-500/10 text-red-400 border-red-500/30"
                    }`}
                  >
                    {Math.round(confianzaOcr * 100)}% Confianza
                  </span>
                </div>

                <div className="text-xs space-y-1.5 text-slate-300">
                  {tipo === "usuario" ? (
                    <>
                      <div className="flex justify-between py-1 border-b border-slate-800">
                        <span className="text-slate-500">Estado Identidad:</span>
                        <span className="font-semibold capitalize text-teal-400">{item.estado_documentos}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-800">
                        <span className="text-slate-500">Estado Licencia:</span>
                        <span className="font-semibold capitalize text-slate-200">{item.licencia_estado || "No registrada"}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-800">
                        <span className="text-slate-500">Clase Licencia:</span>
                        <span className="font-semibold text-slate-200">{item.licencia_clase || "Clase B"}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-800">
                        <span className="text-slate-500">Vencimiento Licencia:</span>
                        <span className="font-semibold text-slate-200">
                          {item.licencia_vencimiento
                            ? new Date(item.licencia_vencimiento).toLocaleDateString("es-CL")
                            : "—"}
                        </span>
                      </div>
                      <div className="flex justify-between py-1">
                        <span className="text-slate-500">Tipo Doc:</span>
                        <span className="font-semibold uppercase text-slate-200">{item.tipo_documento || "RUT"}</span>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex justify-between py-1 border-b border-slate-800">
                        <span className="text-slate-500">Patente:</span>
                        <span className="font-bold text-amber-300 uppercase tracking-widest">{item.patente}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-800">
                        <span className="text-slate-500">Año / Modelo:</span>
                        <span className="font-semibold text-slate-200">{item.anio} · {item.marca} {item.modelo}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-800">
                        <span className="text-slate-500">Estado Docs:</span>
                        <span className={`font-semibold ${item.documentos_verificados ? "text-emerald-400" : "text-amber-400"}`}>
                          {item.documentos_verificados ? "Verificados" : "Pendiente de Aprobación"}
                        </span>
                      </div>
                      <div className="flex justify-between py-1">
                        <span className="text-slate-500">Ubicación Base:</span>
                        <span className="font-semibold text-slate-200">{item.ubicacion_base}</span>
                      </div>
                    </>
                  )}
                </div>

                {item.notas_auditoria && (
                  <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800 text-[11px] text-slate-400">
                    <span className="font-bold text-slate-300 block mb-0.5">Historial / Observaciones:</span>
                    {item.notas_auditoria}
                  </div>
                )}
              </div>

              {/* PANEL DE DECISIÓN / APROBAR O RECHAZAR */}
              {esAdmin ? (
                <div className="p-4 rounded-xl bg-[#0F203C] border border-slate-700/80 space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                    <ShieldCheck size={16} className="text-teal-400" />
                    Resolución de Auditoría
                  </h4>

                  {/* Motivos rápidos si se va a rechazar */}
                  <div className="space-y-2">
                    <label className="text-[11px] font-medium text-slate-400 block">
                      Motivo frecuente (opcional):
                    </label>
                    <select
                      value={motivoRapido}
                      onChange={(e) => setMotivoRapido(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-teal-400"
                    >
                      <option value="">-- Seleccionar motivo común --</option>
                      {MOTIVOS_RECHAZO_COMUNES.map((m, i) => (
                        <option key={i} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Notas libres */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-slate-400 block">
                      Instrucciones al usuario:
                    </label>
                    <textarea
                      rows={3}
                      value={notas}
                      onChange={(e) => setNotas(e.target.value)}
                      placeholder="Escribe detalles específicos para la notificación push y correo..."
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-xs text-slate-200 focus:outline-none focus:border-teal-400 resize-none"
                    />
                  </div>

                  {/* Botones de Acción */}
                  <div className="grid grid-cols-2 gap-2.5 pt-1">
                    <button
                      type="button"
                      onClick={() => ejecutarAccion("rechazar")}
                      disabled={procesando}
                      className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-red-600/20 hover:bg-red-600/30 border border-red-500/40 text-red-300 font-semibold text-xs transition disabled:opacity-50"
                    >
                      <XCircle size={15} />
                      {procesando ? "Procesando…" : "Rechazar"}
                    </button>
                    <button
                      type="button"
                      onClick={() => ejecutarAccion("aprobar")}
                      disabled={procesando}
                      className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs transition shadow-lg shadow-teal-500/20 disabled:opacity-50"
                    >
                      <CheckCircle size={15} />
                      {procesando ? "Procesando…" : "Aprobar"}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 text-xs text-slate-400 text-center">
                  👁️ Modo solo lectura (Permisos de Manager)
                </div>
              )}

            </div>
          </div>

        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
