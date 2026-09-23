import React, { useEffect, useRef, useState } from "react";
import {
  Modal,
  View,
  Text,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  useWindowDimensions,
  StyleSheet,
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
        <View className="flex-1 items-center justify-center px-8 gap-3 bg-primary-900">
          <ActivityIndicator color="#FFFFFF" />
        </View>
      );
    }

    if (!permission.granted) {
      return (
        <View className="flex-1 items-center justify-center px-8 gap-3 bg-primary-900">
          <View className="w-[60px] h-[60px] rounded-[18px] bg-primary-800 border border-slate-700 items-center justify-center">
            <Icon name="camera" size={30} color={colors.accent500} />
          </View>
          <Text className="text-white text-xl font-extrabold mt-2">Necesitamos tu cámara</Text>
          <Text className="text-slate-400 text-sm text-center leading-5">
            La selfie de verificación confirma que eres tú quien está creando la cuenta.
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

    if (fase === "revisar") {
      return (
        <View className="flex-1">
          <View className="flex-1 items-center justify-center px-5 gap-5">
            <Text className="text-white text-lg font-extrabold text-center">¿Se ve tu cara clara en las dos?</Text>
            <View className="flex-row gap-4">
              {tomadas.map((uri, i) => (
                <View key={uri} className="items-center gap-2">
                  <Image source={{ uri }} className="w-[130px] h-[170px] rounded-xl bg-primary-900" resizeMode="cover" />
                  <Text className="text-slate-400 text-[13px] font-semibold">{i === 0 ? "De frente" : "Girando"}</Text>
                </View>
              ))}
            </View>
          </View>
          <View className="flex-row gap-3 px-5 pb-9">
            <TouchableOpacity className="flex-1 h-[52px] rounded-xl border-[1.5px] border-white/30 flex-row items-center justify-center gap-2" onPress={empezar}>
              <Icon name="arrow-left" size={16} color="#FFFFFF" />
              <Text className="text-white text-[15px] font-bold">Repetir</Text>
            </TouchableOpacity>
            <TouchableOpacity className="flex-[1.6] h-[52px] rounded-xl bg-accent-500 items-center justify-center" onPress={confirmar}>
              <Text className="text-primary-900 text-[15px] font-extrabold">Usar estas fotos</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    const pasoActual = PASOS[paso] || PASOS[0];

    return (
      <View className="flex-1">
        <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="front" />

        {/* Solo el contorno del óvalo sobre la cámara: sin máscara oscura y sin
            esquinas. La cuenta regresiva / spinner van centrados dentro. */}
        <View
          pointerEvents="none"
          className="absolute items-center justify-center border-[2.5px] border-white/90"
          style={{
            width: frameW,
            height: frameH,
            left: ovalLeft,
            top: ovalTop,
            borderRadius: frameW / 2,
          }}
        >
          {fase === "contando" && cuenta > 0 ? (
            <View className="w-[76px] h-[76px] rounded-full border-[3px] border-accent-500 bg-[rgba(6,30,31,0.35)] items-center justify-center">
              <Text className="text-white text-[34px] font-extrabold">{cuenta}</Text>
            </View>
          ) : null}
          {fase === "capturando" ? (
            <ActivityIndicator size="large" color="#FFFFFF" />
          ) : null}
        </View>

        <View className="absolute left-0 right-0 flex-row items-center justify-between px-4" style={{ top: insets.top + 12 }}>
          <TouchableOpacity onPress={cerrar} className="w-10 h-10 items-center justify-center" hitSlop={12}>
            <View className="w-8 h-8 rounded-full bg-white/15 items-center justify-center">
              <Icon name="close" size={18} color="#FFFFFF" />
            </View>
          </TouchableOpacity>
          <Text className="text-white text-[15px] font-bold flex-1 text-center">Selfie de verificación</Text>
          <View className="w-10 h-10 items-center justify-center" />
        </View>

        <View className="absolute left-0 right-0 items-center gap-3 px-7" style={{ bottom: insets.bottom + 40 }}>
          <View className="flex-row gap-2 mb-1">
            {PASOS.map((p, i) => (
              <View
                key={p.id}
                className={`w-[34px] h-1 rounded-full ${
                  i < tomadas.length
                    ? "bg-accent-500"
                    : i === paso && fase !== "intro"
                    ? "bg-white"
                    : "bg-white/30"
                }`}
              />
            ))}
          </View>

          {fase === "intro" ? (
            <>
              <View className="flex-row items-center gap-2.5 bg-[rgba(6,30,31,0.85)] border border-cyan-400/30 px-3.5 py-2.5 rounded-xl">
                <Icon name="shield" size={16} color={colors.accent400} />
                <Text className="flex-1 text-white/90 text-xs leading-4">
                  <Text style={{ fontWeight: "700" }}>Protección de Datos (Ley N° 19.628): </Text>
                  Tus rasgos faciales se procesan exclusivamente para validar tu identidad y prevenir suplantaciones
                  en el contrato de arriendo. Se almacenan cifrados y no se ceden a terceros.
                </Text>
              </View>
              <Text className="text-white/90 text-[13px] text-center leading-[18px] bg-[rgba(6,30,31,0.62)] border border-white/10 px-3.5 py-2 rounded-xl">
                Tomaremos dos fotos: una de frente y otra girando la cabeza despacio. Se
                capturan automáticamente con una cuenta regresiva.
              </Text>
              <TouchableOpacity className="mt-1 min-w-[220px] h-[52px] rounded-xl bg-accent-500 items-center justify-center" onPress={empezar} activeOpacity={0.85}>
                <Text className="text-primary-900 text-base font-extrabold">Aceptar y empezar verificación</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text className="text-white text-[17px] font-extrabold text-center">{pasoActual.instruccion}</Text>
              <Text className="text-white/90 text-[13px] text-center leading-[18px] bg-[rgba(6,30,31,0.62)] border border-white/10 px-3.5 py-2 rounded-xl">{pasoActual.ayuda}</Text>
            </>
          )}
        </View>
      </View>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={cerrar} statusBarTranslucent>
      <View className="flex-1 bg-black" style={{ width: SCREEN_W, height: SCREEN_H }}>
        {renderContenido()}
      </View>
    </Modal>
  );
}
