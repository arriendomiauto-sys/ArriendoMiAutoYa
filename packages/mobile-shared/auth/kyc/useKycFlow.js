import { useState, useCallback } from "react";
import { Linking } from "react-native";
import { ApiClient } from "../../api/client";
import { useApp } from "../../context/AppContext";
import { subirImagenOptimizada, AJUSTES_DOCUMENTO } from "../../utils/imagenes";
import { loadWebBrowser, loadDocumentScanner } from "./utils/kycScanners";
import { showAlert } from "../../utils/alert";
import { msjError } from "../../utils/msjError";

// ============================================================================
// Hook useKycFlow
// Máquina de estados del flujo de verificación:
//  1. Didit como ruta primaria (activación -> confirmación)
//  2. Captura manual como respaldo: una sola lista (cédula + licencia + selfie)
//     que sube cada foto y luego intenta OCR; si algo falla, va a revisión.
// ============================================================================

// Bucket privado de Supabase Storage donde viven los documentos de KYC.
const KYC_BUCKET = "documentos-kyc";

// Mapea cada casilla de captura a su prefijo de archivo y a la clave del
// documento en `fallbackDocs`.
const SLOT_MAP = {
  id_front: { prefix: "carnet_frontal", key: "idCardFrontUrl" },
  id_back: { prefix: "carnet_trasero", key: "idCardBackUrl" },
  license: { prefix: "licencia_conducir", key: "licenseUrl" },
};

export function useKycFlow({ role = "renter", prefill = null, onComplete, onBack }) {
  const { currentUser, completeEnrolment, syncProfile } = useApp();

  // "didit_activation" | "didit_confirmation" | "manual_capture" | "revision"
  const [currentStep, setCurrentStep] = useState("didit_activation");
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Sesión externa de Didit.
  const [diditSession, setDiditSession] = useState(null);

  // Casilla de captura abierta (null = ninguna cámara activa).
  // "id_front" | "id_back" | "license" | "selfie"
  const [captureSlot, setCaptureSlot] = useState(null);

  // Casilla cuya foto se está subiendo ahora mismo. La UI muestra un estado
  // de carga en esa fila y bloquea las demás — así un doble toque no vuelve
  // a abrir la cámara ni sube la foto dos veces.
  const [uploadingSlot, setUploadingSlot] = useState(null);

  // Datos verificados (de Didit o, en el respaldo, del OCR casero).
  const [verifiedData, setVerifiedData] = useState({
    fullName: currentUser?.nombre || prefill?.nombre || "",
    rut: currentUser?.rut || prefill?.rut || "",
    birthDate: currentUser?.fecha_nacimiento || "",
    photoUrl: currentUser?.foto_perfil_verificada_url || null,
    // "verificada" es el estado de licencia que escribe el backend; "aprobada"
    // es del veredicto de Didit (`verificacion_externa_estado`), no de este campo.
    licenseValid: currentUser?.licencia_estado === "verificada",
    licenseCategory: "Clase B",
    licenseExpiration: "",
  });

  // URLs de los documentos capturados en el respaldo manual.
  const [fallbackDocs, setFallbackDocs] = useState({
    idCardFrontUrl: null,
    idCardBackUrl: null,
    licenseUrl: null,
    selfieUrl: null,
    selfieLivenessUrl: null,
  });

  // El medio de pago ya no se pide acá: el KYC solo verifica identidad. Las
  // tarjetas (débito para el arriendo, crédito para la garantía) se agregan
  // desde "Mis tarjetas", con el gate previo a reservar/publicar.

  // ==========================================================================
  // Bloque: iniciar la sesión hosted de Didit (ruta primaria)
  // ==========================================================================
  const startDiditVerification = useCallback(async () => {
    if (isLoading) return;
    setIsLoading(true);
    try {
      // "owner" | "renter": el backend arma el callback de Didit con este
      // valor para que la web de retorno abra el deep link de la app
      // correcta (arriendatuautoduenos:// vs arriendatuauto://) — un mismo
      // usuario puede ser dueño y arrendatario, así que no se puede inferir
      // solo del usuario.
      const appId = role === "owner" ? "owner" : "renter";
      const session = await ApiClient.crearSesionVerificacionExterna(appId);
      if (!session?.url) {
        throw new Error("El proveedor no devolvió una URL válida.");
      }

      setDiditSession(session);

      const redirectUrl =
        appId === "owner" ? "arriendatuautoduenos://kyc-retorno" : "arriendatuauto://kyc-retorno";
      const WebBrowser = loadWebBrowser();
      if (WebBrowser?.openAuthSessionAsync) {
        // A diferencia de openBrowserAsync (solo resuelve al cerrar
        // manualmente), esto escucha el deep link de retorno y cierra el
        // navegador solo — el cierre no dependía del usuario ni del SO.
        await WebBrowser.openAuthSessionAsync(session.url, redirectUrl);
      } else if (WebBrowser?.openBrowserAsync) {
        await WebBrowser.openBrowserAsync(session.url);
      } else {
        await Linking.openURL(session.url);
      }

      // Al volver, sincroniza el perfil para leer el veredicto del webhook.
      const updatedProfile = await syncProfile();
      if (updatedProfile?.verificacion_externa_estado === "aprobada") {
        setVerifiedData((prev) => ({
          ...prev,
          fullName: updatedProfile.nombre || prev.fullName,
          rut: updatedProfile.rut || prev.rut,
          photoUrl: updatedProfile.foto_perfil_verificada_url || prev.photoUrl,
          licenseValid: true,
        }));
        setCurrentStep("didit_confirmation");
      } else if (updatedProfile?.verificacion_externa_estado === "revision") {
        setCurrentStep("revision");
      } else {
        showAlert(
          "Verificación pendiente",
          "Aún no recibimos la confirmación de Didit. Puedes volver a abrirla o actualizar en unos segundos."
        );
      }
    } catch (error) {
      console.warn("[useKycFlow] Error al iniciar Didit:", error);
      showAlert(
        "Proveedor no disponible",
        "Hubo un problema al conectar con Didit. Puedes intentar con fotos manuales.",
        [
          { text: "Usar fotos manuales", onPress: () => setCurrentStep("manual_capture") },
          { text: "Reintentar", style: "cancel" },
        ]
      );
    } finally {
      setIsLoading(false);
    }
  }, [syncProfile, isLoading, role]);

  // ==========================================================================
  // Bloque: pasar a la captura manual (respaldo)
  // ==========================================================================
  const triggerFallback = useCallback(() => {
    setCurrentStep("manual_capture");
  }, []);

  // ==========================================================================
  // Bloque: confirmar el resultado de Didit y finalizar el enrolamiento
  // ==========================================================================
  const confirmAndProceed = useCallback(async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      await completeEnrolment({
        nombre: verifiedData.fullName,
        rut: verifiedData.rut,
        tipo_documento: "rut",
        foto_perfil_verificada_url: verifiedData.photoUrl,
      });
      if (onComplete) onComplete();
    } catch (error) {
      showAlert("Error al completar", error?.message || "Ocurrió un error inesperado.");
    } finally {
      setIsSubmitting(false);
    }
  }, [completeEnrolment, verifiedData, onComplete, isSubmitting]);

  // ==========================================================================
  // Bloque: capturar un documento de la lista manual
  // Documentos (cédula / licencia): primero el DETECTOR DE BORDES NATIVO
  // (react-native-document-scanner-plugin); si no está en el binario (Expo Go,
  // dev build sin la lib) se cae a la cámara guiada `DocumentCameraModal`.
  // La selfie siempre va por `SelfieLivenessModal`.
  // ==========================================================================

  // Sube un documento ya capturado (venga del escáner nativo o de la cámara).
  const uploadDocument = useCallback(async (slot, uri) => {
    const map = SLOT_MAP[slot];
    if (!map || !uri) return;
    setUploadingSlot(slot);
    setIsSubmitting(true);
    try {
      const url = await subirImagenOptimizada(uri, {
        filename: `${map.prefix}_${Date.now()}.jpg`,
        bucket: KYC_BUCKET,
        ...AJUSTES_DOCUMENTO,
      });
      setFallbackDocs((prev) => ({ ...prev, [map.key]: url }));
    } catch (err) {
      console.error("[useKycFlow] uploadDocument:", err);
      showAlert(
        "No se pudo subir la foto",
        err?.message || "Revisa tu conexión e inténtalo de nuevo."
      );
    } finally {
      setIsSubmitting(false);
      setUploadingSlot(null);
    }
  }, []);

  const beginCapture = useCallback(
    async (slot) => {
      // Guard anti doble-toque: si ya hay una cámara abierta o una subida en
      // curso, se ignora el segundo toque.
      if (captureSlot || uploadingSlot) return;

      if (slot === "selfie") {
        setCaptureSlot("selfie");
        return;
      }

      const scanner = loadDocumentScanner();
      if (!scanner) {
        // Sin detector nativo: cámara guiada.
        setCaptureSlot(slot);
        return;
      }

      try {
        const resultado = await scanner.scanDocument({
          responseType: scanner.ResponseType?.ImageFilePath,
          croppedImageQuality: 90,
          maxNumDocuments: 1,
        });
        const uri = resultado?.scannedImages?.[0];
        if (uri) await uploadDocument(slot, uri);
        // Sin uri = el usuario canceló el escáner: se queda como estaba.
      } catch (err) {
        console.warn("[useKycFlow] detector nativo falló, usando cámara:", err?.message);
        setCaptureSlot(slot);
      }
    },
    [uploadDocument, captureSlot, uploadingSlot]
  );

  const cancelCapture = useCallback(() => {
    setCaptureSlot(null);
  }, []);

  // Callback de la cámara guiada (fallback). La selfie llega como
  // { frontalUri, movimientoUri }; los documentos como uri.
  const handleManualCapture = useCallback(
    async (payload) => {
      const slot = captureSlot;
      setCaptureSlot(null);
      if (!slot || !payload) return;

      if (slot !== "selfie") {
        await uploadDocument(slot, payload);
        return;
      }

      setUploadingSlot("selfie");
      setIsSubmitting(true);
      try {
        const frontal = await subirImagenOptimizada(payload.frontalUri, {
          filename: `selfie_verificacion_${Date.now()}.jpg`,
          bucket: KYC_BUCKET,
          ...AJUSTES_DOCUMENTO,
        });
        let liveness = null;
        if (payload.movimientoUri) {
          try {
            liveness = await subirImagenOptimizada(payload.movimientoUri, {
              filename: `selfie_liveness_${Date.now()}.jpg`,
              bucket: KYC_BUCKET,
              ...AJUSTES_DOCUMENTO,
            });
          } catch (err) {
            // Si la segunda no sube, el backend lo manda a revisión por
            // falta de control de vida — no bloquea la captura.
            console.warn("[useKycFlow] selfie de liveness no subió:", err?.message);
          }
        }
        setFallbackDocs((prev) => ({
          ...prev,
          selfieUrl: frontal,
          selfieLivenessUrl: liveness,
        }));
      } catch (err) {
        console.error("[useKycFlow] handleManualCapture (selfie):", err);
        showAlert(
          "No se pudo subir la selfie",
          err?.message || "Revisa tu conexión e inténtalo de nuevo."
        );
      } finally {
        setIsSubmitting(false);
        setUploadingSlot(null);
      }
    },
    [captureSlot, uploadDocument]
  );

  // ==========================================================================
  // Bloque: enviar la verificación manual — OCR primero, revisión si falla
  // ==========================================================================
  const submitManualVerification = useCallback(async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    const email = currentUser?.email || prefill?.email;

    // Paquete de documentos que acompaña tanto al OCR como a la revisión.
    const documentos = {
      carnet_frontal_url: fallbackDocs.idCardFrontUrl || undefined,
      carnet_trasero_url: fallbackDocs.idCardBackUrl || undefined,
      licencia_url: fallbackDocs.licenseUrl || undefined,
      foto_perfil_verificada_url: fallbackDocs.selfieUrl || undefined,
    };

    try {
      // 1. OCR primero: procesa los documentos y prellena nombre / RUT.
      const previo = await ApiClient.verifyKyc({
        nombre: verifiedData.fullName || undefined,
        tipo_documento: "rut",
        rut: verifiedData.rut || undefined,
        email,
        telefono: currentUser?.telefono,
        carnet_frontal_url: fallbackDocs.idCardFrontUrl,
        carnet_trasero_url: fallbackDocs.idCardBackUrl,
      });
      const datos = previo?.datos_extraidos || {};

      // Fotos ilegibles: no hay nada que un ejecutivo pueda revisar.
      if (datos.documentos_legibles === false) {
        showAlert(
          "No pudimos leer tus documentos",
          "La foto salió borrosa o con reflejos. Vuelve a tomarla con buena luz y el documento completo dentro del marco."
        );
        return;
      }

      const nombreFinal = datos.nombre_extraido || verifiedData.fullName;
      const rutFinal = datos.rut_extraido || verifiedData.rut;
      setVerifiedData((prev) => ({ ...prev, fullName: nombreFinal, rut: rutFinal }));

      // 2. Completar el enrolamiento (el backend corre la verificación real).
      const profile = await completeEnrolment({
        nombre: nombreFinal,
        rut: rutFinal,
        tipo_documento: "rut",
        email,
        telefono: currentUser?.telefono,
        carnet_frontal_url: fallbackDocs.idCardFrontUrl,
        carnet_trasero_url: fallbackDocs.idCardBackUrl,
        licencia_url: role === "renter" ? fallbackDocs.licenseUrl : undefined,
        foto_perfil_verificada_url: fallbackDocs.selfieUrl,
        selfie_liveness_url: fallbackDocs.selfieLivenessUrl || undefined,
      });

      if (profile?.estado_documentos === "verificado") {
        if (onComplete) onComplete();
      } else {
        setCurrentStep("revision");
      }
    } catch (error) {
      console.warn("[useKycFlow] verificación manual falló:", error?.message);

      // Fotos ilegibles: a re-tomarlas, sin ofrecer revisión.
      if (error?.categoria === "fotos_ilegibles") {
        showAlert(
          "No pudimos leer tus documentos",
          (msjError(error, "La foto salió ilegible.")) +
            "\n\nVuelve a tomarla enfocada, sin reflejos y con buena luz."
        );
        return;
      }

      // 3. Cualquier otro problema: el caso viaja a un ejecutivo.
      try {
        await ApiClient.enviarEnrolamientoARevision({
          motivo: error?.categoria || "verificacion_automatica_fallo",
          descripcion:
            error?.message || "La verificación automática no se pudo completar.",
          ...documentos,
        });
        await syncProfile();
        setCurrentStep("revision");
      } catch (err2) {
        showAlert(
          "No se pudo enviar tu caso",
          err2?.message || "Revisa tu conexión e inténtalo de nuevo."
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  }, [
    currentUser,
    prefill,
    fallbackDocs,
    verifiedData,
    role,
    completeEnrolment,
    syncProfile,
    onComplete,
    isSubmitting,
  ]);

  return {
    currentStep,
    setCurrentStep,
    isLoading,
    isSubmitting,
    verifiedData,
    fallbackDocs,
    setFallbackDocs,
    captureSlot,
    uploadingSlot,
    startDiditVerification,
    triggerFallback,
    confirmAndProceed,
    beginCapture,
    cancelCapture,
    handleManualCapture,
    submitManualVerification,
  };
}
