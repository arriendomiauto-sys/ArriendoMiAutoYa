import React, { useRef, useEffect, useState } from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
  ActivityIndicator,
  Animated,
  Easing,
  StatusBar,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CameraView, useCameraPermissions } from "expo-camera";
import { colors } from "../theme/colors";
import { theme } from "../theme/tokens";
import { Icon } from "./Icon";
import { hapticoExito } from "../utils/haptics";

/**
 * Modal escáner de QR moderno y de alta fidelidad.
 * Proporciona:
 * - Solicitud proactiva de permisos de cámara con pantalla de rescate estilizada.
 * - Enfoque tipo recorte 4 lados con marco iluminado y esquinas estilizadas.
 * - Láser de escaneo animado suave con haz difuso y línea de precisión.
 * - Toggle de linterna rápida para condiciones de baja luz.
 * - Botón destacado para alternar a ingreso manual de código alfanumérico.
 */
export function QRScannerModal({
  visible,
  titulo = "Escanear código QR",
  hint = "Enfoca el código QR que el usuario muestra en su pantalla.",
  onClose,
  onLeido,
}) {
  const insets = useSafeAreaInsets();
  const { width: SCREEN_W, height: SCREEN_H } = useWindowDimensions();
  const [permission, requestPermission] = useCameraPermissions();
  const [torch, setTorch] = useState(false);
  const leidoRef = useRef(false);

  // Animación del haz láser de escaneo
  const scanAnim = useRef(new Animated.Value(0)).current;
  const WINDOW_SIZE = Math.min(Math.round(SCREEN_W * 0.72), 270);

  useEffect(() => {
    if (visible) {
      leidoRef.current = false;
      setTorch(false);

      // Iniciar barrido del láser
      scanAnim.setValue(0);
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(scanAnim, {
            toValue: 1,
            duration: 2000,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(scanAnim, {
            toValue: 0,
            duration: 2000,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
        ])
      );
      loop.start();

      // Solicitar permiso de cámara proactivamente si aún no se ha otorgado
      if (permission && !permission.granted && permission.canAskAgain !== false) {
        requestPermission();
      }

      return () => loop.stop();
    }
  }, [visible, permission?.granted]);

  const manejarLectura = (evento) => {
    const data = (evento?.data || "").trim();
    if (leidoRef.current || !data) return;
    leidoRef.current = true;
    hapticoExito();
    onLeido?.(data);
  };

  const cerrar = () => {
    leidoRef.current = false;
    setTorch(false);
    onClose?.();
  };

  const laserTranslateY = scanAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [12, WINDOW_SIZE - 16],
  });

  const renderContenido = () => {
    if (!visible) return null;

    if (!permission) {
      return (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Iniciando cámara...</Text>
        </View>
      );
    }

    if (!permission.granted) {
      return (
        <View style={styles.center}>
          <View style={styles.permIconCircle}>
            <Icon name="camera" size={40} color={colors.primary} />
          </View>
          <Text style={styles.permTitle}>Permiso de cámara necesario</Text>
          <Text style={styles.permText}>
            Para validar la entrega de forma instantánea, necesitamos acceso a la cámara de tu
            dispositivo para escanear el código QR.
          </Text>
          <TouchableOpacity
            style={styles.permBtn}
            onPress={requestPermission}
            activeOpacity={0.85}
          >
            <Text style={styles.permBtnText}>Habilitar cámara</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={cerrar}
            style={styles.permCancelBtn}
            activeOpacity={0.7}
          >
            <Icon name="edit" size={16} color="#94A3B8" style={{ marginRight: 6 }} />
            <Text style={styles.permCancel}>Escribir código de 8 caracteres a mano</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View style={styles.flex}>
        <CameraView
          key={visible ? "qr-camera-live" : "qr-camera-closed"}
          style={StyleSheet.absoluteFill}
          facing="back"
          enableTorch={torch}
          barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
          onBarcodeScanned={manejarLectura}
        />

        {/* Máscara de oscurecimiento 4 lados */}
        <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
          {/* Parte superior */}
          <View style={[styles.maskDim, { flex: 1 }]} />

          {/* Fila central con visor */}
          <View style={{ flexDirection: "row", height: WINDOW_SIZE }}>
            <View style={[styles.maskDim, { flex: 1 }]} />

            {/* Recuadro de Enfoque */}
            <View
              style={[
                styles.reticleWindow,
                { width: WINDOW_SIZE, height: WINDOW_SIZE },
              ]}
            >
              {/* 4 esquinas de alta visibilidad */}
              <View style={[styles.corner, styles.cornerTL]} />
              <View style={[styles.corner, styles.cornerTR]} />
              <View style={[styles.corner, styles.cornerBL]} />
              <View style={[styles.corner, styles.cornerBR]} />

              {/* Punto y cruz central sutil */}
              <View style={styles.centerCrosshair}>
                <View style={styles.crosshairH} />
                <View style={styles.crosshairV} />
              </View>

              {/* Láser de escaneo animado */}
              <Animated.View
                style={[
                  styles.laserContainer,
                  {
                    transform: [{ translateY: laserTranslateY }],
                  },
                ]}
              >
                <View style={styles.laserBeam} />
                <View style={styles.laserGlow} />
              </Animated.View>
            </View>

            <View style={[styles.maskDim, { flex: 1 }]} />
          </View>

          {/* Parte inferior */}
          <View style={[styles.maskDim, { flex: 1.35 }]} />
        </View>

        {/* Barra superior flotante */}
        <View style={[styles.topBar, { top: insets.top + 8 }]}>
          <TouchableOpacity
            onPress={cerrar}
            style={styles.actionCircleBtn}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Cerrar escáner"
          >
            <Icon name="close" size={20} color="#FFFFFF" />
          </TouchableOpacity>

          <View style={styles.topTitlesContainer}>
            <Text style={styles.topMainTitle} numberOfLines={1}>
              {titulo}
            </Text>
            <View style={styles.topSubtitleBadge}>
              <View style={styles.liveIndicatorDot} />
              <Text style={styles.topSubtitleText}>Escáner activo</Text>
            </View>
          </View>

          <TouchableOpacity
            onPress={() => setTorch((prev) => !prev)}
            style={[styles.actionCircleBtn, torch && styles.actionCircleBtnTorchOn]}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={torch ? "Apagar linterna" : "Encender linterna"}
          >
            <Icon
              name="zap"
              size={20}
              color={torch ? "#FBBF24" : "#FFFFFF"}
              fill={torch ? "#FBBF24" : "none"}
            />
          </TouchableOpacity>
        </View>

        {/* Barra inferior flotante */}
        <View
          style={[
            styles.bottomControls,
            { bottom: Math.max(insets.bottom, 16) + 16 },
          ]}
        >
          <View style={styles.hintBubble}>
            <Icon name="sparkles" size={16} color={colors.primary} style={{ marginRight: 6 }} />
            <Text style={styles.hintText}>{hint}</Text>
          </View>

          <TouchableOpacity
            style={styles.manualEntryBtn}
            onPress={cerrar}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Ingresar código manual"
          >
            <Icon name="edit" size={17} color="#FFFFFF" style={{ marginRight: 8 }} />
            <Text style={styles.manualEntryText}>Ingresar código a mano</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      onRequestClose={cerrar}
      statusBarTranslucent
      transparent={false}
    >
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <View style={[styles.root, { width: SCREEN_W, height: SCREEN_H }]}>
        {renderContenido()}
      </View>
    </Modal>
  );
}

const DIM_COLOR = "rgba(10, 15, 29, 0.76)";

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#0A0F1D",
  },
  flex: {
    flex: 1,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    backgroundColor: "#0A0F1D",
  },
  loadingText: {
    color: "#94A3B8",
    fontSize: 15,
    fontWeight: "500",
    marginTop: 14,
  },

  // Pantalla de Permiso
  permIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(37, 99, 235, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(37, 99, 235, 0.3)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  permTitle: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 8,
  },
  permText: {
    color: "#94A3B8",
    fontSize: 14,
    textAlign: "center",
    lineHeight: 21,
    maxWidth: 300,
    marginBottom: 24,
  },
  permBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: theme.radius.field || 12,
    width: "100%",
    maxWidth: 280,
    alignItems: "center",
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  permBtnText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 15,
  },
  permCancelBtn: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 18,
    paddingVertical: 8,
  },
  permCancel: {
    color: "#94A3B8",
    fontSize: 14,
    fontWeight: "500",
    textDecorationLine: "underline",
  },

  // Máscaras y Visor
  maskDim: {
    backgroundColor: DIM_COLOR,
  },
  reticleWindow: {
    borderRadius: 24,
    overflow: "hidden",
    position: "relative",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.15)",
    backgroundColor: "transparent",
  },
  corner: {
    position: "absolute",
    width: 32,
    height: 32,
    borderColor: colors.primary,
  },
  cornerTL: {
    top: -1,
    left: -1,
    borderTopWidth: 4.5,
    borderLeftWidth: 4.5,
    borderTopLeftRadius: 22,
  },
  cornerTR: {
    top: -1,
    right: -1,
    borderTopWidth: 4.5,
    borderRightWidth: 4.5,
    borderTopRightRadius: 22,
  },
  cornerBL: {
    bottom: -1,
    left: -1,
    borderBottomWidth: 4.5,
    borderLeftWidth: 4.5,
    borderBottomLeftRadius: 22,
  },
  cornerBR: {
    bottom: -1,
    right: -1,
    borderBottomWidth: 4.5,
    borderRightWidth: 4.5,
    borderBottomRightRadius: 22,
  },

  // Punto y cruz central
  centerCrosshair: {
    position: "absolute",
    top: "50%",
    left: "50%",
    width: 20,
    height: 20,
    marginLeft: -10,
    marginTop: -10,
    alignItems: "center",
    justifyContent: "center",
    opacity: 0.3,
  },
  crosshairH: {
    position: "absolute",
    width: 16,
    height: 1.5,
    backgroundColor: "#FFFFFF",
  },
  crosshairV: {
    position: "absolute",
    height: 16,
    width: 1.5,
    backgroundColor: "#FFFFFF",
  },

  // Haz Láser de Escaneo
  laserContainer: {
    position: "absolute",
    left: 8,
    right: 8,
    height: 18,
    justifyContent: "center",
  },
  laserBeam: {
    height: 2.5,
    backgroundColor: colors.primary,
    borderRadius: 2,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 6,
  },
  laserGlow: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 14,
    backgroundColor: colors.primary,
    opacity: 0.18,
    borderRadius: 7,
  },

  // Barra Superior
  topBar: {
    position: "absolute",
    left: 16,
    right: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  topTitlesContainer: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: 12,
  },
  topMainTitle: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  topSubtitleBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(15, 23, 42, 0.6)",
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
    marginTop: 4,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  liveIndicatorDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#10B981",
    marginRight: 6,
  },
  topSubtitleText: {
    color: "#94A3B8",
    fontSize: 11,
    fontWeight: "600",
  },
  actionCircleBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(15, 23, 42, 0.7)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  actionCircleBtnTorchOn: {
    backgroundColor: "rgba(245, 158, 11, 0.25)",
    borderColor: "#F59E0B",
    shadowColor: "#F59E0B",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 8,
    elevation: 4,
  },

  // Barra Inferior
  bottomControls: {
    position: "absolute",
    left: 20,
    right: 20,
    alignItems: "center",
    gap: 12,
  },
  hintBubble: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(15, 23, 42, 0.8)",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.14)",
    maxWidth: "92%",
  },
  hintText: {
    color: "#F1F5F9",
    fontSize: 13,
    fontWeight: "500",
    textAlign: "center",
    flexShrink: 1,
  },
  manualEntryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 22,
    paddingVertical: 13,
    borderRadius: theme.radius.field || 12,
    backgroundColor: "rgba(255, 255, 255, 0.14)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.3)",
    width: "100%",
    maxWidth: 290,
  },
  manualEntryText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
    letterSpacing: 0.2,
  },
});
