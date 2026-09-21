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
import ArchivoPrivado, { abrirArchivo, esPdf } from "./ArchivoPrivado";

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
  tipo = "usuario", // "usuario" | "auto" | "conductor"
  item, // usuario o auto seleccionado
  onAprobar,
  onRechazar,
  procesando = false,
  esAdmin = true,
  onEncargo, // (autoId, resultado) => void — consulta de AutoSeguro (solo autos)
}) {
  const [documentos, setDocumentos] = useState([]);
  const [faltantes, setFaltantes] = useState([]);
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
      setFaltantes([]);
      return;
    }

    const docs = [];
    const agregar = (id, titulo, categoria, url, estado) => {
      if (url) docs.push({ id, titulo, categoria, url, estado });
    };
    // Lo que se espera encontrar y no llegó: el admin distingue "no lo subieron" de "no se ve".
    const faltan = [];
    const exigir = (etiqueta, url) => {
      if (!url) faltan.push(etiqueta);
    };

    if (tipo === "usuario") {
      const fotoUrl = item.foto_perfil_verificada_url || item.foto_perfil_url;
      agregar("selfie", item.foto_perfil_verificada_url ? "Selfie Biométrica / Perfil" : "Foto de Perfil", "Identidad", fotoUrl,
        item.foto_perfil_verificada_url ? "verificado" : "pendiente");
      agregar("carnet_frontal", "Cédula / Documento (Frente)", "Identidad", item.carnet_frontal_url, item.estado_documentos);
      agregar("carnet_trasero", "Cédula / Documento (Reverso)", "Identidad", item.carnet_trasero_url, item.estado_documentos);
      agregar("licencia", "Licencia de Conducir", "Licencia", item.licencia_url, item.licencia_estado || "pendiente");
      agregar("pic", "Permiso Internacional (PIC)", "Licencia", item.pic_url, item.licencia_estado || "pendiente");
      exigir("Cédula (frente)", item.carnet_frontal_url);
      if ((item.tipo_documento || "rut") === "rut") exigir("Cédula (reverso)", item.carnet_trasero_url);
      exigir("Licencia de conducir", item.licencia_url);
    } else if (tipo === "conductor") {
      agregar("selfie", "Selfie del conductor", "Identidad", item.selfie_url, item.estado_kyc);
      agregar("carnet_frontal", "Cédula / Documento (Frente)", "Identidad", item.carnet_frontal_url, item.estado_kyc);
      agregar("carnet_trasero", "Cédula / Documento (Reverso)", "Identidad", item.carnet_trasero_url, item.estado_kyc);
      agregar("licencia", "Licencia de Conducir", "Licencia", item.licencia_url, item.estado_kyc);
      agregar("pic", "Permiso Internacional (PIC)", "Licencia", item.pic_url, item.estado_kyc);
      exigir("Selfie", item.selfie_url);
      exigir("Cédula (frente)", item.carnet_frontal_url);
      exigir("Licencia de conducir", item.licencia_url);
    } else if (tipo === "auto") {
      agregar("padron", "Certificado de Inscripción (Padrón)", "Vehículo", item.doc_inscripcion_url);
      agregar("permiso", "Permiso de Circulación", "Vehículo", item.doc_permiso_circulacion_url);
      agregar("soap", "Seguro Obligatorio (SOAP)", "Vehículo", item.doc_soap_url);
      agregar("rev_tecnica", "Revisión Técnica", "Vehículo", item.doc_revision_tecnica_url);
      agregar("gases", "Certificado de Gases", "Vehículo", item.doc_certificado_gases_url);
      agregar("historial", "Historial Vehicular", "Vehículo", item.doc_historial_vehicular_url);
      agregar("seguro_comercial", "Póliza de Seguro", "Vehículo", item.doc_seguro_url);
      agregar("anotaciones", "Certificado de Anotaciones Vigentes", "Vehículo", item.doc_anotaciones_vigentes_url);
      exigir("Permiso de circulación", item.doc_permiso_circulacion_url);
      exigir("SOAP", item.doc_soap_url);
      exigir("Revisión técnica", item.doc_revision_tecnica_url);
      exigir("Certificado de gases", item.doc_certificado_gases_url);
      exigir("Certificado de anotaciones vigentes", item.doc_anotaciones_vigentes_url);
      (Array.isArray(item.fotos) ? item.fotos : []).forEach((fotoUrl, idx) => {
        agregar(`foto_auto_${idx}`, `Foto del Vehículo #${idx + 1}`, "Inspección Auto", fotoUrl);
      });
    }

    if (docs.length === 0) {
      docs.push({
        id: "sin_doc", titulo: "Sin documentos", categoria: "General", url: null,
        placeholder: "Todavía no se adjuntó ningún documento. Pídeselo al usuario desde la app.",
      });
    }
    setFaltantes(faltan);

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
        <Dialog.Content className="document-viewer-modal fixed inset-4 md:inset-8 lg:inset-12 z-50 flex flex-col rounded-2xl bg-[#0B1528] border border-slate-700/60 shadow-2xl text-white overflow-hidden animate-in zoom-in-95">
          
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
                    : tipo === "conductor"
                    ? `Revisión de segundo conductor: ${item.nombre || "Conductor"}`
                    : `Inspección de Vehículo: ${item.marca} ${item.modelo} (${item.patente})`}
                </Dialog.Title>
                <p className="text-xs text-slate-400">
                  {tipo === "usuario"
                    ? `RUT / Documento: ${item.rut || item.numero_documento || "No informado"} · Teléfono: ${item.telefono || "No informado"}`
                    : tipo === "conductor"
                    ? `RUT: ${item.rut || item.numero_documento || "No informado"} · Titular: ${item.titular_nombre || "—"} · ${item.patente || ""}`
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
                    <button
                      onClick={() => abrirArchivo(docActual.url).catch(() => {})}
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition ml-1"
                      title="Abrir archivo original"
                    >
                      <ExternalLink size={15} />
                    </button>
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
                    <ArchivoPrivado
                      key={docActual.url}
                      url={docActual.url}
                      alt={docActual.titulo}
                      className="max-h-[60vh] max-w-full object-contain rounded-lg shadow-2xl border border-slate-700/50"
                      style={esPdf(docActual.url) ? { minWidth: 260, minHeight: 160, color: "#cbd5e1" } : { minWidth: 220, minHeight: 160, color: "#cbd5e1" }}
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
                        <ArchivoPrivado url={doc.url} alt="" miniatura className="w-full h-full object-cover" />
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
                  {tipo === "usuario" || tipo === "conductor" ? (
                    <>
                      <div className="flex justify-between py-1 border-b border-slate-800">
                        <span className="text-slate-500">Estado Identidad:</span>
                        <span className="font-semibold capitalize text-teal-400">{item.estado_documentos || item.estado_kyc}</span>
                      </div>
                      {tipo === "usuario" ? (
                        <div className="flex justify-between py-1 border-b border-slate-800">
                          <span className="text-slate-500">Estado Licencia:</span>
                          <span className="font-semibold capitalize text-slate-200">{item.licencia_estado || "No registrada"}</span>
                        </div>
                      ) : null}
                      <div className="flex justify-between py-1 border-b border-slate-800">
                        <span className="text-slate-500">Clase Licencia:</span>
                        <span className="font-semibold text-slate-200">{item.licencia_clase || "—"}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-800">
                        <span className="text-slate-500">N° Licencia:</span>
                        <span className="font-semibold text-slate-200">{item.licencia_numero || "—"}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-800">
                        <span className="text-slate-500">Vencimiento Licencia:</span>
                        <span className="font-semibold text-slate-200">
                          {item.licencia_vencimiento ? new Date(item.licencia_vencimiento).toLocaleDateString("es-CL") : "—"}
                        </span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-800">
                        <span className="text-slate-500">Nacimiento:</span>
                        <span className="font-semibold text-slate-200">
                          {item.fecha_nacimiento ? new Date(item.fecha_nacimiento).toLocaleDateString("es-CL") : "—"}
                        </span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-800">
                        <span className="text-slate-500">Antecedentes:</span>
                        <span className="font-semibold capitalize text-slate-200">{item.antecedentes_estado || "Pendiente"}</span>
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
                      <div className="flex justify-between py-1 border-b border-slate-800">
                        <span className="text-slate-500">Anotaciones aprobadas:</span>
                        <span className="font-semibold text-slate-200">
                          {item.anotaciones_aprobadas_en ? new Date(item.anotaciones_aprobadas_en).toLocaleDateString("es-CL") : "No"}
                        </span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-800">
                        <span className="text-slate-500">Encargo por robo:</span>
                        <span className={`font-semibold ${item.encargo_robo_estado === "sin_encargo" ? "text-emerald-400" : item.encargo_robo_estado === "con_encargo" ? "text-red-400" : "text-amber-400"}`}>
                          {{ sin_encargo: "Sin encargo", con_encargo: "CON ENCARGO" }[item.encargo_robo_estado] || "Sin consultar"}
                        </span>
                      </div>
                      <div className="flex justify-between py-1">
                        <span className="text-slate-500">Ubicación Base:</span>
                        <span className="font-semibold text-slate-200">{item.ubicacion_base}</span>
                      </div>
                    </>
                  )}
                </div>

                {faltantes.length > 0 && (
                  <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/30 text-[11px] text-red-300">
                    <span className="font-bold block mb-0.5">No llegaron estos documentos:</span>
                    {faltantes.join(" · ")}
                  </div>
                )}

                {tipo === "auto" && esAdmin && onEncargo ? (
                  <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800 text-[11px] text-slate-300 space-y-2">
                    <span className="font-bold text-slate-200 block">Consulta en AutoSeguro (encargo por robo)</span>
                    <a href="https://www.autoseguro.gob.cl/" target="_blank" rel="noopener noreferrer" className="text-teal-300 underline">
                      Abrir autoseguro.gob.cl e ingresar {item.patente}
                    </a>
                    <div className="flex gap-2">
                      <button type="button" disabled={procesando} onClick={() => onEncargo(item.id, "sin_encargo")}
                        className="flex-1 px-2 py-1.5 rounded-lg bg-emerald-600/30 border border-emerald-500/50 text-emerald-100 font-semibold disabled:opacity-50">
                        Sin encargo
                      </button>
                      <button type="button" disabled={procesando} onClick={() => onEncargo(item.id, "con_encargo")}
                        className="flex-1 px-2 py-1.5 rounded-lg bg-red-600/30 border border-red-500/50 text-red-100 font-semibold disabled:opacity-50">
                        Con encargo
                      </button>
                    </div>
                  </div>
                ) : null}

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
                      style={{ colorScheme: "dark" }}
                      className="w-full bg-[#0F172A] border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-teal-400"
                    >
                      <option value="" className="bg-[#0F172A] text-slate-100">-- Seleccionar motivo común --</option>
                      {MOTIVOS_RECHAZO_COMUNES.map((m, i) => (
                        <option key={i} value={m} className="bg-[#0F172A] text-slate-100">
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
                      style={{ colorScheme: "dark" }}
                      className="w-full bg-[#0F172A] border border-slate-700 rounded-lg p-2.5 text-xs text-slate-100 placeholder-slate-400 focus:outline-none focus:border-teal-400 resize-none"
                    />
                  </div>

                  {/* Botones de Acción */}
                  <div className="grid grid-cols-2 gap-2.5 pt-1">
                    <button
                      type="button"
                      onClick={() => ejecutarAccion("rechazar")}
                      disabled={procesando}
                      className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-red-600/30 hover:bg-red-600/40 border border-red-500/50 text-red-100 font-semibold text-xs transition disabled:opacity-50"
                    >
                      <XCircle size={15} />
                      {procesando ? "Procesando…" : "Rechazar"}
                    </button>
                    <button
                      type="button"
                      onClick={() => ejecutarAccion("aprobar")}
                      disabled={procesando}
                      className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-teal-400 hover:bg-teal-300 text-slate-950 font-bold text-xs transition shadow-lg shadow-teal-500/25 disabled:opacity-50"
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
