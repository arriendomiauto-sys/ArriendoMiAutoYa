import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  Linking,
  Image,
} from "react-native";
import { colors } from "../theme/colors";
import { Icon } from "../components/Icon";
import { Button, Card, Badge, ScreenHeader } from "../components/ui";
import { DocumentCameraModal } from "../components/DocumentCameraModal";
import { SelfieLivenessModal } from "../components/SelfieLivenessModal";
import { ApiClient } from "../api/client";
import { subirImagenOptimizada, AJUSTES_DOCUMENTO } from "../utils/imagenes";
import { showAlert } from "../utils/alert";

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

export function SegundoConductorModal({
  visible,
  onClose,
  reservaId,
  initialData = null,
  onSaved,
  tone = "light",
}) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [subiendoSlot, setSubiendoSlot] = useState(null);

  // Fotos / URLs de los documentos del segundo conductor
  const [carnetFrontalUrl, setCarnetFrontalUrl] = useState(null);
  const [carnetTraseroUrl, setCarnetTraseroUrl] = useState(null);
  const [licenciaUrl, setLicenciaUrl] = useState(null);
  const [selfieUrl, setSelfieUrl] = useState(null);

  // Estado KYC devuelto por el backend / OCR
  const [estadoKyc, setEstadoKyc] = useState("pendiente"); // 'pendiente' | 'verificado' | 'requiere_revision_manual' | 'rechazado'
  const [notasAuditoria, setNotasAuditoria] = useState("");
  const [conductorNombre, setConductorNombre] = useState("");
  const [conductorRut, setConductorRut] = useState("");

  // Control de cámara guiada y selfie
  const [cameraFor, setCameraFor] = useState(null); // 'carnet_frente' | 'carnet_reverso' | 'licencia'
  const [mostrarSelfieModal, setMostrarSelfieModal] = useState(false);

  useEffect(() => {
    if (initialData) {
      setCarnetFrontalUrl(initialData.carnet_frontal_url || null);
      setCarnetTraseroUrl(initialData.carnet_trasero_url || null);
      setLicenciaUrl(initialData.licencia_url || null);
      setSelfieUrl(initialData.selfie_url || null);
      setEstadoKyc(initialData.estado_kyc || "pendiente");
      setNotasAuditoria(initialData.notas_auditoria || "");
      setConductorNombre(initialData.nombre || "");
      setConductorRut(initialData.rut || initialData.numero_documento || "");
    }
  }, [initialData, visible]);

  // Escaneo o captura con fallback
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
      showAlert("Error al subir", err.message || "No se pudo subir la foto del documento.");
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
      showAlert("Error al subir selfie", err.message || "No se pudo subir la foto selfie.");
    } finally {
      setSubiendoSlot(null);
    }
  };

  const handleProcesarKyc = async () => {
    if (saving) return;
    if (!carnetFrontalUrl) {
      showAlert("Falta Cédula", "Debes escanear el frente de la cédula de identidad.");
      return;
    }
    if (!licenciaUrl) {
      showAlert("Falta Licencia", "Debes escanear la licencia de conducir.");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        nombre: conductorNombre || "Segundo Conductor",
        carnet_frontal_url: carnetFrontalUrl,
        carnet_trasero_url: carnetTraseroUrl,
        licencia_url: licenciaUrl,
        selfie_url: selfieUrl,
      };

      const respuesta = await ApiClient.asignarSegundoConductor(reservaId, payload);
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
      showAlert("Error en KYC", err.message || "No se pudo procesar la verificación automática.");
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
      showAlert("Error al eliminar", err.message || "No se pudo eliminar el segundo conductor.");
    }
  };

  const docsCompletos = !!carnetFrontalUrl && !!licenciaUrl;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <ScreenHeader
            title="Segundo Conductor"
            subtitle="Verificación 100% Automática vía KYC"
            onBack={onClose}
            tone={tone}
          />

          <ScrollView style={styles.body} contentContainerStyle={{ paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
            {/* Banner Informativo KYC */}
            <View style={styles.kycInfoBanner}>
              <Icon name="shield" size={24} color={colors.primary} />
              <View style={{ flex: 1 }}>
                <Text style={styles.kycInfoTitle}>Validación Segura y Automática</Text>
                <Text style={styles.kycInfoSub}>
                  No necesitas ingresar datos manualmente. El sistema escanea y valida cédula, licencia y rostro directamente.
                </Text>
              </View>
            </View>

            {/* Estado Actual */}
            {estadoKyc !== "pendiente" && (
              <Card padded style={[styles.statusCard, estadoKyc === "verificado" ? styles.statusCardOk : styles.statusCardWarn]}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <Text style={styles.statusTitle}>
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
                  <Text style={styles.conductorDataText}>
                    {conductorNombre} {conductorRut ? `• ${conductorRut}` : ""}
                  </Text>
                ) : null}

                {notasAuditoria ? (
                  <Text style={styles.notasAuditoriaText}>{notasAuditoria}</Text>
                ) : null}

                {estadoKyc !== "verificado" && (
                  <View style={{ marginTop: 12 }}>
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

            {/* Slot 1: Cédula de Identidad (Frente y Reverso) */}
            <Card padded style={styles.slotCard}>
              <View style={styles.slotHeader}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Icon name="file-text" size={20} color={colors.primary} />
                  <Text style={styles.slotTitle}>1. Cédula de Identidad</Text>
                </View>
                {carnetFrontalUrl && (
                  <Badge variant="success" label="Frente listo" />
                )}
              </View>
              <Text style={styles.slotDesc}>Escaneo automático de bordes y datos (Módulo 11 y vigencia).</Text>

              <View style={styles.buttonsRow}>
                <View style={{ flex: 1 }}>
                  <Button
                    variant={carnetFrontalUrl ? "secondary" : "primary"}
                    size="sm"
                    label={carnetFrontalUrl ? "✓ Frente escaneado" : "Escanear Frente"}
                    iconLeft="camera"
                    loading={subiendoSlot === "carnet_frente"}
                    onPress={() => iniciarCaptura("carnet_frente")}
                  />
                </View>
                <View style={{ flex: 1 }}>
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
            </Card>

            {/* Slot 2: Licencia de Conducir */}
            <Card padded style={styles.slotCard}>
              <View style={styles.slotHeader}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Icon name="check" size={20} color={colors.primary} />
                  <Text style={styles.slotTitle}>2. Licencia de Conducir</Text>
                </View>
                {licenciaUrl && <Badge variant="success" label="Listo" />}
              </View>
              <Text style={styles.slotDesc}>Comprueba clase B vigente durante las fechas completas del arriendo.</Text>

              <Button
                variant={licenciaUrl ? "secondary" : "primary"}
                size="sm"
                label={licenciaUrl ? "✓ Licencia escaneada (cambiar)" : "Escanear Licencia"}
                iconLeft="camera"
                loading={subiendoSlot === "licencia"}
                onPress={() => iniciarCaptura("licencia")}
              />
            </Card>

            {/* Slot 3: Selfie Biométrica */}
            <Card padded style={styles.slotCard}>
              <View style={styles.slotHeader}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Icon name="user" size={20} color={colors.primary} />
                  <Text style={styles.slotTitle}>3. Validación Facial Biométrica</Text>
                </View>
                {selfieUrl && <Badge variant="success" label="Listo" />}
              </View>
              <Text style={styles.slotDesc}>Verifica que el rostro coincida con la foto de la cédula del segundo conductor.</Text>

              <Button
                variant={selfieUrl ? "secondary" : "outline"}
                size="sm"
                label={selfieUrl ? "✓ Selfie capturada (repetir)" : "Tomar Selfie Biométrica"}
                iconLeft="user"
                loading={subiendoSlot === "selfie"}
                onPress={() => iniciarCaptura("selfie")}
              />
            </Card>

            {/* Acciones Finales */}
            <View style={{ marginTop: 12, gap: 10 }}>
              <Button
                label="Validar con KYC Automático"
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

          {/* Modal de Selfie Biométrica */}
          {mostrarSelfieModal && (
            <SelfieLivenessModal
              visible={mostrarSelfieModal}
              onClose={() => setMostrarSelfieModal(false)}
              onCaptured={handleSelfieCapturada}
            />
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 16,
    maxHeight: "92%",
    flex: 1,
  },
  body: {
    flex: 1,
    marginTop: 12,
  },
  kycInfoBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.primary100,
    padding: 14,
    borderRadius: 14,
    gap: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: colors.primary200,
  },
  kycInfoTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.primary,
  },
  kycInfoSub: {
    fontSize: 12,
    color: colors.primary700,
    marginTop: 2,
    lineHeight: 17,
  },
  statusCard: {
    marginBottom: 14,
    borderWidth: 1.5,
  },
  statusCardOk: {
    backgroundColor: colors.accent100,
    borderColor: colors.accentDark,
  },
  statusCardWarn: {
    backgroundColor: colors.warningBg,
    borderColor: colors.warning,
  },
  statusTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.text,
  },
  conductorDataText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.text,
    marginTop: 4,
  },
  notasAuditoriaText: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 6,
    lineHeight: 17,
  },
  slotCard: {
    marginBottom: 12,
    gap: 10,
  },
  slotHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  slotTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.text,
  },
  slotDesc: {
    fontSize: 12,
    color: colors.textMuted,
    lineHeight: 16,
  },
  buttonsRow: {
    flexDirection: "row",
    gap: 10,
  },
});
