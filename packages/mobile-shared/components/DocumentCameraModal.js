import React, { useRef, useState } from "react";
import {
  Modal,
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
  Platform,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { colors } from "../theme/colors";
import { Icon } from "./Icon";

// Relación de aspecto ISO/IEC 7810 ID-1 (cédula, licencia, tarjetas): 85.6 x 54 mm.
const ID1_RATIO = 85.6 / 54;

const VARIANTS = {
  carnet_frente: {
    facing: "back",
    shape: "card",
    titulo: "Cédula — lado de la foto",
    hint: "Encuadra la cédula dentro del marco. Sin reflejos, sin dedos tapando datos, con buena luz.",
  },
  carnet_reverso: {
    facing: "back",
    shape: "card",
    titulo: "Cédula — reverso",
    hint: "Que se vea el código de barras completo y nítido dentro del marco.",
  },
  licencia: {
    facing: "back",
    shape: "card",
    titulo: "Licencia de conducir",
    hint: "Encuadra la licencia completa dentro del marco, plana y sin reflejos.",
  },
  selfie: {
    facing: "front",
    shape: "face",
    titulo: "Selfie de verificación",
    hint: "Mira de frente, cara centrada en el óvalo, sin lentes de sol ni gorro, con buena luz.",
  },
};

/**
 * Cámara guiada para documentos y selfie. Muestra un marco con la forma
 * correcta (tarjeta ID-1 u óvalo facial) para que la foto salga encuadrada
 * y el OCR / detección facial del backend pueda leerla.
 *
 * Props:
 *  - visible: bool
 *  - variant: 'carnet_frente' | 'carnet_reverso' | 'licencia' | 'selfie'
 *  - onClose(): cerrar sin capturar
 *  - onCaptured(uri): foto confirmada por el usuario
 */
export function DocumentCameraModal({ visible, variant = "carnet_frente", onClose, onCaptured }) {
  const cfg = VARIANTS[variant] || VARIANTS.carnet_frente;
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState(null); // uri de la foto tomada, pendiente de confirmar

  const { width } = Dimensions.get("window");
  const frameW = Math.min(width - 48, 420);
  const frameH = cfg.shape === "face" ? frameW * 1.25 : frameW / ID1_RATIO;

  const cerrar = () => {
    setPreview(null);
    onClose && onClose();
  };

  const tomarFoto = async () => {
    if (!cameraRef.current || busy) return;
    setBusy(true);
    try {
      const foto = await cameraRef.current.takePictureAsync({
        quality: 0.65,
        skipProcessing: false,
      });
      if (foto?.uri) setPreview(foto.uri);
    } catch (e) {
      // Silencioso: el usuario puede reintentar con el botón.
    } finally {
      setBusy(false);
    }
  };

  const confirmar = () => {
    const uri = preview;
    setPreview(null);
    onCaptured && onCaptured(uri);
  };

  const renderContenido = () => {
    // 1. Permiso de cámara aún no resuelto
    if (!permission) {
      return (
        <View style={styles.centerBox}>
          <ActivityIndicator color="#FFFFFF" />
        </View>
      );
    }

    // 2. Permiso denegado
    if (!permission.granted) {
      return (
        <View style={styles.centerBox}>
          <Icon name="camera" size={40} color="#FFFFFF" />
          <Text style={styles.permTitle}>Necesitamos tu cámara</Text>
          <Text style={styles.permText}>
            Para verificar tu identidad hay que fotografiar tu documento y una selfie.
          </Text>
          <TouchableOpacity style={styles.permBtn} onPress={requestPermission}>
            <Text style={styles.permBtnText}>Permitir cámara</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={cerrar} style={{ marginTop: 14 }}>
            <Text style={styles.permCancel}>Cancelar</Text>
          </TouchableOpacity>
        </View>
      );
    }

    // 3. Preview: confirmar o repetir
    if (preview) {
      return (
        <View style={styles.flex}>
          <Image source={{ uri: preview }} style={styles.previewImg} resizeMode="contain" />
          <Text style={styles.previewAsk}>¿Se lee bien y está completo?</Text>
          <View style={styles.previewActions}>
            <TouchableOpacity style={styles.retakeBtn} onPress={() => setPreview(null)}>
              <Icon name="arrow-left" size={16} color="#FFFFFF" />
              <Text style={styles.retakeText}>Repetir</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.useBtn} onPress={confirmar}>
              <Text style={styles.useText}>Usar esta foto</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    // 4. Cámara en vivo con marco guía
    return (
      <View style={styles.flex}>
        <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing={cfg.facing} />

        {/* Máscara oscura con ventana transparente en el centro */}
        <View style={styles.maskRow}>
          <View style={styles.maskSide} />
          <View
            style={[
              styles.window,
              { width: frameW, height: frameH, borderRadius: cfg.shape === "face" ? frameH / 2 : 16 },
            ]}
          >
            <View style={[styles.corner, styles.cornerTL]} />
            <View style={[styles.corner, styles.cornerTR]} />
            <View style={[styles.corner, styles.cornerBL]} />
            <View style={[styles.corner, styles.cornerBR]} />
          </View>
          <View style={styles.maskSide} />
        </View>

        {/* Top bar */}
        <View style={styles.topBar}>
          <TouchableOpacity onPress={cerrar} style={styles.iconBtn} hitSlop={12}>
            <Icon name="close" size={22} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.topTitle}>{cfg.titulo}</Text>
          <View style={styles.iconBtn} />
        </View>

        {/* Hint + shutter */}
        <View style={styles.bottomArea}>
          <Text style={styles.hint}>{cfg.hint}</Text>
          <TouchableOpacity
            style={styles.shutter}
            onPress={tomarFoto}
            disabled={busy}
            activeOpacity={0.8}
          >
            {busy ? <ActivityIndicator color={colors.primary} /> : <View style={styles.shutterCore} />}
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={cerrar} statusBarTranslucent>
      <View style={styles.root}>{renderContenido()}</View>
    </Modal>
  );
}

const DIM = "rgba(0,0,0,0.62)";

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000000" },
  flex: { flex: 1 },
  centerBox: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    gap: 12,
  },
  permTitle: { color: "#FFFFFF", fontSize: 20, fontWeight: "700", marginTop: 8 },
  permText: { color: "#CBD5E1", fontSize: 14, textAlign: "center", lineHeight: 20 },
  permBtn: {
    marginTop: 18,
    backgroundColor: colors.accent500,
    paddingHorizontal: 24,
    paddingVertical: 13,
    borderRadius: 12,
  },
  permBtnText: { color: "#FFFFFF", fontWeight: "700", fontSize: 15 },
  permCancel: { color: "#94A3B8", fontSize: 14 },

  // Máscara / ventana
  maskRow: { ...StyleSheet.absoluteFillObject, flexDirection: "row", alignItems: "center" },
  maskSide: { flex: 1, alignSelf: "stretch", backgroundColor: DIM },
  window: {
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.9)",
    // El centro queda transparente (sin backgroundColor) mostrando la cámara.
  },
  corner: {
    position: "absolute",
    width: 26,
    height: 26,
    borderColor: colors.accent500,
  },
  cornerTL: { top: -2, left: -2, borderTopWidth: 4, borderLeftWidth: 4, borderTopLeftRadius: 10 },
  cornerTR: { top: -2, right: -2, borderTopWidth: 4, borderRightWidth: 4, borderTopRightRadius: 10 },
  cornerBL: { bottom: -2, left: -2, borderBottomWidth: 4, borderLeftWidth: 4, borderBottomLeftRadius: 10 },
  cornerBR: { bottom: -2, right: -2, borderBottomWidth: 4, borderRightWidth: 4, borderBottomRightRadius: 10 },

  // Barras superpuestas
  topBar: {
    position: "absolute",
    top: Platform.OS === "ios" ? 54 : 24,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
  },
  iconBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  topTitle: { color: "#FFFFFF", fontSize: 16, fontWeight: "700", flex: 1, textAlign: "center" },
  bottomArea: {
    position: "absolute",
    bottom: 40,
    left: 0,
    right: 0,
    alignItems: "center",
    gap: 18,
    paddingHorizontal: 28,
  },
  hint: {
    color: "#E2E8F0",
    fontSize: 13,
    textAlign: "center",
    lineHeight: 18,
    backgroundColor: "rgba(0,0,0,0.5)",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  shutter: {
    width: 74,
    height: 74,
    borderRadius: 37,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 4,
    borderColor: "rgba(255,255,255,0.4)",
  },
  shutterCore: { width: 58, height: 58, borderRadius: 29, backgroundColor: colors.primary },

  // Preview
  previewImg: { flex: 1, width: "100%", backgroundColor: "#000000" },
  previewAsk: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "600",
    textAlign: "center",
    paddingVertical: 14,
  },
  previewActions: {
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 20,
    paddingBottom: 36,
  },
  retakeBtn: {
    flex: 1,
    height: 52,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.4)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  retakeText: { color: "#FFFFFF", fontSize: 15, fontWeight: "600" },
  useBtn: {
    flex: 1.6,
    height: 52,
    borderRadius: 12,
    backgroundColor: colors.accent500,
    alignItems: "center",
    justifyContent: "center",
  },
  useText: { color: "#FFFFFF", fontSize: 15, fontWeight: "700" },
});
