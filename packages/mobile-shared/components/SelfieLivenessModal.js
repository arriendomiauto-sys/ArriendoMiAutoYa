import React, { useEffect, useRef, useState } from "react";
import {
  Modal,
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as ImageManipulator from "expo-image-manipulator";
import { colors } from "../theme/colors";
import { Icon } from "./Icon";

/**
 * Captura guiada de selfie con *liveness pasivo*.
 *
 * En vez de una sola foto estática (que se puede falsear con una foto
 * impresa o la pantalla de otro teléfono), toma DOS: una de frente y otra
 * girando la cabeza. El backend corre detección facial en ambas y compara
 * el ángulo de la cabeza — si rotó de verdad, es una persona en vivo.
 *
 * Props:
 *  - visible: bool
 *  - onClose(): cerrar sin capturar
 *  - onCaptured({ frontalUri, movimientoUri }): las dos fotos confirmadas
 */

const PASOS = [
  {
    id: "frente",
    instruccion: "Mira de frente a la cámara",
    ayuda: "Cara centrada en el óvalo, sin lentes de sol ni gorro, con buena luz.",
  },
  {
    id: "giro",
    instruccion: "Ahora gira la cabeza despacio hacia un lado",
    ayuda: "Un movimiento lento alcanza. No salgas del óvalo.",
  },
];
const SEGUNDOS = 3;

export function SelfieLivenessModal({ visible, onClose, onCaptured }) {
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef(null);
  const { width: SCREEN_W, height: SCREEN_H } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  // fase: "intro" | "contando" | "capturando" | "revisar"
  const [fase, setFase] = useState("intro");
  const [paso, setPaso] = useState(0);
  const [cuenta, setCuenta] = useState(SEGUNDOS);
  const [tomadas, setTomadas] = useState([]); // [uri]

  const frameW = Math.min(SCREEN_W - 96, 300);
  const frameH = frameW * 1.32;

  const reiniciar = () => {
    setFase("intro");
    setPaso(0);
    setCuenta(SEGUNDOS);
    setTomadas([]);
  };

  useEffect(() => {
    if (visible) reiniciar();
  }, [visible]);

  const cerrar = () => {
    reiniciar();
    onClose && onClose();
  };

  // Recorta al óvalo: takePictureAsync captura todo el sensor y la cara
  // quedaría chica en el centro. Mismo criterio que DocumentCameraModal.
  const recortarAlOvalo = async (uri, pw, ph) => {
    if (!pw || !ph || ph < pw) return uri;
    try {
      const s = Math.max(SCREEN_W / pw, SCREEN_H / ph);
      const offX = (SCREEN_W - pw * s) / 2;
      const offY = (SCREEN_H - ph * s) / 2;
      const mx = frameW * 0.28;
      const my = frameH * 0.24;
      const cx = ((SCREEN_W - frameW) / 2 - mx - offX) / s;
      const cy = ((SCREEN_H - frameH) / 2 - my - offY) / s;
      const cw = (frameW + mx * 2) / s;
      const ch = (frameH + my * 2) / s;
      const originX = Math.max(0, Math.round(cx));
      const originY = Math.max(0, Math.round(cy));
      const width = Math.round(Math.min(cw, pw - originX));
      const height = Math.round(Math.min(ch, ph - originY));
      if (width < 48 || height < 48) return uri;
      const out = await ImageManipulator.manipulateAsync(
        uri,
        [{ crop: { originX, originY, width, height } }],
        { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
      );
      return out?.uri || uri;
    } catch {
      return uri;
    }
  };

  const hacerCaptura = async () => {
    if (!cameraRef.current) {
      setFase("intro");
      return;
    }
    setFase("capturando");
    try {
      const foto = await cameraRef.current.takePictureAsync({ quality: 0.85, skipProcessing: false });
      const uri = foto?.uri ? await recortarAlOvalo(foto.uri, foto.width, foto.height) : null;
      if (!uri) {
        // reintenta el mismo paso
        setCuenta(SEGUNDOS);
        setFase("contando");
        return;
      }
      const nuevas = [...tomadas, uri];
      setTomadas(nuevas);
      if (nuevas.length >= PASOS.length) {
        setFase("revisar");
      } else {
        setPaso(nuevas.length);
        setCuenta(SEGUNDOS);
        setFase("contando");
      }
    } catch {
      setCuenta(SEGUNDOS);
      setFase("contando");
    }
  };

  // El efecto de la cuenta regresiva llama SIEMPRE a la última versión de
  // hacerCaptura (que cierra sobre `tomadas`), no a la del render en que
  // se montó el efecto.
  const capturaRef = useRef(hacerCaptura);
  capturaRef.current = hacerCaptura;

  useEffect(() => {
    if (fase !== "contando") return;
    if (cuenta <= 0) {
      capturaRef.current();
      return;
    }
    const t = setTimeout(() => setCuenta((c) => c - 1), 850);
    return () => clearTimeout(t);
  }, [fase, cuenta]);

  const empezar = () => {
    setPaso(0);
    setCuenta(SEGUNDOS);
    setFase("contando");
  };

  const confirmar = () => {
    onCaptured && onCaptured({ frontalUri: tomadas[0], movimientoUri: tomadas[1] });
    reiniciar();
  };

  const renderContenido = () => {
    if (!permission) {
      return (
        <View style={styles.centerBox}>
          <ActivityIndicator color="#FFFFFF" />
        </View>
      );
    }

    if (!permission.granted) {
      return (
        <View style={styles.centerBox}>
          <Icon name="camera" size={40} color="#FFFFFF" />
          <Text style={styles.permTitle}>Necesitamos tu cámara</Text>
          <Text style={styles.permText}>
            La selfie de verificación confirma que eres tú quien está creando la cuenta.
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

    if (fase === "revisar") {
      return (
        <View style={styles.flex}>
          <View style={styles.revisarTop}>
            <Text style={styles.revisarTitulo}>¿Se ve tu cara clara en las dos?</Text>
            <View style={styles.revisarFotos}>
              {tomadas.map((uri, i) => (
                <View key={uri} style={styles.revisarItem}>
                  <Image source={{ uri }} style={styles.revisarImg} resizeMode="cover" />
                  <Text style={styles.revisarPie}>{i === 0 ? "De frente" : "Girando"}</Text>
                </View>
              ))}
            </View>
          </View>
          <View style={styles.previewActions}>
            <TouchableOpacity style={styles.retakeBtn} onPress={empezar}>
              <Icon name="arrow-left" size={16} color="#FFFFFF" />
              <Text style={styles.retakeText}>Repetir</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.useBtn} onPress={confirmar}>
              <Text style={styles.useText}>Usar estas fotos</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    const pasoActual = PASOS[paso] || PASOS[0];

    return (
      <View style={styles.flex}>
        <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="front" />

        {/* Máscara oscura con óvalo transparente CENTRADO */}
        <View style={styles.maskRow}>
          <View style={styles.maskSide} />
          <View style={[styles.window, { width: frameW, height: frameH, borderRadius: frameH / 2 }]}>
            <View style={[styles.corner, styles.cornerTL]} />
            <View style={[styles.corner, styles.cornerTR]} />
            <View style={[styles.corner, styles.cornerBL]} />
            <View style={[styles.corner, styles.cornerBR]} />
          </View>
          <View style={styles.maskSide} />
        </View>

        {/* Cuenta regresiva grande sobre el óvalo */}
        {fase === "contando" && cuenta > 0 ? (
          <View style={styles.cuentaWrap} pointerEvents="none">
            <Text style={styles.cuentaNum}>{cuenta}</Text>
          </View>
        ) : null}
        {fase === "capturando" ? (
          <View style={styles.cuentaWrap} pointerEvents="none">
            <ActivityIndicator size="large" color="#FFFFFF" />
          </View>
        ) : null}

        <View style={[styles.topBar, { top: insets.top + 12 }]}>
          <TouchableOpacity onPress={cerrar} style={styles.iconBtn} hitSlop={12}>
            <Icon name="close" size={22} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.topTitle}>Selfie de verificación</Text>
          <View style={styles.iconBtn} />
        </View>

        <View style={[styles.bottomArea, { bottom: insets.bottom + 40 }]}>
          <View style={styles.pasoPills}>
            {PASOS.map((p, i) => (
              <View
                key={p.id}
                style={[
                  styles.pasoPill,
                  i < tomadas.length && styles.pasoPillHecho,
                  i === paso && fase !== "intro" && styles.pasoPillActivo,
                ]}
              />
            ))}
          </View>

          {fase === "intro" ? (
            <>
              <Text style={styles.hint}>
                Vamos a tomar dos fotos: una de frente y otra girando la cabeza. Se
                capturan solas con una cuenta regresiva.
              </Text>
              <TouchableOpacity style={styles.empezarBtn} onPress={empezar} activeOpacity={0.85}>
                <Text style={styles.empezarText}>Empezar</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={styles.instruccion}>{pasoActual.instruccion}</Text>
              <Text style={styles.hint}>{pasoActual.ayuda}</Text>
            </>
          )}
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

  maskRow: { ...StyleSheet.absoluteFillObject, flexDirection: "row", alignItems: "center" },
  maskSide: { flex: 1, alignSelf: "stretch", backgroundColor: DIM },
  window: {
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.9)",
  },
  corner: { position: "absolute", width: 26, height: 26, borderColor: colors.accent500 },
  cornerTL: { top: -2, left: -2, borderTopWidth: 4, borderLeftWidth: 4, borderTopLeftRadius: 10 },
  cornerTR: { top: -2, right: -2, borderTopWidth: 4, borderRightWidth: 4, borderTopRightRadius: 10 },
  cornerBL: { bottom: -2, left: -2, borderBottomWidth: 4, borderLeftWidth: 4, borderBottomLeftRadius: 10 },
  cornerBR: { bottom: -2, right: -2, borderBottomWidth: 4, borderRightWidth: 4, borderBottomRightRadius: 10 },

  cuentaWrap: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center" },
  cuentaNum: {
    color: "#FFFFFF",
    fontSize: 96,
    fontWeight: "800",
    textShadowColor: "rgba(0,0,0,0.5)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },

  topBar: {
    position: "absolute",
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
    left: 0,
    right: 0,
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 28,
  },
  pasoPills: { flexDirection: "row", gap: 8, marginBottom: 4 },
  pasoPill: {
    width: 34,
    height: 4,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.3)",
  },
  pasoPillActivo: { backgroundColor: "#FFFFFF" },
  pasoPillHecho: { backgroundColor: colors.accent500 },
  instruccion: { color: "#FFFFFF", fontSize: 17, fontWeight: "700", textAlign: "center" },
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
  empezarBtn: {
    marginTop: 4,
    minWidth: 220,
    height: 52,
    borderRadius: 12,
    backgroundColor: colors.accent500,
    alignItems: "center",
    justifyContent: "center",
  },
  empezarText: { color: "#FFFFFF", fontSize: 16, fontWeight: "700" },

  revisarTop: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 20, gap: 20 },
  revisarTitulo: { color: "#FFFFFF", fontSize: 17, fontWeight: "700", textAlign: "center" },
  revisarFotos: { flexDirection: "row", gap: 16 },
  revisarItem: { alignItems: "center", gap: 8 },
  revisarImg: { width: 130, height: 170, borderRadius: 12, backgroundColor: "#111827" },
  revisarPie: { color: "#CBD5E1", fontSize: 13, fontWeight: "600" },

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
