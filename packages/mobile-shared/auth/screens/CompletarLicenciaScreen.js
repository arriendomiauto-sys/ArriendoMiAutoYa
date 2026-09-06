import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { colors } from "../../theme/colors";
import { useApp } from "../../context/AppContext";
import { Icon } from "../../components/Icon";
import { DocumentCameraModal } from "../../components/DocumentCameraModal";
import { ApiClient } from "../../api/client";
import { subirImagenOptimizada, AJUSTES_DOCUMENTO } from "../../utils/imagenes";
import { showAlert } from "../../utils/alert";

/**
 * Mini-flujo de licencia para un usuario YA verificado (típicamente se
 * enroló como dueño, que no pide licencia) que ahora quiere arrendar.
 *
 * Reusa la identidad que ya tiene en ficha: acá va solo la licencia de
 * conducir —y, para extranjeros, el Permiso Internacional (PIC) y la
 * residencia—. No repite cédula, selfie ni tarjeta, y no cobra ningún hold.
 *
 * Props:
 *  - onDone(): la licencia quedó validada o en revisión; volver a lo que
 *    el usuario estaba haciendo (normalmente, reservar).
 *  - onCancel(): salió sin completar.
 */
export function CompletarLicenciaScreen({ onDone, onCancel }) {
  const { currentUser, syncProfile } = useApp();
  const esExtranjero = !!currentUser?.tipo_documento && currentUser.tipo_documento !== "rut";

  const [licenciaUrl, setLicenciaUrl] = useState(null);
  const [picUrl, setPicUrl] = useState(null);
  const [esResidente, setEsResidente] = useState(!!currentUser?.es_residente_chile);
  const [paisLicencia, setPaisLicencia] = useState(
    (currentUser?.licencia_pais_emisor || currentUser?.pais_documento || "").toUpperCase()
  );
  const [camara, setCamara] = useState(null); // "licencia" | "pic" | null
  const [subiendo, setSubiendo] = useState(false);
  const [enviando, setEnviando] = useState(false);

  const enRevision = currentUser?.licencia_estado === "revision";

  const handleCaptura = async (uri) => {
    const slot = camara;
    setCamara(null);
    if (!uri || !slot) return;
    setSubiendo(true);
    try {
      const url = await subirImagenOptimizada(uri, {
        filename: `${slot === "pic" ? "permiso_internacional" : "licencia_conducir"}_${Date.now()}.jpg`,
        bucket: "documentos-kyc",
        ...AJUSTES_DOCUMENTO,
      });
      if (slot === "pic") setPicUrl(url);
      else setLicenciaUrl(url);
    } catch (err) {
      showAlert("No se pudo subir la foto", err.message || "Revisa tu conexión e inténtalo de nuevo.");
    } finally {
      setSubiendo(false);
    }
  };

  const enviar = async () => {
    if (!licenciaUrl) {
      showAlert("Falta tu licencia", "Fotografía tu licencia de conducir para continuar.");
      return;
    }
    if (esExtranjero && paisLicencia.trim().length !== 2) {
      showAlert(
        "Falta el país de la licencia",
        "Indica el país que la emitió con su código de 2 letras (ej. AR, PE, VE)."
      );
      return;
    }
    setEnviando(true);
    try {
      const perfil = await ApiClient.completarLicencia({
        licencia_url: licenciaUrl,
        pic_url: picUrl || undefined,
        licencia_pais_emisor: esExtranjero ? paisLicencia.trim().toUpperCase() : "CL",
        es_residente_chile: esExtranjero ? esResidente : undefined,
      });
      await syncProfile();
      if (perfil?.licencia_estado === "verificada") {
        showAlert("Licencia validada", "Ya puedes reservar autos.", [
          { text: "Continuar", onPress: onDone },
        ]);
      } else {
        showAlert(
          "Licencia en revisión",
          "Un ejecutivo la revisa a mano. Te avisamos apenas puedas reservar (normalmente dentro de unas horas).",
          [{ text: "Entendido", onPress: onDone }]
        );
      }
    } catch (err) {
      showAlert(
        "No se pudo validar tu licencia",
        err.message || "Revisa tu conexión e inténtalo de nuevo."
      );
    } finally {
      setEnviando(false);
    }
  };

  if (enRevision) {
    return (
      <View style={styles.container}>
        <View style={styles.center}>
          <View style={styles.clockCircle}>
            <Icon name="clock" size={36} color="#D97706" />
          </View>
          <Text style={styles.titulo}>Tu licencia está en revisión</Text>
          <Text style={styles.sub}>
            Ya recibimos tu licencia. Un ejecutivo la está revisando — te avisamos
            apenas puedas reservar.
          </Text>
          <TouchableOpacity style={styles.primaryBtn} onPress={onDone}>
            <Text style={styles.primaryBtnText}>Entendido</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 8 : 0}
    >
      <TouchableOpacity onPress={onCancel} style={styles.backBtn} hitSlop={12}>
        <Icon name="arrow-left" size={20} color={colors.primary} />
      </TouchableOpacity>

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.iconCircle}>
          <Icon name="camera" size={30} color="#FFFFFF" />
        </View>
        <Text style={styles.titulo}>Valida tu licencia para arrendar</Text>
        <Text style={styles.sub}>
          Tu identidad ya está verificada. Solo falta tu licencia de conducir —
          fotografíala completa, plana y sin reflejos.
        </Text>

        <View style={styles.card}>
          <TouchableOpacity
            style={[styles.docSlot, licenciaUrl && styles.docSlotDone]}
            onPress={() => setCamara("licencia")}
            disabled={subiendo || enviando}
            activeOpacity={0.85}
          >
            <Icon
              name={licenciaUrl ? "check" : "camera"}
              size={18}
              color={licenciaUrl ? colors.accent : colors.primary}
            />
            <Text style={styles.docSlotText}>
              {licenciaUrl ? "Licencia capturada" : "Fotografiar licencia de conducir"}
            </Text>
          </TouchableOpacity>

          {esExtranjero && (
            <>
              <View style={styles.grupo}>
                <Text style={styles.label}>PAÍS QUE EMITIÓ LA LICENCIA (2 LETRAS)</Text>
                <View style={styles.inputBox}>
                  <TextInput
                    style={styles.input}
                    value={paisLicencia}
                    onChangeText={(t) => setPaisLicencia(t.toUpperCase().slice(0, 2))}
                    placeholder="Ej. AR"
                    placeholderTextColor={colors.textPlaceholder}
                    autoCapitalize="characters"
                    maxLength={2}
                  />
                </View>
              </View>

              <TouchableOpacity
                style={[styles.docSlot, esResidente && styles.docSlotDone]}
                onPress={() => setEsResidente((v) => !v)}
                activeOpacity={0.85}
              >
                <Icon name={esResidente ? "check" : "shield"} size={18} color={colors.primary} />
                <Text style={styles.docSlotText}>
                  {esResidente ? "Soy residente en Chile ✓" : "¿Eres residente en Chile?"}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.docSlot, picUrl && styles.docSlotDone]}
                onPress={() => setCamara("pic")}
                disabled={subiendo || enviando}
                activeOpacity={0.85}
              >
                <Icon name={picUrl ? "check" : "camera"} size={18} color={colors.primary} />
                <Text style={styles.docSlotText}>
                  {picUrl
                    ? "Permiso Internacional capturado"
                    : "Agregar Permiso Internacional (PIC), si tu país lo requiere"}
                </Text>
              </TouchableOpacity>

              <Text style={styles.nota}>
                Si tu país no adhirió al Convenio de Viena, además de la licencia
                necesitas el PIC vigente. Un ejecutivo lo confirma.
              </Text>
            </>
          )}
        </View>

        {subiendo ? (
          <View style={styles.subiendoRow}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={styles.subiendoText}>Subiendo…</Text>
          </View>
        ) : null}

        <TouchableOpacity
          style={[styles.primaryBtn, (!licenciaUrl || enviando || subiendo) && styles.primaryBtnOff]}
          onPress={enviar}
          disabled={!licenciaUrl || enviando || subiendo}
          activeOpacity={0.85}
        >
          {enviando ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.primaryBtnText}>Validar licencia</Text>
          )}
        </TouchableOpacity>
      </ScrollView>

      <DocumentCameraModal
        visible={!!camara}
        variant="licencia"
        onClose={() => setCamara(null)}
        onCaptured={handleCaptura}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, paddingHorizontal: 20, paddingTop: 16 },
  backBtn: { alignSelf: "flex-start", marginBottom: 4 },
  scroll: { paddingBottom: 48, alignItems: "center", gap: 16 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 16 },
  iconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: colors.accent500,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  clockCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#FEF3C7",
    alignItems: "center",
    justifyContent: "center",
  },
  titulo: { fontSize: 21, fontWeight: "700", color: colors.text, textAlign: "center" },
  sub: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: "center",
    lineHeight: 21,
    paddingHorizontal: 8,
  },
  card: {
    width: "100%",
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    gap: 12,
  },
  docSlot: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  docSlotDone: { borderColor: colors.accent500, backgroundColor: colors.accent500 + "12" },
  docSlotText: { flex: 1, fontSize: 14, fontWeight: "600", color: colors.text },
  grupo: { gap: 6 },
  label: {
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.6,
    color: colors.textMuted,
    textTransform: "uppercase",
  },
  inputBox: {
    height: 48,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 10,
    backgroundColor: colors.background,
    paddingHorizontal: 14,
    justifyContent: "center",
  },
  input: { fontSize: 15, color: colors.text },
  nota: { fontSize: 12, lineHeight: 17, color: colors.textMuted },
  subiendoRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  subiendoText: { fontSize: 13, color: colors.textMuted },
  primaryBtn: {
    width: "100%",
    height: 54,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryBtnOff: { opacity: 0.5 },
  primaryBtnText: { color: "#FFFFFF", fontSize: 16, fontWeight: "700" },
});
