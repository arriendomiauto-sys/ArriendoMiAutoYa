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
  KeyboardAvoidingView,
} from "react-native";
import { colors } from "../theme/colors";
import { Icon } from "../components/Icon";
import { Button, Field, Card, Badge, ScreenHeader, Chip } from "../components/ui";
import { DocumentCameraModal } from "../components/DocumentCameraModal";
import { ApiClient } from "../api/client";
import { subirImagenOptimizada, AJUSTES_DOCUMENTO } from "../utils/imagenes";
import { showAlert } from "../utils/alert";

function isRutValid(rutRaw) {
  if (!rutRaw) return false;
  const clean = rutRaw.replace(/\./g, "").replace(/-/g, "").trim().toUpperCase();
  if (clean.length < 2) return false;
  const body = clean.slice(0, -1);
  const dv = clean.slice(-1);
  if (!/^\d+$/.test(body)) return false;

  let sum = 0;
  let multiplier = 2;
  for (let i = body.length - 1; i >= 0; i--) {
    sum += parseInt(body[i], 10) * multiplier;
    multiplier = multiplier === 7 ? 2 : multiplier + 1;
  }
  const remainder = 11 - (sum % 11);
  const expectedDv = remainder === 11 ? "0" : remainder === 10 ? "K" : String(remainder);
  return dv === expectedDv;
}

export function SegundoConductorModal({
  visible,
  onClose,
  reservaId,
  initialData = null,
  onSaved,
  tone = "light",
}) {
  const [step, setStep] = useState("identidad"); // 'identidad' | 'licencia' | 'fotos' | 'resumen'
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Datos de identidad
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [telefono, setTelefono] = useState("");
  const [tipoDocumento, setTipoDocumento] = useState("rut");
  const [rut, setRut] = useState("");
  const [numeroDocumento, setNumeroDocumento] = useState("");
  const [paisDocumento, setPaisDocumento] = useState("CL");
  const [fechaNacimiento, setFechaNacimiento] = useState("1995-01-01");

  // Licencia
  const [licenciaPais, setLicenciaPais] = useState("CL");
  const [licenciaNumero, setLicenciaNumero] = useState("");
  const [licenciaClase, setLicenciaClase] = useState("B");
  const [licenciaVencimiento, setLicenciaVencimiento] = useState("2028-12-31");

  // Fotos / URLs
  const [carnetFrontalUrl, setCarnetFrontalUrl] = useState(null);
  const [carnetTraseroUrl, setCarnetTraseroUrl] = useState(null);
  const [licenciaUrl, setLicenciaUrl] = useState(null);
  const [selfieUrl, setSelfieUrl] = useState(null);

  // Estado KYC
  const [estadoKyc, setEstadoKyc] = useState("pendiente");
  const [notasAuditoria, setNotasAuditoria] = useState("");

  // Cámara guiada
  const [cameraFor, setCameraFor] = useState(null); // 'carnet_frente' | 'carnet_reverso' | 'licencia' | 'selfie'

  useEffect(() => {
    if (initialData) {
      setNombre(initialData.nombre || "");
      setEmail(initialData.email || "");
      setTelefono(initialData.telefono || "");
      setTipoDocumento(initialData.tipo_documento || "rut");
      setRut(initialData.rut || "");
      setNumeroDocumento(initialData.numero_documento || "");
      setPaisDocumento(initialData.pais_documento || "CL");
      if (initialData.fecha_nacimiento) {
        setFechaNacimiento(
          typeof initialData.fecha_nacimiento === "string"
            ? initialData.fecha_nacimiento.slice(0, 10)
            : "1995-01-01"
        );
      }
      setLicenciaPais(initialData.licencia_pais_emisor || "CL");
      setLicenciaNumero(initialData.licencia_numero || "");
      setLicenciaClase(initialData.licencia_clase || "B");
      if (initialData.licencia_vencimiento) {
        setLicenciaVencimiento(
          typeof initialData.licencia_vencimiento === "string"
            ? initialData.licencia_vencimiento.slice(0, 10)
            : "2028-12-31"
        );
      }
      setCarnetFrontalUrl(initialData.carnet_frontal_url || null);
      setCarnetTraseroUrl(initialData.carnet_trasero_url || null);
      setLicenciaUrl(initialData.licencia_url || null);
      setSelfieUrl(initialData.selfie_url || null);
      setEstadoKyc(initialData.estado_kyc || "pendiente");
      setNotasAuditoria(initialData.notas_auditoria || "");
    }
  }, [initialData, visible]);

  const esChileno = tipoDocumento === "rut";

  const handleTomarFoto = async (docKey, uri) => {
    setCameraFor(null);
    setLoading(true);
    try {
      const url = await subirImagenOptimizada(uri, "documentos-kyc", AJUSTES_DOCUMENTO);
      if (docKey === "carnet_frente") setCarnetFrontalUrl(url);
      else if (docKey === "carnet_reverso") setCarnetTraseroUrl(url);
      else if (docKey === "licencia") setLicenciaUrl(url);
      else if (docKey === "selfie") setSelfieUrl(url);
    } catch (err) {
      showAlert("Error al subir imagen", err.message || "No se pudo optimizar ni subir el documento.");
    } finally {
      setLoading(false);
    }
  };

  const handleGuardarConductor = async () => {
    if (!nombre.trim()) {
      showAlert("Faltan datos", "Ingresa el nombre completo del segundo conductor.");
      return;
    }
    if (esChileno && !isRutValid(rut)) {
      showAlert("RUT Inválido", "El RUT ingresado no es válido (falla verificación Módulo 11).");
      return;
    }
    if (!carnetFrontalUrl || !licenciaUrl) {
      showAlert(
        "Documentos requeridos",
        "Debes tomar la foto del carnet (frente) y de la licencia de conducir para activar el KYC del segundo conductor."
      );
      return;
    }

    setSaving(true);
    try {
      const payload = {
        nombre: nombre.trim(),
        email: email.trim() || undefined,
        telefono: telefono.trim() || undefined,
        tipo_documento: tipoDocumento,
        rut: esChileno ? rut.trim() : undefined,
        numero_documento: !esChileno ? numeroDocumento.trim() : undefined,
        pais_documento: paisDocumento.trim().toUpperCase(),
        fecha_nacimiento: fechaNacimiento ? `${fechaNacimiento}T00:00:00Z` : undefined,
        licencia_pais_emisor: licenciaPais.trim().toUpperCase(),
        licencia_numero: licenciaNumero.trim() || (esChileno ? rut.trim() : undefined),
        licencia_clase: licenciaClase.trim().toUpperCase(),
        licencia_vencimiento: licenciaVencimiento ? `${licenciaVencimiento}T00:00:00Z` : undefined,
        carnet_frontal_url: carnetFrontalUrl,
        carnet_trasero_url: carnetTraseroUrl,
        licencia_url: licenciaUrl,
        selfie_url: selfieUrl,
      };

      const respuesta = await ApiClient.asignarSegundoConductor(reservaId, payload);
      setEstadoKyc(respuesta.estado_kyc);
      setNotasAuditoria(respuesta.notas_auditoria || "");
      showAlert(
        "Segundo Conductor Registrado",
        respuesta.estado_kyc === "verificado"
          ? "¡Identidad y licencia verificadas exitosamente! El segundo conductor está autorizado para el arriendo."
          : respuesta.estado_kyc === "requiere_revision_manual"
          ? "Los documentos fueron recibidos y derivados a revisión por un ejecutivo de soporte."
          : "Los documentos no pasaron la validación automática. Revisa las fotos e inténtalo nuevamente."
      );
      if (onSaved) onSaved(respuesta);
      onClose();
    } catch (err) {
      showAlert("Error al guardar", err.message || "No se pudo registrar el segundo conductor.");
    } finally {
      setSaving(false);
    }
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

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.modalOverlay}
      >
        <View style={styles.modalContent}>
          <ScreenHeader
            title="Segundo Conductor"
            subtitle="Asignación y verificación KYC obligatoria"
            onBack={onClose}
            tone={tone}
          />

          {/* Navegación por pestañas */}
          <View style={styles.tabsRow}>
            <TouchableOpacity
              onPress={() => setStep("identidad")}
              style={[styles.tabBtn, step === "identidad" && styles.tabBtnActive]}
            >
              <Text style={[styles.tabText, step === "identidad" && styles.tabTextActive]}>
                1. Datos
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setStep("licencia")}
              style={[styles.tabBtn, step === "licencia" && styles.tabBtnActive]}
            >
              <Text style={[styles.tabText, step === "licencia" && styles.tabTextActive]}>
                2. Licencia
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setStep("fotos")}
              style={[styles.tabBtn, step === "fotos" && styles.tabBtnActive]}
            >
              <Text style={[styles.tabText, step === "fotos" && styles.tabTextActive]}>
                3. Fotos KYC
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setStep("resumen")}
              style={[styles.tabBtn, step === "resumen" && styles.tabBtnActive]}
            >
              <Text style={[styles.tabText, step === "resumen" && styles.tabTextActive]}>
                4. Estado
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.body} contentContainerStyle={{ paddingBottom: 30 }}>
            {step === "identidad" && (
              <View style={styles.section}>
                <Text style={styles.sectionDesc}>
                  Ingresa los datos personales del segundo conductor que operará el vehículo.
                </Text>

                <Field
                  label="Nombre completo"
                  placeholder="Ej. Juan Pérez González"
                  value={nombre}
                  onChangeText={setNombre}
                />

                <Text style={styles.fieldLabel}>Tipo de documento</Text>
                <View style={styles.chipsRow}>
                  <Chip
                    label="RUT Chileno"
                    selected={tipoDocumento === "rut"}
                    onPress={() => setTipoDocumento("rut")}
                  />
                  <Chip
                    label="Pasaporte"
                    selected={tipoDocumento === "pasaporte"}
                    onPress={() => setTipoDocumento("pasaporte")}
                  />
                  <Chip
                    label="DNI Extranjero"
                    selected={tipoDocumento === "dni_extranjero"}
                    onPress={() => setTipoDocumento("dni_extranjero")}
                  />
                </View>

                {esChileno ? (
                  <Field
                    label="RUT (con guión y dígito verificador)"
                    placeholder="18.456.789-K"
                    value={rut}
                    onChangeText={setRut}
                  />
                ) : (
                  <>
                    <Field
                      label="Número de pasaporte o DNI"
                      placeholder="Ej. A12345678"
                      value={numeroDocumento}
                      onChangeText={setNumeroDocumento}
                    />
                    <Field
                      label="País emisor (Código ISO, ej. AR, US, ES)"
                      placeholder="AR"
                      value={paisDocumento}
                      onChangeText={setPaisDocumento}
                    />
                  </>
                )}

                <Field
                  label="Fecha de nacimiento (AAAA-MM-DD)"
                  placeholder="1995-05-20"
                  value={fechaNacimiento}
                  onChangeText={setFechaNacimiento}
                />

                <Field
                  label="Correo electrónico"
                  placeholder="segundo.conductor@correo.com"
                  keyboardType="email-address"
                  value={email}
                  onChangeText={setEmail}
                />

                <Field
                  label="Teléfono de contacto"
                  placeholder="+56 9 1234 5678"
                  keyboardType="phone-pad"
                  value={telefono}
                  onChangeText={setTelefono}
                />

                <Button
                  label="Continuar a Licencia"
                  onPress={() => setStep("licencia")}
                  style={{ marginTop: 15 }}
                />
              </View>
            )}

            {step === "licencia" && (
              <View style={styles.section}>
                <Text style={styles.sectionDesc}>
                  Datos de la licencia de conducir. La ley chilena exige licencia vigente (mínimo 21 años para arrendar).
                </Text>

                <Field
                  label="País emisor de la licencia"
                  placeholder="CL"
                  value={licenciaPais}
                  onChangeText={setLicenciaPais}
                />

                <Field
                  label="Número de licencia"
                  placeholder="Ej. 18.456.789-K"
                  value={licenciaNumero}
                  onChangeText={setLicenciaNumero}
                />

                <Field
                  label="Clase de licencia"
                  placeholder="B"
                  value={licenciaClase}
                  onChangeText={setLicenciaClase}
                />

                <Field
                  label="Fecha de vencimiento (AAAA-MM-DD)"
                  placeholder="2028-12-31"
                  value={licenciaVencimiento}
                  onChangeText={setLicenciaVencimiento}
                />

                <View style={styles.btnRow}>
                  <Button
                    label="Atrás"
                    variant="secondary"
                    onPress={() => setStep("identidad")}
                    style={{ flex: 1, marginRight: 8 }}
                  />
                  <Button
                    label="Continuar a Fotos"
                    onPress={() => setStep("fotos")}
                    style={{ flex: 1 }}
                  />
                </View>
              </View>
            )}

            {step === "fotos" && (
              <View style={styles.section}>
                <Text style={styles.sectionDesc}>
                  Captura las fotos obligatorias para la verificación automática KYC de carnet y licencia.
                </Text>

                {/* Foto Cédula Frente */}
                <Card style={styles.docCard}>
                  <View style={styles.docRow}>
                    <Icon name="card" size={24} color={carnetFrontalUrl ? colors.success : colors.textMuted} />
                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <Text style={styles.docTitle}>Cédula / Documento (Frente)</Text>
                      <Text style={styles.docStatus}>
                        {carnetFrontalUrl ? "✓ Foto adjuntada" : "Pendiente de captura"}
                      </Text>
                    </View>
                    <Button
                      label={carnetFrontalUrl ? "Reintentar" : "Capturar"}
                      size="sm"
                      variant={carnetFrontalUrl ? "secondary" : "primary"}
                      fullWidth={false}
                      onPress={() => setCameraFor("carnet_frente")}
                    />
                  </View>
                </Card>

                {/* Foto Cédula Reverso */}
                <Card style={styles.docCard}>
                  <View style={styles.docRow}>
                    <Icon name="card" size={24} color={carnetTraseroUrl ? colors.success : colors.textMuted} />
                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <Text style={styles.docTitle}>Cédula (Reverso)</Text>
                      <Text style={styles.docStatus}>
                        {carnetTraseroUrl ? "✓ Foto adjuntada" : "Opcional / Pendiente"}
                      </Text>
                    </View>
                    <Button
                      label={carnetTraseroUrl ? "Reintentar" : "Capturar"}
                      size="sm"
                      variant={carnetTraseroUrl ? "secondary" : "primary"}
                      fullWidth={false}
                      onPress={() => setCameraFor("carnet_reverso")}
                    />
                  </View>
                </Card>

                {/* Foto Licencia */}
                <Card style={styles.docCard}>
                  <View style={styles.docRow}>
                    <Icon name="car" size={24} color={licenciaUrl ? colors.success : colors.textMuted} />
                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <Text style={styles.docTitle}>Licencia de Conducir (Frente)</Text>
                      <Text style={styles.docStatus}>
                        {licenciaUrl ? "✓ Foto adjuntada" : "Obligatoria"}
                      </Text>
                    </View>
                    <Button
                      label={licenciaUrl ? "Reintentar" : "Capturar"}
                      size="sm"
                      variant={licenciaUrl ? "secondary" : "primary"}
                      fullWidth={false}
                      onPress={() => setCameraFor("licencia")}
                    />
                  </View>
                </Card>

                {/* Selfie */}
                <Card style={styles.docCard}>
                  <View style={styles.docRow}>
                    <Icon name="user" size={24} color={selfieUrl ? colors.success : colors.textMuted} />
                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <Text style={styles.docTitle}>Selfie de Validación Facial</Text>
                      <Text style={styles.docStatus}>
                        {selfieUrl ? "✓ Selfie adjuntada" : "Recomendada para biometría"}
                      </Text>
                    </View>
                    <Button
                      label={selfieUrl ? "Reintentar" : "Capturar"}
                      size="sm"
                      variant={selfieUrl ? "secondary" : "primary"}
                      fullWidth={false}
                      onPress={() => setCameraFor("selfie")}
                    />
                  </View>
                </Card>

                <View style={[styles.btnRow, { marginTop: 15 }]}>
                  <Button
                    label="Atrás"
                    variant="secondary"
                    onPress={() => setStep("licencia")}
                    style={{ flex: 1, marginRight: 8 }}
                  />
                  <Button
                    label="Verificar y Guardar"
                    loading={saving}
                    onPress={handleGuardarConductor}
                    style={{ flex: 1 }}
                  />
                </View>
              </View>
            )}

            {step === "resumen" && (
              <View style={styles.section}>
                <Card style={styles.statusCard}>
                  <Text style={styles.cardHeader}>Estado de Validación KYC</Text>
                  <View style={{ flexDirection: "row", alignItems: "center", marginVertical: 10 }}>
                    <Badge
                      label={
                        estadoKyc === "verificado"
                          ? "Verificado ✓"
                          : estadoKyc === "requiere_revision_manual"
                          ? "En Revisión Manual"
                          : estadoKyc === "rechazado"
                          ? "Rechazado"
                          : "Pendiente"
                      }
                      variant={
                        estadoKyc === "verificado"
                          ? "success"
                          : estadoKyc === "requiere_revision_manual"
                          ? "warning"
                          : estadoKyc === "rechazado"
                          ? "danger"
                          : "neutral"
                      }
                    />
                  </View>
                  {notasAuditoria ? (
                    <Text style={styles.notasText}>Detalles: {notasAuditoria}</Text>
                  ) : null}
                </Card>

                <View style={{ marginTop: 15 }}>
                  <Button
                    label="Actualizar Documentos"
                    variant="secondary"
                    onPress={() => setStep("fotos")}
                    style={{ marginBottom: 10 }}
                  />
                  {initialData && (
                    <Button
                      label="Eliminar Segundo Conductor"
                      variant="danger"
                      onPress={handleEliminar}
                    />
                  )}
                </View>
              </View>
            )}
          </ScrollView>

          {/* Modal de Cámara Guiada */}
          {cameraFor && (
            <DocumentCameraModal
              visible={!!cameraFor}
              documentType={cameraFor}
              onCapture={(uri) => handleTomarFoto(cameraFor, uri)}
              onClose={() => setCameraFor(null)}
            />
          )}

          {loading && (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={styles.loadingText}>Optimizando y subiendo documento...</Text>
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    height: "90%",
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  tabsRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    marginVertical: 10,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
  },
  tabBtnActive: {
    borderBottomWidth: 2,
    borderBottomColor: colors.primary,
  },
  tabText: {
    fontSize: 13,
    color: colors.textMuted,
    fontWeight: "600",
  },
  tabTextActive: {
    color: colors.primary,
    fontWeight: "700",
  },
  body: {
    flex: 1,
  },
  section: {
    marginTop: 10,
  },
  sectionDesc: {
    fontSize: 13,
    color: colors.textMuted,
    marginBottom: 14,
    lineHeight: 18,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.text,
    marginBottom: 6,
  },
  chipsRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 14,
  },
  btnRow: {
    flexDirection: "row",
    marginTop: 10,
  },
  docCard: {
    padding: 12,
    marginBottom: 10,
  },
  docRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  docTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.text,
  },
  docStatus: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  statusCard: {
    padding: 16,
  },
  cardHeader: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.text,
  },
  notasText: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 6,
    lineHeight: 16,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255,255,255,0.85)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 999,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 14,
    color: colors.primary,
    fontWeight: "600",
  },
});
