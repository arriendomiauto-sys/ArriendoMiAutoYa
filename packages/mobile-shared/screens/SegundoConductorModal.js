import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  Modal,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  Linking,
  Image,
  TextInput,
  KeyboardAvoidingView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "../theme/colors";
import { theme } from "../theme/tokens";
import { Icon } from "../components/Icon";
import { Button, Card, Badge, ScreenHeader } from "../components/ui";
import { DocumentCameraModal } from "../components/DocumentCameraModal";
import { SelfieLivenessModal } from "../components/SelfieLivenessModal";
import { ApiClient } from "../api/client";
import { subirImagenOptimizada, AJUSTES_DOCUMENTO } from "../utils/imagenes";
import { showAlert } from "../utils/alert";
import { msjError } from "../utils/msjError";

function cargarEscanerDocumento() {
  try {
    const mod = require("react-native-document-scanner-plugin");
    const scanner = mod?.default ?? mod;
    if (typeof scanner?.scanDocument !== "function") return null;
    return {
      scanDocument: (opts) => scanner.scanDocument(opts),
      ResponseType: mod.ResponseType,
      Estado: mod.ScanDocumentResponseStatus,
    };
  } catch (err) {
    return null;
  }
}

// Misma carga perezosa que usa el KYC del titular (auth/kyc/utils/kycScanners) —
// se inlinea acá para no acoplar este modal a las carpetas internas de ese módulo.
// Este modal solo lo usa la app arrendatario (ActiveRentalScreen), por eso el
// deep link de retorno es siempre el de esa app.
function abrirEnNavegador(url) {
  try {
    const WebBrowser = require("expo-web-browser");
    // openAuthSessionAsync escucha el deep link de retorno y cierra el
    // navegador solo, a diferencia de openBrowserAsync (solo resuelve al
    // cerrarse manualmente).
    if (WebBrowser?.openAuthSessionAsync) {
      return WebBrowser.openAuthSessionAsync(url, "arriendatuauto://kyc-retorno");
    }
    if (WebBrowser?.openBrowserAsync) return WebBrowser.openBrowserAsync(url);
  } catch (err) {
    // expo-web-browser no disponible: cae a Linking más abajo.
  }
  return Linking.openURL(url);
}

export function SegundoConductorModal({
  visible,
  onClose,
  reservaId,
  initialData = null,
  onSaved,
  tone = "light",
}) {
  let insets = { bottom: 0, top: 0, left: 0, right: 0 };
  try {
    insets = useSafeAreaInsets();
  } catch {
    // Si corre fuera de SafeAreaProvider en tests
  }
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [subiendoSlot, setSubiendoSlot] = useState(null);
  const [verificandoDidit, setVerificandoDidit] = useState(false);

  // El conductor puede no existir todavía en el backend (primera vez que se
  // abre este modal): hasta guardarlo con nombre no hay a quién pedirle a
  // Didit una sesión ni a quién subirle la licencia.
  const [conductorId, setConductorId] = useState(initialData?.id || null);
  const [conductorNombre, setConductorNombre] = useState(initialData?.nombre || "");

  // Identidad (cédula + selfie): primero Didit, con captura manual como
  // respaldo si Didit no está disponible — mismo criterio que el KYC del
  // titular. La licencia NUNCA pasa por Didit (no la reconoce de forma
  // confiable): siempre se sube y valida aparte, con OCR casero.
  const [verificacionExternaEstado, setVerificacionExternaEstado] = useState(
    initialData?.verificacion_externa_estado || null
  );
  const [usarCapturaManual, setUsarCapturaManual] = useState(false);
  const [carnetFrontalUrl, setCarnetFrontalUrl] = useState(initialData?.carnet_frontal_url || null);
  const [carnetTraseroUrl, setCarnetTraseroUrl] = useState(initialData?.carnet_trasero_url || null);
  const [selfieUrl, setSelfieUrl] = useState(initialData?.selfie_url || null);

  const [licenciaUrl, setLicenciaUrl] = useState(initialData?.licencia_url || null);

  // Estado KYC devuelto por el backend / OCR
  const [estadoKyc, setEstadoKyc] = useState("pendiente"); // 'pendiente' | 'verificado' | 'requiere_revision_manual' | 'rechazado'
  const [notasAuditoria, setNotasAuditoria] = useState("");
  const [conductorRut, setConductorRut] = useState("");

  // Control de cámara guiada y selfie (solo respaldo manual)
  const [cameraFor, setCameraFor] = useState(null); // 'carnet_frente' | 'carnet_reverso'
  const [mostrarSelfieModal, setMostrarSelfieModal] = useState(false);

  useEffect(() => {
    if (initialData) {
      setConductorId(initialData.id || null);
      setConductorNombre(initialData.nombre || "");
      setCarnetFrontalUrl(initialData.carnet_frontal_url || null);
      setCarnetTraseroUrl(initialData.carnet_trasero_url || null);
      setLicenciaUrl(initialData.licencia_url || null);
      setSelfieUrl(initialData.selfie_url || null);
      setVerificacionExternaEstado(initialData.verificacion_externa_estado || null);
      setEstadoKyc(initialData.estado_kyc || "pendiente");
      setNotasAuditoria(initialData.notas_auditoria || "");
      setConductorRut(initialData.rut || initialData.numero_documento || "");
    }
  }, [initialData, visible]);

  const identidadVerificadaPorDidit = verificacionExternaEstado === "aprobada";

  // Crea el registro del conductor (solo con el nombre) la primera vez que
  // hace falta -- para pedir una sesión de Didit o subir la licencia tiene
  // que existir la fila en el backend.
  const asegurarConductorCreado = async () => {
    if (conductorId) return conductorId;
    if (!conductorNombre.trim()) {
      showAlert("Falta el nombre", "Ingresa el nombre completo del segundo conductor.");
      return null;
    }
    const respuesta = await ApiClient.asignarSegundoConductor(reservaId, {
      nombre: conductorNombre.trim(),
    });
    setConductorId(respuesta.id);
    setEstadoKyc(respuesta.estado_kyc);
    if (onSaved) onSaved(respuesta);
    return respuesta.id;
  };

  const refrescarConductor = async () => {
    try {
      const actual = await ApiClient.obtenerSegundoConductor(reservaId);
      setEstadoKyc(actual.estado_kyc);
      setNotasAuditoria(actual.notas_auditoria || "");
      setVerificacionExternaEstado(actual.verificacion_externa_estado || null);
      if (actual.nombre) setConductorNombre(actual.nombre);
      if (actual.rut || actual.numero_documento) setConductorRut(actual.rut || actual.numero_documento);
      if (actual.carnet_frontal_url) setCarnetFrontalUrl(actual.carnet_frontal_url);
      if (actual.carnet_trasero_url) setCarnetTraseroUrl(actual.carnet_trasero_url);
      if (onSaved) onSaved(actual);
      return actual;
    } catch (err) {
      return null;
    }
  };

  const handleVerificarDidit = async () => {
    if (verificandoDidit) return;
    setVerificandoDidit(true);
    try {
      const id = await asegurarConductorCreado();
      if (!id) return;

      const sesion = await ApiClient.crearSesionVerificacionSegundoConductor(reservaId, "renter");
      if (!sesion?.url) throw new Error("El proveedor no devolvió una URL válida.");

      await abrirEnNavegador(sesion.url);

      // Al volver del navegador, el webhook ya debería haber actualizado el
      // veredicto (o estar por hacerlo) -- se refresca para mostrarlo.
      const actual = await refrescarConductor();
      if (actual?.verificacion_externa_estado === "aprobada") {
        showAlert("Identidad verificada", "Didit confirmó la identidad del segundo conductor.");
      } else if (actual?.verificacion_externa_estado === "pendiente" || !actual?.verificacion_externa_estado) {
        showAlert(
          "Verificación pendiente",
          "Aún no recibimos la confirmación de Didit. Puedes volver a intentarlo en unos segundos."
        );
      }
    } catch (err) {
      showAlert(
        "No se pudo verificar con Didit",
        msjError(err, "Hubo un problema al conectar con el proveedor."),
        [
          { text: "Usar fotos manuales", onPress: () => setUsarCapturaManual(true) },
          { text: "Reintentar", style: "cancel" },
        ]
      );
    } finally {
      setVerificandoDidit(false);
    }
  };

  // Escaneo o captura con fallback (solo cédula/selfie manual, o licencia)
  const iniciarCaptura = async (slot) => {
    if (slot === "selfie") {
      setMostrarSelfieModal(true);
      return;
    }

    const escaner = cargarEscanerDocumento();
    if (!escaner) {
      setCameraFor(slot);
      return;
    }

    setSubiendoSlot(slot);
    try {
      const res = await escaner.scanDocument({
        responseType: escaner.ResponseType.ImageFilePath,
        croppedImageQuality: 90,
      });

      if (res.status === escaner.Estado.Success && res.scannedImages?.[0]) {
        const uri = res.scannedImages[0];
        const filename = `${slot}_${Date.now()}.jpg`;
        const url = await subirImagenOptimizada(uri, {
          filename,
          bucket: "documentos-kyc",
          ...AJUSTES_DOCUMENTO,
        });
        asignarUrlSlot(slot, url);
      }
    } catch (err) {
      // Si falla el plugin nativo, abrir cámara de rescate
      setCameraFor(slot);
    } finally {
      setSubiendoSlot(null);
    }
  };

  const asignarUrlSlot = (slot, url) => {
    if (slot === "carnet_frente") setCarnetFrontalUrl(url);
    else if (slot === "carnet_reverso") setCarnetTraseroUrl(url);
    else if (slot === "licencia") setLicenciaUrl(url);
    else if (slot === "selfie") setSelfieUrl(url);
  };

  const handleFotoCamara = async (slot, uri) => {
    setCameraFor(null);
    setSubiendoSlot(slot);
    try {
      const filename = `${slot}_${Date.now()}.jpg`;
      const url = await subirImagenOptimizada(uri, {
        filename,
        bucket: "documentos-kyc",
        ...AJUSTES_DOCUMENTO,
      });
      asignarUrlSlot(slot, url);
    } catch (err) {
      showAlert("Error al subir", msjError(err, "No se pudo subir la foto del documento."));
    } finally {
      setSubiendoSlot(null);
    }
  };

  const handleSelfieCapturada = async (uri) => {
    setMostrarSelfieModal(false);
    setSubiendoSlot("selfie");
    try {
      const filename = `selfie_segundo_conductor_${Date.now()}.jpg`;
      const url = await subirImagenOptimizada(uri, {
        filename,
        bucket: "documentos-kyc",
        ...AJUSTES_DOCUMENTO,
      });
      setSelfieUrl(url);
    } catch (err) {
      showAlert("Error al subir selfie", msjError(err, "No se pudo subir la foto selfie."));
    } finally {
      setSubiendoSlot(null);
    }
  };

  const handleProcesarKyc = async () => {
    if (saving) return;
    if (!licenciaUrl) {
      showAlert("Falta Licencia", "Debes escanear la licencia de conducir.");
      return;
    }
    if (usarCapturaManual && !carnetFrontalUrl) {
      showAlert("Falta Cédula", "Debes escanear el frente de la cédula de identidad.");
      return;
    }

    setSaving(true);
    try {
      const id = await asegurarConductorCreado();
      if (!id) return;

      const payload = { licencia_url: licenciaUrl };
      if (usarCapturaManual) {
        payload.carnet_frontal_url = carnetFrontalUrl;
        payload.carnet_trasero_url = carnetTraseroUrl;
        payload.selfie_url = selfieUrl;
      }

      const respuesta = await ApiClient.actualizarSegundoConductor(reservaId, payload);
      setEstadoKyc(respuesta.estado_kyc);
      setNotasAuditoria(respuesta.notas_auditoria || "");
      if (respuesta.nombre) setConductorNombre(respuesta.nombre);
      if (respuesta.rut || respuesta.numero_documento) {
        setConductorRut(respuesta.rut || respuesta.numero_documento);
      }

      if (respuesta.estado_kyc === "verificado") {
        showAlert(
          "Segundo Conductor Verificado",
          "¡Los documentos y la biometría han sido validados exitosamente por el sistema KYC automático!"
        );
      } else if (respuesta.estado_kyc === "requiere_revision_manual") {
        showAlert(
          "En Revisión Manual",
          "Tus documentos fueron derivados a soporte para validación manual por un ejecutivo."
        );
      } else {
        showAlert(
          "Validación Pendiente",
          respuesta.notas_auditoria || "Algunos documentos no pudieron ser verificados automáticamente."
        );
      }

      if (onSaved) onSaved(respuesta);
    } catch (err) {
      showAlert("Error en KYC", msjError(err, "No se pudo procesar la verificación automática."));
    } finally {
      setSaving(false);
    }
  };

  const contactarSoporte = () => {
    const asunto = encodeURIComponent(`Soporte Segundo Conductor - Reserva ${reservaId}`);
    const cuerpo = encodeURIComponent(
      `Hola equipo de soporte,\n\nSolicito asistencia con la verificación del segundo conductor para mi reserva ${reservaId}.\nMotivo: ${notasAuditoria || "Revisión de documentos"}\n\nGracias.`
    );
    Linking.openURL(`mailto:soporte@arriendomiautoya.cl?subject=${asunto}&body=${cuerpo}`);
  };

  const handleEliminar = async () => {
    try {
      await ApiClient.eliminarSegundoConductor(reservaId);
      showAlert("Eliminado", "Se removió el segundo conductor de esta reserva.");
      if (onSaved) onSaved(null);
      onClose();
    } catch (err) {
      showAlert("Error al eliminar", msjError(err, "No se pudo eliminar el segundo conductor."));
    }
  };

  const docsCompletos = !!licenciaUrl && (identidadVerificadaPorDidit || !usarCapturaManual || !!carnetFrontalUrl);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        className="flex-1 bg-black/50 justify-end"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View
          className="bg-background rounded-t-3xl px-5 pt-2.5 max-h-[92%] flex-1"
          style={{ paddingBottom: Math.max(insets?.bottom || 0, 16) + 8 }}
        >
          <View className="w-10 h-1 rounded-full bg-borderDark self-center mb-2" />
          <ScreenHeader
            title="Segundo Conductor"
            subtitle="Identidad con Didit · Licencia con validación casera"
            onBack={onClose}
            tone={tone}
          />

          <ScrollView className="flex-1 mt-3" contentContainerStyle={{ paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
            {/* Nombre del conductor */}
            <Card padded className="mb-3 gap-2.5">
              <Text className="text-sm font-bold text-text">Nombre completo</Text>
              <TextInput
                className="h-11 border border-border rounded-xl px-3 text-sm text-text bg-surface"
                value={conductorNombre}
                onChangeText={setConductorNombre}
                placeholder="Nombre y apellido del segundo conductor"
                placeholderTextColor={colors.textPlaceholder}
                editable={!conductorId}
              />
              {conductorId ? (
                <Text className="text-xs text-textMuted leading-4">Para cambiar el nombre, contacta a soporte.</Text>
              ) : null}
            </Card>

            {/* Estado Actual */}
            {estadoKyc !== "pendiente" && (
              <Card
                padded
                className={`mb-3.5 border-[1.5px] ${
                  estadoKyc === "verificado"
                    ? "bg-accent-100 border-accent-dark"
                    : "bg-amber-50 border-amber-500"
                }`}
              >
                <View className="flex-row justify-between items-center">
                  <Text className="text-[15px] font-bold text-text">
                    {estadoKyc === "verificado"
                      ? "Conductor Autorizado"
                      : estadoKyc === "requiere_revision_manual"
                      ? "En Revisión por Soporte"
                      : "Verificación no completada"}
                  </Text>
                  <Badge
                    variant={estadoKyc === "verificado" ? "success" : estadoKyc === "rechazado" ? "danger" : "warning"}
                    label={estadoKyc === "verificado" ? "Verificado" : estadoKyc === "rechazado" ? "Rechazado" : "En revisión"}
                  />
                </View>

                {conductorNombre ? (
                  <Text className="text-[13px] font-semibold text-text mt-1">
                    {conductorNombre} {conductorRut ? `• ${conductorRut}` : ""}
                  </Text>
                ) : null}

                {notasAuditoria ? (
                  <Text className="text-xs text-textMuted mt-1.5 leading-[17px]">{notasAuditoria}</Text>
                ) : null}

                {estadoKyc !== "verificado" && (
                  <View className="mt-3">
                    <Button
                      variant="secondary"
                      size="sm"
                      label="Contactar a soporte"
                      iconLeft="chat"
                      onPress={contactarSoporte}
                    />
                  </View>
                )}
              </Card>
            )}

            {/* Identidad: Didit primero, captura manual como respaldo */}
            <Card padded className="mb-3 gap-2.5">
              <View className="flex-row justify-between items-center">
                <View className="flex-row items-center gap-2">
                  <Icon name="shield" size={20} color={colors.primary} />
                  <Text className="text-sm font-bold text-text">1. Identidad (cédula + rostro)</Text>
                </View>
                {identidadVerificadaPorDidit && <Badge variant="success" label="Verificada" />}
              </View>
              <Text className="text-xs text-textMuted leading-4">
                {identidadVerificadaPorDidit
                  ? "Identidad confirmada por Didit."
                  : "El segundo conductor completa una verificación guiada (cédula + selfie con detección de vida)."}
              </Text>

              {!identidadVerificadaPorDidit && !usarCapturaManual && (
                <Button
                  label="Verificar identidad con Didit"
                  iconRight="arrow-right"
                  loading={verificandoDidit}
                  onPress={handleVerificarDidit}
                />
              )}

              {!identidadVerificadaPorDidit && usarCapturaManual && (
                <>
                  <View className="flex-row gap-2.5">
                    <View className="flex-1">
                      <Button
                        variant={carnetFrontalUrl ? "secondary" : "primary"}
                        size="sm"
                        label={carnetFrontalUrl ? "✓ Frente escaneado" : "Escanear Frente"}
                        iconLeft="camera"
                        loading={subiendoSlot === "carnet_frente"}
                        onPress={() => iniciarCaptura("carnet_frente")}
                      />
                    </View>
                    <View className="flex-1">
                      <Button
                        variant={carnetTraseroUrl ? "secondary" : "outline"}
                        size="sm"
                        label={carnetTraseroUrl ? "✓ Reverso listo" : "Escanear Reverso"}
                        iconLeft="camera"
                        loading={subiendoSlot === "carnet_reverso"}
                        onPress={() => iniciarCaptura("carnet_reverso")}
                      />
                    </View>
                  </View>
                  <Button
                    variant={selfieUrl ? "secondary" : "outline"}
                    size="sm"
                    label={selfieUrl ? "✓ Selfie capturada (repetir)" : "Tomar Selfie Biométrica"}
                    iconLeft="user"
                    loading={subiendoSlot === "selfie"}
                    onPress={() => iniciarCaptura("selfie")}
                  />
                  <TouchableOpacity onPress={() => setUsarCapturaManual(false)} hitSlop={theme.control.hitSlop}>
                    <Text className="text-xs font-semibold text-primary text-center mt-0.5">Volver a intentar con Didit</Text>
                  </TouchableOpacity>
                </>
              )}
            </Card>

            {/* Licencia de Conducir — siempre casera, nunca por Didit */}
            <Card padded className="mb-3 gap-2.5">
              <View className="flex-row justify-between items-center">
                <View className="flex-row items-center gap-2">
                  <Icon name="check" size={20} color={colors.primary} />
                  <Text className="text-sm font-bold text-text">2. Licencia de Conducir</Text>
                </View>
                {licenciaUrl && <Badge variant="success" label="Listo" />}
              </View>
              <Text className="text-xs text-textMuted leading-4">Comprueba clase B vigente durante las fechas completas del arriendo.</Text>

              <Button
                variant={licenciaUrl ? "secondary" : "primary"}
                size="sm"
                label={licenciaUrl ? "✓ Licencia escaneada (cambiar)" : "Escanear Licencia"}
                iconLeft="camera"
                loading={subiendoSlot === "licencia"}
                onPress={() => iniciarCaptura("licencia")}
              />
            </Card>

            {/* Acciones Finales */}
            <View className="mt-3 gap-2.5">
              <Button
                label="Guardar verificación"
                iconRight="arrow-right"
                loading={saving}
                disabled={!docsCompletos || saving}
                onPress={handleProcesarKyc}
              />

              {initialData && (
                <Button
                  variant="dangerOutline"
                  label="Eliminar Segundo Conductor"
                  onPress={handleEliminar}
                />
              )}
            </View>
          </ScrollView>

          {/* Modal de Cámara de Respaldo */}
          {cameraFor && (
            <DocumentCameraModal
              visible={!!cameraFor}
              modo={cameraFor}
              onCerrar={() => setCameraFor(null)}
              onFotoCapturada={(uri) => handleFotoCamara(cameraFor, uri)}
            />
          )}

          {/* Modal de Selfie Biométrica (solo respaldo manual) */}
          {mostrarSelfieModal && (
            <SelfieLivenessModal
              visible={mostrarSelfieModal}
              onClose={() => setMostrarSelfieModal(false)}
              onCaptured={({ frontalUri }) => handleSelfieCapturada(frontalUri)}
            />
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
