import React, { useState, useEffect, useCallback } from "react";
import { Modal, View, Text, TouchableOpacity, ScrollView, useWindowDimensions, Image } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
let GestureDetector = null;
let Gesture = null;
try {
  const gh = require("react-native-gesture-handler");
  GestureDetector = gh.GestureDetector;
  Gesture = gh.Gesture;
} catch {
  // react-native-gesture-handler no disponible en binario nativo
}
let Animated = null;
let useSharedValue = null;
let useAnimatedStyle = null;
let withTiming = null;
let runOnJS = null;

try {
  const reanimated = require("react-native-reanimated");
  Animated = reanimated.default || reanimated;
  useSharedValue = reanimated.useSharedValue;
  useAnimatedStyle = reanimated.useAnimatedStyle;
  withTiming = reanimated.withTiming;
  runOnJS = reanimated.runOnJS;
} catch {
  // react-native-reanimated / NativeWorklets no disponible en binario nativo
}

let ExpoImage = null;
try {
  const expImg = require("expo-image");
  ExpoImage = expImg.Image || expImg.default;
} catch {
  ExpoImage = null;
}

import { colors } from "../theme/colors";
import { theme } from "../theme/tokens";
import { Icon } from "./Icon";

const NIVEL_ZOOM_DOBLE_TAP = 2.5;
const ESCALA_MAXIMA = 4;
const UMBRAL_DESCARTAR = 120;

function RenderFoto({ uri, style, resizeMode = "contain" }) {
  if (ExpoImage) {
    return (
      <ExpoImage
        source={{ uri }}
        style={style}
        contentFit={resizeMode === "contain" ? "contain" : "cover"}
        cachePolicy="memory-disk"
        transition={150}
      />
    );
  }
  return <Image source={{ uri }} style={style} resizeMode={resizeMode} />;
}

/**
 * Una foto dentro del visor: pellizcar para acercar/alejar, arrastrar para
 * moverse mientras está ampliada, doble tap para saltar a un zoom fijo, y
 * deslizar hacia abajo (sin zoom) para cerrar el visor completo.
 */
function FotoConGestosInterno({ uri, width, height, zoomNivel, onZoomChange, onDismiss }) {
  const escala = useSharedValue(1);
  const escalaGuardada = useSharedValue(1);
  const trasladoX = useSharedValue(0);
  const trasladoY = useSharedValue(0);
  const trasladoXGuardado = useSharedValue(0);
  const trasladoYGuardado = useSharedValue(0);
  const descartarY = useSharedValue(0);
  const opacidad = useSharedValue(1);

  const avisarZoom = (activo) => onZoomChange?.(activo);

  const restaurar = useCallback(() => {
    escala.value = withTiming(1);
    escalaGuardada.value = 1;
    trasladoX.value = withTiming(0);
    trasladoY.value = withTiming(0);
    trasladoXGuardado.value = 0;
    trasladoYGuardado.value = 0;
  }, [escala, escalaGuardada, trasladoX, trasladoY, trasladoXGuardado, trasladoYGuardado]);

  // Si se cambia el nivel de zoom externamente (píldoras 1x, 2x, 3x)
  useEffect(() => {
    if (typeof zoomNivel === "number") {
      if (zoomNivel <= 1) {
        restaurar();
        onZoomChange?.(false);
      } else {
        const destino = Math.min(zoomNivel, ESCALA_MAXIMA);
        escala.value = withTiming(destino);
        escalaGuardada.value = destino;
        onZoomChange?.(true);
      }
    }
  }, [zoomNivel, escala, escalaGuardada, restaurar, onZoomChange]);

  const pellizco = Gesture.Pinch()
    .onUpdate((e) => {
      escala.value = Math.min(Math.max(escalaGuardada.value * e.scale, 1), ESCALA_MAXIMA);
    })
    .onEnd(() => {
      escalaGuardada.value = escala.value;
      if (escala.value <= 1) {
        restaurar();
        runOnJS(avisarZoom)(false);
      } else {
        runOnJS(avisarZoom)(true);
      }
    });

  const dobleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      if (escalaGuardada.value > 1) {
        restaurar();
        runOnJS(avisarZoom)(false);
        return;
      }
      escala.value = withTiming(NIVEL_ZOOM_DOBLE_TAP);
      escalaGuardada.value = NIVEL_ZOOM_DOBLE_TAP;
      runOnJS(avisarZoom)(true);
    });

  // Un solo Pan: mueve la foto ampliada, o —si no hay zoom— arrastra hacia
  // abajo para cerrar el visor (gesto típico de galería tipo Instagram).
  const arrastre = Gesture.Pan()
    .onUpdate((e) => {
      if (escalaGuardada.value > 1) {
        trasladoX.value = trasladoXGuardado.value + e.translationX;
        trasladoY.value = trasladoYGuardado.value + e.translationY;
        return;
      }
      if (e.translationY > 0) {
        descartarY.value = e.translationY;
        opacidad.value = Math.max(1 - e.translationY / 300, 0.4);
      }
    })
    .onEnd(() => {
      if (escalaGuardada.value > 1) {
        trasladoXGuardado.value = trasladoX.value;
        trasladoYGuardado.value = trasladoY.value;
        return;
      }
      if (descartarY.value > UMBRAL_DESCARTAR) {
        runOnJS(onDismiss)();
        return;
      }
      descartarY.value = withTiming(0);
      opacidad.value = withTiming(1);
    });

  // El doble tap tiene prioridad; si no se confirma como doble tap, el
  // pellizco/arrastre toma el gesto.
  const gestoCompuesto = Gesture.Exclusive(dobleTap, Gesture.Simultaneous(pellizco, arrastre));

  const estiloAnimado = useAnimatedStyle(() => ({
    opacity: opacidad.value,
    transform: [
      { translateY: descartarY.value },
      { translateX: trasladoX.value },
      { translateY: trasladoY.value },
      { scale: escala.value },
    ],
  }));

  return (
    <GestureDetector gesture={gestoCompuesto}>
      <Animated.View className="items-center justify-center" style={[{ width, height }, estiloAnimado]}>
        <RenderFoto uri={uri} style={{ width: "100%", height: "100%" }} resizeMode="contain" />
      </Animated.View>
    </GestureDetector>
  );
}

function FotoSimple({ uri, width, height, zoomNivel }) {
  const escala = typeof zoomNivel === "number" && zoomNivel > 1 ? zoomNivel : 1;
  return (
    <View className="items-center justify-center overflow-hidden" style={{ width, height }}>
      <View style={{ width: "100%", height: "100%", transform: [{ scale: escala }] }}>
        <RenderFoto uri={uri} style={{ width: "100%", height: "100%" }} resizeMode="contain" />
      </View>
    </View>
  );
}

function FotoConGestos(props) {
  if (!GestureDetector || !Gesture || !Animated || !useSharedValue) {
    return <FotoSimple {...props} />;
  }
  return <FotoConGestosInterno {...props} />;
}

/**
 * Visor de fotos a pantalla completa, reutilizable en toda la app: pellizcar
 * para hacer zoom, controles táctiles adaptables (1x, 2x, 3x), doble tap,
 * deslizar entre fotos (deshabilitado mientras está ampliada) y deslizar hacia abajo para cerrar.
 */
export function PhotoViewer({ visible, photos, initialIndex = 0, onClose }) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const [indiceActivo, setIndiceActivo] = useState(initialIndex);
  const [conZoom, setConZoom] = useState(false);
  const [zoomNivel, setZoomNivel] = useState(1);

  useEffect(() => {
    if (visible) {
      setIndiceActivo(initialIndex);
      setConZoom(false);
      setZoomNivel(1);
    }
  }, [visible, initialIndex]);

  const cambiarZoom = (nivel) => {
    setZoomNivel(nivel);
    setConZoom(nivel > 1);
  };

  const fotos = photos || [];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View className="flex-1 bg-primary-950">
        {/* Botón cerrar */}
        <TouchableOpacity
          className="absolute right-4 z-20 w-[38px] h-[38px] rounded-full bg-white/15 items-center justify-center"
          style={{ top: insets.top + 12 }}
          onPress={onClose}
          hitSlop={theme.control.hitSlop}
          accessibilityRole="button"
          accessibilityLabel="Cerrar visor"
        >
          <Icon name="close" size={20} color={colors.textWhite} />
        </TouchableOpacity>

        {/* Píldoras de zoom adaptable (1x, 2x, 3x) */}
        <View
          className="absolute z-20 self-center flex-row items-center gap-1.5 bg-[#061e1f]/80 rounded-full px-3 py-1.5 border border-white/20"
          style={{ top: insets.top + 12 }}
        >
          {[1, 2, 3].map((z) => {
            const activo = zoomNivel === z;
            return (
              <TouchableOpacity
                key={z}
                onPress={() => cambiarZoom(z)}
                className={`px-2.5 py-1 rounded-full ${activo ? "bg-accent" : "bg-transparent"}`}
                accessibilityRole="button"
                accessibilityLabel={`Zoom ${z}x`}
              >
                <Text className={`text-xs font-bold ${activo ? "text-textDark" : "text-white"}`}>{z}x</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <ScrollView
          key={`visor-${initialIndex}`}
          horizontal
          pagingEnabled
          scrollEnabled={!conZoom}
          showsHorizontalScrollIndicator={false}
          contentOffset={{ x: initialIndex * width, y: 0 }}
          onMomentumScrollEnd={(e) => {
            setIndiceActivo(Math.round(e.nativeEvent.contentOffset.x / width));
            setZoomNivel(1);
            setConZoom(false);
          }}
        >
          {fotos.map((uri, i) => (
            <FotoConGestos
              key={uri + i}
              uri={uri}
              width={width}
              height={height}
              zoomNivel={i === indiceActivo ? zoomNivel : 1}
              onZoomChange={(activo) => {
                setConZoom(activo);
                if (!activo) setZoomNivel(1);
              }}
              onDismiss={onClose}
            />
          ))}
        </ScrollView>

        {fotos.length > 1 && (
          <View className="absolute bottom-7 left-0 right-0 flex-row justify-center gap-1.5 z-10">
            {fotos.map((_, i) => (
              <View
                key={i}
                className={`h-1.5 rounded-full ${i === indiceActivo ? "w-5 bg-white" : "w-1.5 bg-white/60"}`}
              />
            ))}
          </View>
        )}
      </View>
    </Modal>
  );
}
