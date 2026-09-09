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
  // El alto va EXPLÍCITO al contenedor del Modal: con la New Architecture en
  // Android, `<Modal>` mide a "wrap content" y `flex:1` colapsaba, dejando
  // todo apelotonado arriba.
  const { width: SCREEN_W, height: SCREEN_H } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  // fase: "intro" | "contando" | "capturando" | "revisar"
  const [fase, setFase] = useState("intro");
  const [paso, setPaso] = useState(0);
  const [cuenta, setCuenta] = useState(SEGUNDOS);
  const [tomadas, setTomadas] = useState([]); // [uri]

  const frameW = Math.min(SCREEN_W - 96, 300);
  const frameH = frameW * 1.32;

  // Posición del óvalo: centrado en la franja libre entre la barra superior y
  // los controles de abajo. Coordenadas absolutas (no flex) porque `<Modal>` +
  // New Architecture en Android colapsaba el layout con flex y dejaba el marco
  // pegado arriba.
  const ovalLeft = (SCREEN_W - frameW) / 2;
  const zoneTop = insets.top + 72;
  const zoneBottom = SCREEN_H - insets.bottom - 250;
  const ovalTop = zoneTop + Math.max(0, (zoneBottom - zoneTop - frameH) / 2);

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

  // Recorta a un recuadro CENTRADO de la foto: takePictureAsync captura todo
  // el sensor y la cara quedaría chica en el centro. El usuario apunta al
  // óvalo, que está centrado en pantalla, así que la cara siempre queda
  // alrededor del centro de la foto — recortar un recuadro centrado y holgado
  // la encuadra sin depender de cómo escale el preview de la cámara (en
  // Android `CameraView` no siempre es "cover"), que era lo que descentraba
  // el resultado. Mismo criterio que DocumentCameraModal.
  const recortarAlOvalo = async (uri, pw, ph) => {
    if (!pw || !ph) return uri;
    try {
      const width = Math.round(pw * 0.72);
      const height = Math.round(ph * 0.82);
      const originX = Math.round((pw - width) / 2);
      const originY = Math.round((ph - height) / 2);
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
          <View style={styles.permIconTile}>
            <Icon name="camera" size={30} color={colors.accent500} />
          </View>
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

        {/* Solo el contorno del óvalo sobre la cámara: sin máscara oscura y sin
            esquinas. La cuenta regresiva / spinner van centrados dentro. */}
        <View
          pointerEvents="none"
          style={[
            styles.faceOval,
            {
              width: frameW,
              height: frameH,
              left: ovalLeft,
              top: ovalTop,
              borderRadius: frameW / 2,
            },
          ]}
        >
          {fase === "contando" && cuenta > 0 ? (
            <View style={styles.cuentaRing}>
              <Text style={styles.cuentaNum}>{cuenta}</Text>
            </View>
          ) : null}
          {fase === "capturando" ? (
            <ActivityIndicator size="large" color="#FFFFFF" />
          ) : null}
        </View>

        <View style={[styles.topBar, { top: insets.top + 12 }]}>
          <TouchableOpacity onPress={cerrar} style={styles.iconBtn} hitSlop={12}>
            <View style={styles.closeCircle}>
              <Icon name="close" size={18} color="#FFFFFF" />
            </View>
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
      <View style={[styles.root, { width: SCREEN_W, height: SCREEN_H }]}>
        {renderContenido()}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000000" },
  flex: { flex: 1 },
  centerBox: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    gap: 12,
    backgroundColor: colors.primary900,
  },
  permIconTile: {
    width: 60,
    height: 60,
    borderRadius: 18,
    backgroundColor: colors.primary800,
    borderWidth: 1,
    borderColor: colors.darkBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  permTitle: { color: "#FFFFFF", fontSize: 20, fontWeight: "800", marginTop: 8 },
  permText: { color: colors.darkTextMuted, fontSize: 14, textAlign: "center", lineHeight: 20 },
  permBtn: {
    marginTop: 18,
    backgroundColor: colors.accent500,
    paddingHorizontal: 24,
    paddingVertical: 13,
    borderRadius: 12,
  },
  permBtnText: { color: colors.primary900, fontWeight: "800", fontSize: 15 },
  permCancel: { color: colors.darkTextMuted, fontSize: 14 },

  // Encuadre de la cara: solo el contorno del óvalo, cámara visible detrás.
  faceOval: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2.5,
    borderColor: "rgba(255,255,255,0.92)",
  },

  cuentaRing: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 3,
    borderColor: colors.accent500,
    backgroundColor: "rgba(6,30,31,0.35)",
    alignItems: "center",
    justifyContent: "center",
  },
  cuentaNum: {
    color: "#FFFFFF",
    fontSize: 34,
    fontWeight: "800",
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
  closeCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.16)",
    alignItems: "center",
    justifyContent: "center",
  },
  topTitle: { color: "#FFFFFF", fontSize: 15, fontWeight: "700", flex: 1, textAlign: "center" },

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
  instruccion: { color: "#FFFFFF", fontSize: 17, fontWeight: "800", textAlign: "center" },
  hint: {
    color: "rgba(255,255,255,0.92)",
    fontSize: 13,
    textAlign: "center",
    lineHeight: 18,
    backgroundColor: "rgba(6,30,31,0.62)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 12,
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
  empezarText: { color: colors.primary900, fontSize: 16, fontWeight: "800" },

  revisarTop: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 20, gap: 20 },
  revisarTitulo: { color: "#FFFFFF", fontSize: 18, fontWeight: "800", textAlign: "center" },
  revisarFotos: { flexDirection: "row", gap: 16 },
  revisarItem: { alignItems: "center", gap: 8 },
  revisarImg: { width: 130, height: 170, borderRadius: 12, backgroundColor: colors.primary900 },
  revisarPie: { color: colors.darkTextMuted, fontSize: 13, fontWeight: "600" },

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
    borderColor: "rgba(255,255,255,0.3)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  retakeText: { color: "#FFFFFF", fontSize: 15, fontWeight: "700" },
  useBtn: {
    flex: 1.6,
    height: 52,
    borderRadius: 12,
    backgroundColor: colors.accent500,
    alignItems: "center",
    justifyContent: "center",
  },
  useText: { color: colors.primary900, fontSize: 15, fontWeight: "800" },
});
