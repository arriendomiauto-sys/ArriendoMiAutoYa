import React, { useRef, useState } from "react";
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

// Aplanar la foto con la barra negra encima necesita rasterizar la vista.
// Se carga así (y no con import) para que la pantalla siga funcionando en un
// runtime viejo sin el módulo nativo: ahí se recorta la franja en vez de
// taparla, y la patente igual no se publica.
let captureRef = null;
try {
  captureRef = require("react-native-view-shot").captureRef;
} catch (e) {
  captureRef = null;
}

// Posición de la patente dentro del encuadre, en fracciones del alto/ancho.
// La misma franja se dibuja como guía en el visor y se usa para taparla.
const BANDA_PATENTE = { cx: 0.5, cy: 0.78, w: 0.46, h: 0.12 };

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
  // Fotos del auto: mismo visor guiado que los documentos, con marco ancho.
  // El título, la ayuda y si lleva patente los define cada toma (ver
  // vehiculo/fotosAuto.js) y llegan por la prop `config`.
  vehiculo: {
    facing: "back",
    shape: "wide",
    titulo: "Foto del auto",
    hint: "Encuadra el auto completo dentro del marco, con buena luz.",
  },
};

/**
 * Cámara guiada para documentos y selfie. Muestra un marco con la forma
 * correcta (tarjeta ID-1 u óvalo facial) para que la foto salga encuadrada
 * y el OCR / detección facial del backend pueda leerla.
 *
 * Props:
 *  - visible: bool
 *  - variant: 'carnet_frente' | 'carnet_reverso' | 'licencia' | 'selfie' | 'vehiculo'
 *  - config: sobrescribe la configuración del variant (título, hint,
 *    censurarPatente) — lo usan las 9 tomas del auto.
 *  - onClose(): cerrar sin capturar
 *  - onCaptured(uri): foto confirmada por el usuario
 */
export function DocumentCameraModal({ visible, variant = "carnet_frente", config, onClose, onCaptured }) {
  const cfg = { ...(VARIANTS[variant] || VARIANTS.carnet_frente), ...(config || {}) };
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef(null);
  const shotRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState(null); // uri de la foto tomada, pendiente de confirmar
  const [previewDims, setPreviewDims] = useState(null); // { width, height } del original
  // Centro de la barra que tapa la patente, en fracciones de la foto. Parte
  // donde está la guía y el usuario puede moverla tocando la imagen.
  const [censor, setCensor] = useState({ cx: BANDA_PATENTE.cx, cy: BANDA_PATENTE.cy });

  // Control de Zoom (0.5x gran angular, 1x normal, 2x aproximado)
  const ZOOM_DIGITAL_2X = 0.1;
  const [nivelZoom, setNivelZoom] = useState("1x");
  const [lenteUltraWide, setLenteUltraWide] = useState(null);

  React.useEffect(() => {
    if (!permission?.granted) return;
    cameraRef.current
      ?.getAvailableLensesAsync?.()
      .then((lentes) => {
        const ultraWide = (lentes || []).find((l) => /ultrawide/i.test(l));
        setLenteUltraWide(ultraWide || null);
      })
      .catch(() => {});
  }, [permission?.granted]);

  const zoomProps =
    nivelZoom === "0.5x" && lenteUltraWide
      ? { zoom: 0, selectedLens: lenteUltraWide }
      : nivelZoom === "2x"
      ? { zoom: ZOOM_DIGITAL_2X }
      : { zoom: 0 };

  // useWindowDimensions (reactivo) en vez de Dimensions.get("window") (una
  // sola foto tomada al montar): en Android edge-to-edge la medida inicial
  // puede llegar mal y dejaría el marco de guía con un ancho equivocado.
  // El alto se le pasa EXPLÍCITO al contenedor del Modal: con la New
  // Architecture en Android, `<Modal>` mide a "wrap content" y `flex:1`
  // colapsaba — dejaba todo el contenido apelotonado arriba.
  const { width: SCREEN_W, height: SCREEN_H } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const esVehiculo = cfg.shape === "wide";
  const frameW = Math.min(SCREEN_W - (esVehiculo ? 24 : 48), esVehiculo ? 520 : 420);
  const frameH = cfg.shape === "face" ? frameW * 1.25 : esVehiculo ? frameW * 0.75 : frameW / ID1_RATIO;

  // Caja donde se muestra la foto tomada, con la proporción real del archivo:
  // así lo que se rasteriza es exactamente la foto, sin bandas negras.
  // Acotada (min 40% del ancho, max 62% del alto de pantalla): si
  // `previewDims` llega con un aspect ratio anómalo, el contenedor de fondo
  // negro no se dispara a un tamaño absurdo — eso era lo que dejaba un
  // bloque negro gigante debajo de la foto censurada.
  const cajaW = SCREEN_W - 24;
  const cajaHRaw = previewDims
    ? Math.round((cajaW * previewDims.height) / previewDims.width)
    : Math.round(cajaW * 0.75);
  const cajaH = Math.min(Math.max(cajaHRaw, Math.round(cajaW * 0.4)), Math.round(SCREEN_H * 0.62));

  const cerrar = () => {
    setPreview(null);
    setPreviewDims(null);
    setCensor({ cx: BANDA_PATENTE.cx, cy: BANDA_PATENTE.cy });
    onClose && onClose();
  };

  // Recorta la foto a una ventana CENTRADA de la imagen. `takePictureAsync`
  // captura todo el sensor, no solo el recuadro: sin recortar, el documento
  // queda chico y con mucho margen y el OCR del backend no lo lee.
  //
  // El usuario apunta al marco, que está centrado en pantalla, así que el
  // documento SIEMPRE queda alrededor del centro de la foto. Recortar un
  // recuadro centrado y generoso lo encuadra sin depender de cómo escale el
  // preview de la cámara (en Android `CameraView` no siempre es "cover"):
  // ese cálculo por geometría de pantalla era justo lo que descentraba y
  // recortaba mal el resultado en los equipos sin escaneo automático.
  const recortarAlMarco = async (uri, pw, ph) => {
    if (!pw || !ph) return uri;
    try {
      // Fracción de la imagen que se conserva. Holgada a propósito: más vale
      // algo de fondo de sobra que cortar una esquina del documento.
      const fracW = cfg.shape === "face" ? 0.72 : 0.9;
      const fracH = cfg.shape === "face" ? 0.82 : 0.58;
      const width = Math.round(pw * fracW);
      const height = Math.round(ph * fracH);
      const originX = Math.round((pw - width) / 2);
      const originY = Math.round((ph - height) / 2);
      if (width < 48 || height < 48) return uri;
      const out = await ImageManipulator.manipulateAsync(
        uri,
        [{ crop: { originX, originY, width, height } }],
        { compress: 0.75, format: ImageManipulator.SaveFormat.JPEG }
      );
      return out?.uri || uri;
    } catch {
      return uri;
    }
  };

  const tomarFoto = async () => {
    if (!cameraRef.current || busy) return;
    setBusy(true);
    try {
      const foto = await cameraRef.current.takePictureAsync({
        quality: 0.85,
        skipProcessing: false,
      });
      if (foto?.uri) {
        // La foto del auto se usa completa: recortarla al marco dejaría el
        // vehículo cortado. Solo los documentos se ajustan a la ventana.
        const uri = esVehiculo ? foto.uri : await recortarAlMarco(foto.uri, foto.width, foto.height);
        setPreviewDims(null);
        setPreview(uri);
        // Medir el archivo final tal como lo decodifica <Image>, en vez de
        // confiar en foto.width/height: en algunos Android takePictureAsync
        // no refleja bien la rotación EXIF, lo que descuadraba `cajaH`.
        Image.getSize(
          uri,
          (w, h) => setPreviewDims({ width: w, height: h }),
          () => {
            if (foto.width && foto.height) setPreviewDims({ width: foto.width, height: foto.height });
          }
        );
      }
    } catch (e) {
      // Silencioso: el usuario puede reintentar con el botón.
    } finally {
      setBusy(false);
    }
  };

  /**
   * Deja la patente tapada DENTRO del archivo, no solo en pantalla: se
   * rasteriza la foto junto con la barra negra. Si el módulo nativo no está,
   * se recorta la franja inferior — se pierde algo de imagen, pero la patente
   * tampoco se publica.
   */
  const taparPatente = async (uri) => {
    const barra = {
      x: censor.cx - BANDA_PATENTE.w / 2,
      y: censor.cy - BANDA_PATENTE.h / 2,
      w: BANDA_PATENTE.w,
      h: BANDA_PATENTE.h,
    };

    if (captureRef && shotRef.current) {
      try {
        const salida = await captureRef(shotRef, { format: "jpg", quality: 0.85 });
        if (salida) return salida;
      } catch {
        /* cae al recorte de abajo */
      }
    }

    try {
      const { width, height } = previewDims || {};
      if (!width || !height) return uri;
      const alto = Math.round(height * Math.max(0.05, barra.y));
      if (alto < 64) return uri;
      const out = await ImageManipulator.manipulateAsync(
        uri,
        [{ crop: { originX: 0, originY: 0, width, height: alto } }],
        { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG }
      );
      return out?.uri || uri;
    } catch {
      return uri;
    }
  };

  const confirmar = async () => {
    if (busy) return;
    let uri = preview;
    if (cfg.censurarPatente && uri) {
      setBusy(true);
      try {
        uri = await taparPatente(uri);
      } finally {
        setBusy(false);
      }
    }
    setPreview(null);
    setPreviewDims(null);
    onCaptured && onCaptured(uri);
  };

  // Toque sobre la foto: mueve la barra a donde está realmente la patente.
  const moverCensor = (e) => {
    const { locationX, locationY } = e.nativeEvent || {};
    if (typeof locationX !== "number" || typeof locationY !== "number") return;
    const cx = Math.min(1 - BANDA_PATENTE.w / 2, Math.max(BANDA_PATENTE.w / 2, locationX / cajaW));
    const cy = Math.min(1 - BANDA_PATENTE.h / 2, Math.max(BANDA_PATENTE.h / 2, locationY / cajaH));
    setCensor({ cx, cy });
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
          <View style={styles.permIconTile}>
            <Icon name="camera" size={30} color={colors.accent500} />
          </View>
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
      if (cfg.censurarPatente) {
        return (
          <View style={styles.flex}>
            <View style={styles.previewCenter}>
              {/* Lo que se rasteriza al confirmar: foto + barra encima. */}
              <View
                ref={shotRef}
                collapsable={false}
                style={{ width: cajaW, height: cajaH, backgroundColor: "#000000" }}
                onStartShouldSetResponder={() => true}
                onResponderRelease={moverCensor}
              >
                {previewDims ? (
                  <>
                    <Image source={{ uri: preview }} style={{ width: cajaW, height: cajaH }} resizeMode="cover" />
                    <View
                      style={[
                        styles.censorBar,
                        {
                          left: (censor.cx - BANDA_PATENTE.w / 2) * cajaW,
                          top: (censor.cy - BANDA_PATENTE.h / 2) * cajaH,
                          width: BANDA_PATENTE.w * cajaW,
                          height: BANDA_PATENTE.h * cajaH,
                        },
                      ]}
                    />
                  </>
                ) : (
                  // Mientras se mide el archivo real (Image.getSize), evita
                  // dejar ver el fondo negro sólido del contenedor a solas.
                  <View style={styles.previewLoadingBox}>
                    <ActivityIndicator color="#FFFFFF" />
                  </View>
                )}
              </View>
            </View>
            <Text style={styles.previewAsk}>
              Así se va a publicar: la patente queda tapada. Si la barra no quedó
              encima, toca la patente para moverla.
            </Text>
            <View style={styles.previewActions}>
              <TouchableOpacity style={styles.retakeBtn} onPress={() => setPreview(null)} disabled={busy}>
                <Icon name="arrow-left" size={16} color="#FFFFFF" />
                <Text style={styles.retakeText}>Repetir</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.useBtn} onPress={confirmar} disabled={busy}>
                {busy ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.useText}>Usar esta foto</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        );
      }

      return (
        <View style={styles.flex}>
          <Image source={{ uri: preview }} style={styles.previewImg} resizeMode="contain" />
          <Text style={styles.previewAsk}>
            {esVehiculo ? "¿Se ve el auto completo y nítido?" : "¿Se lee todo y está completo?"}
          </Text>
          {/* Checklist de lo que el OCR necesita — solo para documentos ID-1 */}
          {!esVehiculo && cfg.shape === "card" ? (
            <View style={styles.previewChecklist}>
              <View style={styles.previewCheckRow}>
                <Icon name="check" size={14} color={colors.accent500} strokeWidth={2.4} />
                <Text style={styles.previewCheckText}>Los datos se leen sin esfuerzo</Text>
              </View>
              <View style={styles.previewCheckRow}>
                <Icon name="check" size={14} color={colors.accent500} strokeWidth={2.4} />
                <Text style={styles.previewCheckText}>Sin reflejos ni bordes recortados</Text>
              </View>
            </View>
          ) : null}
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
        <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing={cfg.facing} {...zoomProps} />

        {/* Máscara oscura (arriba / abajo / lados) con la ventana transparente
            centrada. Antes solo oscurecía los costados y el marco se
            posicionaba con geometría de pantalla, lo que lo dejaba
            descentrado en varios equipos. */}
        <View style={[styles.maskFill, { height: SCREEN_H, paddingTop: insets.top, paddingBottom: insets.bottom }]}>
          <View style={styles.maskBlock} />
          <View style={[styles.maskMiddle, { height: frameH }]}>
            <View style={styles.maskBlock} />
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

              {cfg.censurarPatente ? (
                <View
                  style={[
                    styles.bandaPatente,
                    {
                      left: (BANDA_PATENTE.cx - BANDA_PATENTE.w / 2) * frameW,
                      top: (BANDA_PATENTE.cy - BANDA_PATENTE.h / 2) * frameH,
                      width: BANDA_PATENTE.w * frameW,
                      height: BANDA_PATENTE.h * frameH,
                    },
                  ]}
                >
                  <Text style={styles.bandaTexto}>Patente aquí</Text>
                </View>
              ) : null}
            </View>
            <View style={styles.maskBlock} />
          </View>
          <View style={styles.maskBlock} />
        </View>

        {/* Top bar */}
        <View style={[styles.topBar, { top: insets.top + 12 }]}>
          <TouchableOpacity onPress={cerrar} style={styles.iconBtn} hitSlop={12}>
            <View style={styles.closeCircle}>
              <Icon name="close" size={18} color="#FFFFFF" />
            </View>
          </TouchableOpacity>
          <Text style={styles.topTitle}>{cfg.titulo}</Text>
          <View style={styles.iconBtn} />
        </View>

        {/* Selector de Zoom (0.5x gran angular, 1x normal, 2x acercado) */}
        {cfg.facing !== "front" && (
          <View style={[styles.zoomRow, { bottom: insets.bottom + 125 }]}>
            {lenteUltraWide ? (
              <TouchableOpacity
                style={[styles.zoomChip, nivelZoom === "0.5x" && styles.zoomChipActivo]}
                onPress={() => setNivelZoom("0.5x")}
                accessibilityRole="button"
                accessibilityLabel="Zoom gran angular 0.5x"
              >
                <Text style={[styles.zoomChipText, nivelZoom === "0.5x" && styles.zoomChipTextActivo]}>0.5x</Text>
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity
              style={[styles.zoomChip, nivelZoom === "1x" && styles.zoomChipActivo]}
              onPress={() => setNivelZoom("1x")}
              accessibilityRole="button"
              accessibilityLabel="Zoom normal 1x"
            >
              <Text style={[styles.zoomChipText, nivelZoom === "1x" && styles.zoomChipTextActivo]}>1x</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.zoomChip, nivelZoom === "2x" && styles.zoomChipActivo]}
              onPress={() => setNivelZoom("2x")}
              accessibilityRole="button"
              accessibilityLabel="Zoom acercado 2x"
            >
              <Text style={[styles.zoomChipText, nivelZoom === "2x" && styles.zoomChipTextActivo]}>2x</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Hint + shutter */}
        <View style={[styles.bottomArea, { bottom: insets.bottom + 40 }]}>
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
      {/* height explícito: ver nota en useWindowDimensions arriba */}
      <View style={[styles.root, { width: SCREEN_W, height: SCREEN_H }]}>
        {renderContenido()}
      </View>
    </Modal>
  );
}

// Penumbra teñida de pino en vez de negro plano.
const DIM = "rgba(6,30,31,0.68)";

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

  // Máscara / ventana
  maskFill: { ...StyleSheet.absoluteFillObject, flexDirection: "column" },
  maskMiddle: { flexDirection: "row" },
  maskBlock: { flex: 1, backgroundColor: DIM },
  window: {
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.55)",
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
    // `top` real lo pone el inline style con el inset seguro del dispositivo.
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
    // `bottom` real lo pone el inline style con el inset seguro del dispositivo.
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
    gap: 18,
    paddingHorizontal: 28,
  },
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
  shutter: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: colors.accent500,
  },
  shutterCore: { width: 56, height: 56, borderRadius: 28, backgroundColor: "#FFFFFF" },

  // Guía de patente (solo tomas frontal/trasera del auto)
  bandaPatente: {
    position: "absolute",
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: colors.accent500,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(47,191,155,0.18)",
  },
  bandaTexto: { color: "#FFFFFF", fontSize: 11, fontWeight: "700" },

  // Preview
  previewCenter: { flex: 1, alignItems: "center", justifyContent: "center" },
  censorBar: { position: "absolute", backgroundColor: "#000000", borderRadius: 4 },
  previewLoadingBox: { flex: 1, alignItems: "center", justifyContent: "center" },
  previewImg: { flex: 1, width: "100%", backgroundColor: "#000000" },
  previewAsk: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800",
    textAlign: "center",
    paddingTop: 16,
    paddingBottom: 8,
  },
  previewChecklist: {
    gap: 7,
    paddingHorizontal: 24,
    paddingBottom: 10,
  },
  previewCheckRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  previewCheckText: { color: "rgba(255,255,255,0.85)", fontSize: 12.5 },
  previewActions: {
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 8,
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
  zoomRow: {
    position: "absolute",
    alignSelf: "center",
    flexDirection: "row",
    gap: 8,
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 999,
    zIndex: 10,
  },
  zoomChip: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  zoomChipActivo: { backgroundColor: colors.accent500 },
  zoomChipText: { color: "#FFFFFF", fontSize: 12.5, fontWeight: "700" },
  zoomChipTextActivo: { color: colors.primary900 || "#000000" },
});
