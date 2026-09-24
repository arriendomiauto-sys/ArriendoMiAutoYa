import React, { useEffect, useRef, useState, useMemo } from "react";
import {
  BackHandler,
  View,
  Text,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  useWindowDimensions,
  PanResponder,
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

  // Control de Zoom continuo y adaptable (0.5x gran angular, 1x normal, 2x, 3x o continuo por pellizco)
  const [zoomContinuo, setZoomContinuo] = useState(0); // 0 a 0.5
  const [nivelZoom, setNivelZoom] = useState("1x");
  const [lenteUltraWide, setLenteUltraWide] = useState(null);
  const distanciaPellizcoRef = useRef(null);

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

  const aplicarZoomPreset = (preset) => {
    setNivelZoom(preset);
    if (preset === "0.5x") setZoomContinuo(0);
    else if (preset === "1x") setZoomContinuo(0);
    else if (preset === "2x") setZoomContinuo(0.12);
  };

  const panResponderCamara = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: (e) => e.nativeEvent.touches?.length === 2,
        onMoveShouldSetPanResponder: (e) => e.nativeEvent.touches?.length === 2,
        onPanResponderGrant: (e) => {
          if (e.nativeEvent.touches?.length === 2) {
            const [t1, t2] = e.nativeEvent.touches;
            const dist = Math.hypot(t1.pageX - t2.pageX, t1.pageY - t2.pageY);
            distanciaPellizcoRef.current = dist;
          }
        },
        onPanResponderMove: (e) => {
          if (e.nativeEvent.touches?.length === 2 && distanciaPellizcoRef.current) {
            const [t1, t2] = e.nativeEvent.touches;
            const distActual = Math.hypot(t1.pageX - t2.pageX, t1.pageY - t2.pageY);
            const delta = distActual - distanciaPellizcoRef.current;
            distanciaPellizcoRef.current = distActual;

            setZoomContinuo((prev) => {
              const nuevo = Math.min(0.5, Math.max(0, prev + delta * 0.0015));
              const factorAprox = 1 + nuevo * 8;
              setNivelZoom(`${factorAprox.toFixed(1)}x`);
              return nuevo;
            });
          }
        },
        onPanResponderRelease: () => {
          distanciaPellizcoRef.current = null;
        },
      }),
    []
  );

  const zoomProps =
    nivelZoom === "0.5x" && lenteUltraWide
      ? { zoom: 0, selectedLens: lenteUltraWide }
      : { zoom: zoomContinuo };

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

  // Ya no se monta dentro de <Modal> (ver nota junto al return: el preview
  // de la cámara salía negro dentro de la ventana nativa aparte que crea
  // <Modal> en Android). El botón atrás del sistema lo manejaba Modal solo;
  // hay que replicarlo a mano.
  useEffect(() => {
    if (!visible) return undefined;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      cerrar();
      return true;
    });
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

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
        <View className="flex-1 items-center justify-center px-8 gap-3 bg-primary-900">
          <ActivityIndicator color="#FFFFFF" />
        </View>
      );
    }

    // 2. Permiso denegado
    if (!permission.granted) {
      return (
        <View className="flex-1 items-center justify-center px-8 gap-3 bg-primary-900">
          <View className="w-[60px] h-[60px] rounded-[18px] bg-primary-800 border border-slate-700 items-center justify-center">
            <Icon name="camera" size={30} color={colors.accent500} />
          </View>
          <Text className="text-white text-xl font-extrabold mt-2">Necesitamos tu cámara</Text>
          <Text className="text-slate-400 text-sm text-center leading-5">
            Para verificar tu identidad hay que fotografiar tu documento y una selfie.
          </Text>
          <TouchableOpacity className="mt-4.5 bg-accent-500 px-6 py-3.5 rounded-xl" onPress={requestPermission}>
            <Text className="text-primary-900 font-extrabold text-[15px]">Permitir cámara</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={cerrar} className="mt-3.5">
            <Text className="text-slate-400 text-sm">Cancelar</Text>
          </TouchableOpacity>
        </View>
      );
    }

    // 3. Preview: confirmar o repetir
    if (preview) {
      if (cfg.censurarPatente) {
        return (
          <View className="flex-1">
            <View className="flex-1 items-center justify-center">
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
                      className="absolute bg-black rounded"
                      style={{
                        left: (censor.cx - BANDA_PATENTE.w / 2) * cajaW,
                        top: (censor.cy - BANDA_PATENTE.h / 2) * cajaH,
                        width: BANDA_PATENTE.w * cajaW,
                        height: BANDA_PATENTE.h * cajaH,
                      }}
                    />
                  </>
                ) : (
                  // Mientras se mide el archivo real (Image.getSize), evita
                  // dejar ver el fondo negro sólido del contenedor a solas.
                  <View className="flex-1 items-center justify-center">
                    <ActivityIndicator color="#FFFFFF" />
                  </View>
                )}
              </View>
            </View>
            <Text className="text-white text-base font-extrabold text-center pt-4 pb-2">
              Así se va a publicar: la patente queda tapada. Si la barra no quedó
              encima, toca la patente para moverla.
            </Text>
            <View className="flex-row gap-3 px-5 pt-2 pb-9">
              <TouchableOpacity className="flex-1 h-[52px] rounded-xl border-[1.5px] border-white/30 flex-row items-center justify-center gap-2" onPress={() => setPreview(null)} disabled={busy}>
                <Icon name="arrow-left" size={16} color="#FFFFFF" />
                <Text className="text-white text-[15px] font-bold">Repetir</Text>
              </TouchableOpacity>
              <TouchableOpacity className="flex-[1.6] h-[52px] rounded-xl bg-accent-500 items-center justify-center" onPress={confirmar} disabled={busy}>
                {busy ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text className="text-primary-900 text-[15px] font-extrabold">Usar esta foto</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        );
      }

      return (
        <View className="flex-1">
          <Image source={{ uri: preview }} className="flex-1 w-full bg-black" resizeMode="contain" />
          <Text className="text-white text-base font-extrabold text-center pt-4 pb-2">
            {esVehiculo ? "¿Se ve el auto completo y nítido?" : "¿Se lee todo y está completo?"}
          </Text>
          {/* Checklist de lo que el OCR necesita — solo para documentos ID-1 */}
          {!esVehiculo && cfg.shape === "card" ? (
            <View className="gap-1.5 px-6 pb-2.5">
              <View className="flex-row items-center gap-2">
                <Icon name="check" size={14} color={colors.accent500} strokeWidth={2.4} />
                <Text className="text-white/85 text-[12.5px]">Los datos se leen sin esfuerzo</Text>
              </View>
              <View className="flex-row items-center gap-2">
                <Icon name="check" size={14} color={colors.accent500} strokeWidth={2.4} />
                <Text className="text-white/85 text-[12.5px]">Sin reflejos ni bordes recortados</Text>
              </View>
            </View>
          ) : null}
          <View className="flex-row gap-3 px-5 pt-2 pb-9">
            <TouchableOpacity className="flex-1 h-[52px] rounded-xl border-[1.5px] border-white/30 flex-row items-center justify-center gap-2" onPress={() => setPreview(null)}>
              <Icon name="arrow-left" size={16} color="#FFFFFF" />
              <Text className="text-white text-[15px] font-bold">Repetir</Text>
            </TouchableOpacity>
            <TouchableOpacity className="flex-[1.6] h-[52px] rounded-xl bg-accent-500 items-center justify-center" onPress={confirmar}>
              <Text className="text-primary-900 text-[15px] font-extrabold">Usar esta foto</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    // 4. Cámara en vivo con marco guía
    return (
      <View className="flex-1" {...panResponderCamara.panHandlers}>
        <CameraView ref={cameraRef} className="absolute inset-0" facing={cfg.facing} {...zoomProps} />

        {/* Máscara oscura (arriba / abajo / lados) con la ventana transparente
            centrada. */}
        <View className="absolute inset-0 flex-col" style={{ height: SCREEN_H, paddingTop: insets.top, paddingBottom: insets.bottom }}>
          <View className="flex-1 bg-[rgba(6,30,31,0.68)]" />
          <View className="flex-row" style={{ height: frameH }}>
            <View className="flex-1 bg-[rgba(6,30,31,0.68)]" />
            <View
              className="border-[1.5px] border-white/55"
              style={[
                { width: frameW, height: frameH, borderRadius: cfg.shape === "face" ? frameH / 2 : 16 },
              ]}
            >
              <View className="absolute w-[26px] h-[26px] border-accent-500 top-[-2px] left-[-2px] border-t-4 border-l-4 rounded-tl-[10px]" />
              <View className="absolute w-[26px] h-[26px] border-accent-500 top-[-2px] right-[-2px] border-t-4 border-r-4 rounded-tr-[10px]" />
              <View className="absolute w-[26px] h-[26px] border-accent-500 bottom-[-2px] left-[-2px] border-b-4 border-l-4 rounded-bl-[10px]" />
              <View className="absolute w-[26px] h-[26px] border-accent-500 bottom-[-2px] right-[-2px] border-b-4 border-r-4 rounded-br-[10px]" />

              {cfg.censurarPatente ? (
                <View
                  className="absolute border-2 border-dashed border-accent-500 rounded-md items-center justify-center bg-[rgba(47,191,155,0.18)]"
                  style={{
                    left: (BANDA_PATENTE.cx - BANDA_PATENTE.w / 2) * frameW,
                    top: (BANDA_PATENTE.cy - BANDA_PATENTE.h / 2) * frameH,
                    width: BANDA_PATENTE.w * frameW,
                    height: BANDA_PATENTE.h * frameH,
                  }}
                >
                  <Text className="text-white text-[11px] font-bold">Patente aquí</Text>
                </View>
              ) : null}
            </View>
            <View className="flex-1 bg-[rgba(6,30,31,0.68)]" />
          </View>
          <View className="flex-1 bg-[rgba(6,30,31,0.68)]" />
        </View>

        {/* Top bar */}
        <View className="absolute left-0 right-0 flex-row items-center justify-between px-4" style={{ top: insets.top + 12 }}>
          <TouchableOpacity onPress={cerrar} className="w-10 h-10 items-center justify-center" hitSlop={12}>
            <View className="w-8 h-8 rounded-full bg-white/15 items-center justify-center">
              <Icon name="close" size={18} color="#FFFFFF" />
            </View>
          </TouchableOpacity>
          <Text className="text-white text-[15px] font-bold flex-1 text-center">{cfg.titulo}</Text>
          <View className="w-10 h-10 items-center justify-center" />
        </View>

        {/* Selector de Zoom (0.5x gran angular, 1x normal, 2x acercado, continuo por pellizco) */}
        {cfg.facing !== "front" && (
          <View className="absolute self-center flex-row gap-2 bg-black/60 py-1 px-2.5 rounded-full z-10 items-center" style={{ bottom: insets.bottom + 125 }}>
            {lenteUltraWide ? (
              <TouchableOpacity
                className={`w-9 h-9 rounded-full items-center justify-center ${nivelZoom === "0.5x" ? "bg-accent-500" : ""}`}
                onPress={() => aplicarZoomPreset("0.5x")}
                accessibilityRole="button"
                accessibilityLabel="Zoom gran angular 0.5x"
              >
                <Text className={`text-[12.5px] font-bold ${nivelZoom === "0.5x" ? "text-primary-900" : "text-white"}`}>0.5x</Text>
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity
              className={`w-9 h-9 rounded-full items-center justify-center ${nivelZoom === "1x" ? "bg-accent-500" : ""}`}
              onPress={() => aplicarZoomPreset("1x")}
              accessibilityRole="button"
              accessibilityLabel="Zoom normal 1x"
            >
              <Text className={`text-[12.5px] font-bold ${nivelZoom === "1x" ? "text-primary-900" : "text-white"}`}>1x</Text>
            </TouchableOpacity>
            <TouchableOpacity
              className={`w-9 h-9 rounded-full items-center justify-center ${nivelZoom === "2x" ? "bg-accent-500" : ""}`}
              onPress={() => aplicarZoomPreset("2x")}
              accessibilityRole="button"
              accessibilityLabel="Zoom acercado 2x"
            >
              <Text className={`text-[12.5px] font-bold ${nivelZoom === "2x" ? "text-primary-900" : "text-white"}`}>2x</Text>
            </TouchableOpacity>
            {!["0.5x", "1x", "2x"].includes(nivelZoom) && (
              <View className="bg-accent-500 px-2.5 py-1 rounded-full">
                <Text className="text-[12px] font-extrabold text-primary-900">{nivelZoom}</Text>
              </View>
            )}
          </View>
        )}

        {/* Hint + shutter */}
        <View className="absolute left-0 right-0 items-center gap-4.5 px-7" style={{ bottom: insets.bottom + 40 }}>
          <Text className="text-white/90 text-[13px] text-center leading-[18px] bg-[rgba(6,30,31,0.62)] border border-white/10 px-3.5 py-2 rounded-xl">{cfg.hint}</Text>
          <TouchableOpacity
            className="w-[72px] h-[72px] rounded-full bg-white items-center justify-center border-[3px] border-accent-500"
            onPress={tomarFoto}
            disabled={busy}
            activeOpacity={0.8}
          >
            {busy ? <ActivityIndicator color={colors.primary} /> : <View className="w-14 h-14 rounded-full bg-white" />}
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  // Antes esto era <Modal>: en Android, CameraView dentro de la ventana
  // nativa aparte que crea <Modal> no pintaba el preview (pantalla negra) --
  // mismo problema de fondo que ya se resolvió en PhotoViewer.js con los
  // gestos de pellizco. La solución es la misma: en vez de otro parche sobre
  // <Modal>, no usarlo -- esto se monta como overlay absoluto dentro del
  // mismo árbol (mismo GestureHandlerRootView) de la pantalla que lo abre.
  if (!visible) return null;

  return (
    <View
      className="absolute inset-0 bg-black z-[1000] [elevation:1000]"
      style={{ width: SCREEN_W, height: SCREEN_H }}
    >
      {renderContenido()}
    </View>
  );
}
