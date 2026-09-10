import React, { useRef, useEffect } from "react";
import { Modal, View, Text, StyleSheet, TouchableOpacity, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CameraView, useCameraPermissions } from "expo-camera";
import { colors } from "../theme/colors";
import { Icon } from "./Icon";
import { hapticoExito } from "../utils/haptics";

/**
 * Escáner de QR a pantalla completa. Lee UN código y lo devuelve por
 * `onLeido(data)` — no sube ni valida nada, de eso se encarga quien lo abre.
 * Si no hay permiso de cámara, ofrece cerrar y escribir el código a mano.
 *
 * Props:
 *  - visible: bool
 *  - titulo, hint: textos del visor
 *  - onClose(): cerrar sin leer
 *  - onLeido(data): string del QR (ya .trim())
 */
export function QRScannerModal({ visible, titulo = "Escanear código", hint, onClose, onLeido }) {
  const insets = useSafeAreaInsets();
  // El alto/ancho van EXPLÍCITOS al contenedor del Modal: con la New
  // Architecture en Android, `<Modal>` mide a "wrap content" y un `flex:1`
  // suelto colapsa, dejando el escáner apelotonado arriba de la pantalla.
  // Mismo criterio que DocumentCameraModal y SelfieLivenessModal.
  const { width: SCREEN_W, height: SCREEN_H } = useWindowDimensions();
  const [permission, requestPermission] = useCameraPermissions();
  // `onBarcodeScanned` dispara por cada frame mientras el QR está en cuadro:
  // este cerrojo asegura que solo se procese la primera lectura.
  const leidoRef = useRef(false);

  useEffect(() => {
    if (visible) leidoRef.current = false;
  }, [visible]);

  const manejarLectura = (evento) => {
    const data = (evento?.data || "").trim();
    if (leidoRef.current || !data) return;
    leidoRef.current = true;
    hapticoExito();
    onLeido?.(data);
  };

  const cerrar = () => {
    leidoRef.current = false;
    onClose?.();
  };

  const contenido = () => {
    if (!permission) return <View style={styles.center} />;

    if (!permission.granted) {
      return (
        <View style={styles.center}>
          <Icon name="camera" size={40} color="#FFFFFF" />
          <Text style={styles.permTitle}>Necesitamos tu cámara</Text>
          <Text style={styles.permText}>Para leer el código QR de la reserva del cliente.</Text>
          <TouchableOpacity style={styles.permBtn} onPress={requestPermission}>
            <Text style={styles.permBtnText}>Permitir cámara</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={cerrar} style={{ marginTop: 14 }}>
            <Text style={styles.permCancel}>Escribir el código a mano</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View style={styles.flex}>
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
          onBarcodeScanned={manejarLectura}
        />

        <View style={styles.maskRow}>
          <View style={styles.maskSide} />
          <View style={styles.window}>
            <View style={[styles.corner, styles.cornerTL]} />
            <View style={[styles.corner, styles.cornerTR]} />
            <View style={[styles.corner, styles.cornerBL]} />
            <View style={[styles.corner, styles.cornerBR]} />
          </View>
          <View style={styles.maskSide} />
        </View>

        <View style={[styles.topBar, { top: insets.top + 12 }]}>
          <TouchableOpacity onPress={cerrar} style={styles.iconBtn} hitSlop={12} accessibilityRole="button" accessibilityLabel="Cerrar el escáner">
            <Icon name="close" size={22} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.topTitle}>{titulo}</Text>
          <View style={styles.iconBtn} />
        </View>

        <View style={[styles.bottomArea, { bottom: insets.bottom + 40 }]}>
          <Text style={styles.hint}>{hint || "Apunta al QR que el cliente muestra en su celular."}</Text>
          <TouchableOpacity style={styles.manualBtn} onPress={cerrar} accessibilityRole="button">
            <Text style={styles.manualText}>Escribir el código a mano</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={cerrar} statusBarTranslucent>
      <View style={[styles.root, { width: SCREEN_W, height: SCREEN_H }]}>{contenido()}</View>
    </Modal>
  );
}

const DIM = "rgba(0,0,0,0.62)";

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000000" },
  flex: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32, gap: 12 },
  permTitle: { color: "#FFFFFF", fontSize: 20, fontWeight: "700", marginTop: 8 },
  permText: { color: "#CBD5E1", fontSize: 14, textAlign: "center", lineHeight: 20 },
  permBtn: { marginTop: 18, backgroundColor: colors.accent500, paddingHorizontal: 24, paddingVertical: 13, borderRadius: 12 },
  permBtnText: { color: "#FFFFFF", fontWeight: "700", fontSize: 15 },
  permCancel: { color: "#94A3B8", fontSize: 14 },

  maskRow: { ...StyleSheet.absoluteFillObject, flexDirection: "row", alignItems: "center" },
  maskSide: { flex: 1, alignSelf: "stretch", backgroundColor: DIM },
  window: { width: 250, height: 250, borderWidth: 2, borderColor: "rgba(255,255,255,0.9)", borderRadius: 16 },
  corner: { position: "absolute", width: 26, height: 26, borderColor: colors.accent500 },
  cornerTL: { top: -2, left: -2, borderTopWidth: 4, borderLeftWidth: 4, borderTopLeftRadius: 10 },
  cornerTR: { top: -2, right: -2, borderTopWidth: 4, borderRightWidth: 4, borderTopRightRadius: 10 },
  cornerBL: { bottom: -2, left: -2, borderBottomWidth: 4, borderLeftWidth: 4, borderBottomLeftRadius: 10 },
  cornerBR: { bottom: -2, right: -2, borderBottomWidth: 4, borderRightWidth: 4, borderBottomRightRadius: 10 },

  topBar: { position: "absolute", left: 0, right: 0, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16 },
  iconBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  topTitle: { color: "#FFFFFF", fontSize: 16, fontWeight: "700", flex: 1, textAlign: "center" },

  bottomArea: { position: "absolute", left: 0, right: 0, alignItems: "center", gap: 16, paddingHorizontal: 28 },
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
  manualBtn: {
    paddingHorizontal: 20,
    paddingVertical: 11,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.4)",
  },
  manualText: { color: "#FFFFFF", fontSize: 14, fontWeight: "600" },
});
