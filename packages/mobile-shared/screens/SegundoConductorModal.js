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
import { hapticoExito, hapticoError } from "../utils/haptics";

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
  // abre este modal): para pedirle a Didit una sesión de identidad o de
  // licencia, primero hay que crear la fila -- aunque sea sin nombre. El
  // nombre ya no se pide a mano: llega solo, extraído por Didit al
  // verificar la identidad (el backend lo completa apenas el webhook trae
  // el veredicto).
  const [conductorId, setConductorId] = useState(initialData?.id || null);
  const [conductorNombre, setConductorNombre] = useState(initialData?.nombre || "");

  // Identidad (cédula + selfie) y licencia de conducir: cada una tiene su
  // propia sesión hosted de Didit, independientes entre sí -- pueden
  // aprobarse en momentos distintos. Si Didit no está disponible para
  // alguna de las dos, esa cae a captura manual + OCR casero (mismo
  // criterio que el KYC del titular).
  const [verificacionExternaEstado, setVerificacionExternaEstado] = useState(
    initialData?.verificacion_externa_estado || null
  );
  // Si ya hay una foto de cédula subida (de una sesión anterior) y Didit no
  // la aprobó, el modal debe reabrir mostrando el modo manual, no el botón
  // de Didit de nuevo.
  const [usarCapturaManual, setUsarCapturaManual] = useState(
    () => !!initialData?.carnet_frontal_url && initialData?.verificacion_externa_estado !== "aprobada"
  );
  const [carnetFrontalUrl, setCarnetFrontalUrl] = useState(initialData?.carnet_frontal_url || null);
  const [carnetTraseroUrl, setCarnetTraseroUrl] = useState(initialData?.carnet_trasero_url || null);
  const [selfieUrl, setSelfieUrl] = useState(initialData?.selfie_url || null);

  const [licenciaVerificacionExternaEstado, setLicenciaVerificacionExternaEstado] = useState(
    initialData?.licencia_verificacion_externa_estado || null
  );
  const [usarCapturaManualLicencia, setUsarCapturaManualLicencia] = useState(
    () => !!initialData?.licencia_url && initialData?.licencia_verificacion_externa_estado !== "aprobada"
  );
  const [verificandoLicenciaDidit, setVerificandoLicenciaDidit] = useState(false);
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
      setLicenciaVerificacionExternaEstado(initialData.licencia_verificacion_externa_estado || null);
      setUsarCapturaManual(
        !!initialData.carnet_frontal_url && initialData.verificacion_externa_estado !== "aprobada"
      );
      setUsarCapturaManualLicencia(
        !!initialData.licencia_url && initialData.licencia_verificacion_externa_estado !== "aprobada"
      );
      setEstadoKyc(initialData.estado_kyc || "pendiente");
      setNotasAuditoria(initialData.notas_auditoria || "");
      setConductorRut(initialData.rut || initialData.numero_documento || "");
    }
  }, [initialData, visible]);

  const identidadVerificadaPorDidit = verificacionExternaEstado === "aprobada";
  const licenciaVerificadaPorDidit = licenciaVerificacionExternaEstado === "aprobada";
  // "Completo" = verificado por Didit, o (si Didit falló) capturado a mano.
  const identidadCompleta = identidadVerificadaPorDidit || (usarCapturaManual && !!carnetFrontalUrl);
  const licenciaCompleta = licenciaVerificadaPorDidit || (usarCapturaManualLicencia && !!licenciaUrl);

  // Crea el registro del conductor la primera vez que hace falta -- para
  // pedir una sesión de Didit (identidad o licencia) tiene que existir la
  // fila en el backend. Se crea sin nombre: Didit lo extrae y el backend lo
  // completa solo al llegar el veredicto por webhook.
  const asegurarConductorCreado = async () => {
    if (conductorId) return conductorId;
    const respuesta = await ApiClient.asignarSegundoConductor(reservaId, { nombre: "" });
    setConductorId(respuesta.id);
    setEstadoKyc(respuesta.estado_kyc);
    if (respuesta.nombre) setConductorNombre(respuesta.nombre);
    if (onSaved) onSaved(respuesta);
    return respuesta.id;
  };

  const refrescarConductor = async () => {
    try {
      const actual = await ApiClient.obtenerSegundoConductor(reservaId);
      setEstadoKyc(actual.estado_kyc);
      setNotasAuditoria(actual.notas_auditoria || "");
      setVerificacionExternaEstado(actual.verificacion_externa_estado || null);
      setLicenciaVerificacionExternaEstado(actual.licencia_verificacion_externa_estado || null);
      if (actual.nombre) setConductorNombre(actual.nombre);
      if (actual.rut || actual.numero_documento) setConductorRut(actual.rut || actual.numero_documento);
      if (actual.carnet_frontal_url) setCarnetFrontalUrl(actual.carnet_frontal_url);
      if (actual.carnet_trasero_url) setCarnetTraseroUrl(actual.carnet_trasero_url);
      if (actual.licencia_url) setLicenciaUrl(actual.licencia_url);
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
        hapticoExito();
        showAlert("Identidad verificada", "Didit confirmó la identidad del segundo conductor.");
      } else if (actual?.verificacion_externa_estado === "pendiente" || !actual?.verificacion_externa_estado) {
        showAlert(
          "Verificación pendiente",
          "Aún no recibimos la confirmación de Didit. Puedes volver a intentarlo en unos segundos."
        );
      }
    } catch (err) {
      hapticoError();
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

  const handleVerificarLicenciaDidit = async () => {
    if (verificandoLicenciaDidit) return;
    setVerificandoLicenciaDidit(true);
    try {
      const id = await asegurarConductorCreado();
      if (!id) return;

      const sesion = await ApiClient.crearSesionVerificacionLicenciaSegundoConductor(reservaId, "renter");
      if (!sesion?.url) throw new Error("El proveedor no devolvió una URL válida.");

      await abrirEnNavegador(sesion.url);

      const actual = await refrescarConductor();
      if (actual?.licencia_verificacion_externa_estado === "aprobada") {
        hapticoExito();
        showAlert("Licencia verificada", "Didit confirmó la licencia de conducir del segundo conductor.");
      } else if (
        actual?.licencia_verificacion_externa_estado === "pendiente" ||
        !actual?.licencia_verificacion_externa_estado
      ) {
        showAlert(
          "Verificación pendiente",
          "Aún no recibimos la confirmación de Didit. Puedes volver a intentarlo en unos segundos."
        );
      }
    } catch (err) {
      hapticoError();
      showAlert(
        "No se pudo verificar la licencia con Didit",
        msjError(err, "Hubo un problema al conectar con el proveedor."),
        [
          { text: "Usar foto manual", onPress: () => setUsarCapturaManualLicencia(true) },
          { text: "Reintentar", style: "cancel" },
        ]
      );
    } finally {
      setVerificandoLicenciaDidit(false);
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
    if (!identidadCompleta) {
      showAlert(
        "Falta verificar identidad",
        "Completa la verificación de identidad (con Didit o con fotos manuales) antes de guardar."
      );
      return;
    }
    if (!licenciaCompleta) {
      showAlert(
        "Falta verificar la licencia",
        "Completa la verificación de la licencia de conducir (con Didit o con una foto manual) antes de guardar."
      );
      return;
    }

    setSaving(true);
    try {
      const id = await asegurarConductorCreado();
      if (!id) return;

      // Solo se manda lo que se capturó a mano -- lo aprobado por Didit ya
      // está en el backend desde que llegó el webhook.
      const payload = {};
      if (!identidadVerificadaPorDidit && usarCapturaManual) {
        payload.carnet_frontal_url = carnetFrontalUrl;
        payload.carnet_trasero_url = carnetTraseroUrl;
        payload.selfie_url = selfieUrl;
      }
      if (!licenciaVerificadaPorDidit && usarCapturaManualLicencia) {
        payload.licencia_url = licenciaUrl;
      }

      const respuesta = await ApiClient.actualizarSegundoConductor(reservaId, payload);
      setEstadoKyc(respuesta.estado_kyc);
      setNotasAuditoria(respuesta.notas_auditoria || "");
      if (respuesta.nombre) setConductorNombre(respuesta.nombre);
      if (respuesta.rut || respuesta.numero_documento) {
        setConductorRut(respuesta.rut || respuesta.numero_documento);
      }

      if (respuesta.estado_kyc === "verificado") {
        hapticoExito();
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
      hapticoError();
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
            subtitle="Identidad y licencia verificadas con Didit"
            onBack={onClose}
            tone={tone}
          />

          <ScrollView className="flex-1 mt-3" contentContainerStyle={{ paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
            {!conductorNombre ? (
              <View className="mb-3 flex-row items-start gap-2 bg-teal-50 rounded-xl p-3">
                <Icon name="shield" size={16} color={colors.primary} />
                <Text className="flex-1 text-xs text-primary leading-[17px]">
                  El nombre del segundo conductor se completa solo, con los datos que confirme Didit al
                  verificar su identidad. No hace falta escribirlo a mano.
                </Text>
              </View>
            ) : null}

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

            {/* Licencia de conducir: Didit primero, captura manual como respaldo */}
            <Card padded className="mb-3 gap-2.5">
              <View className="flex-row justify-between items-center">
                <View className="flex-row items-center gap-2">
                  <Icon name="check" size={20} color={colors.primary} />
                  <Text className="text-sm font-bold text-text">2. Licencia de conducir</Text>
                </View>
                {licenciaVerificadaPorDidit && <Badge variant="success" label="Verificada" />}
              </View>
              <Text className="text-xs text-textMuted leading-4">
                {licenciaVerificadaPorDidit
                  ? "Licencia confirmada por Didit."
                  : "Comprueba clase B vigente durante las fechas completas del arriendo."}
              </Text>

              {!licenciaVerificadaPorDidit && !usarCapturaManualLicencia && (
                <Button
                  label="Verificar licencia con Didit"
                  iconRight="arrow-right"
                  loading={verificandoLicenciaDidit}
                  onPress={handleVerificarLicenciaDidit}
                />
              )}

              {!licenciaVerificadaPorDidit && usarCapturaManualLicencia && (
                <>
                  <Button
                    variant={licenciaUrl ? "secondary" : "primary"}
                    size="sm"
                    label={licenciaUrl ? "✓ Licencia escaneada (cambiar)" : "Escanear licencia"}
                    iconLeft="camera"
                    loading={subiendoSlot === "licencia"}
                    onPress={() => iniciarCaptura("licencia")}
                  />
                  <TouchableOpacity onPress={() => setUsarCapturaManualLicencia(false)} hitSlop={theme.control.hitSlop}>
                    <Text className="text-xs font-semibold text-primary text-center mt-0.5">Volver a intentar con Didit</Text>
                  </TouchableOpacity>
                </>
              )}
            </Card>

            {/* Acciones Finales */}
            <View className="mt-3 gap-2.5">
              <Button
                label="Guardar verificación"
                iconRight="arrow-right"
                loading={saving}
                disabled={!identidadCompleta || !licenciaCompleta || saving}
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
              variant={cameraFor}
              onClose={() => setCameraFor(null)}
              onCaptured={(uri) => handleFotoCamara(cameraFor, uri)}
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
