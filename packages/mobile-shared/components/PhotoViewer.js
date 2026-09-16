import React, { useState, useEffect } from "react";
import { Modal, View, StyleSheet, TouchableOpacity, ScrollView, useWindowDimensions, Image } from "react-native";
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
import { colors } from "../theme/colors";
import { theme } from "../theme/tokens";
import { Icon } from "./Icon";

const NIVEL_ZOOM_DOBLE_TAP = 2.5;
const ESCALA_MAXIMA = 4;
const UMBRAL_DESCARTAR = 120;

/**
 * Una foto dentro del visor: pellizcar para acercar/alejar, arrastrar para
 * moverse mientras está ampliada, doble tap para saltar a un zoom fijo, y
 * deslizar hacia abajo (sin zoom) para cerrar el visor completo.
 */
function FotoConGestosInterno({ uri, width, height, onZoomChange, onDismiss }) {
  const escala = useSharedValue(1);
  const escalaGuardada = useSharedValue(1);
  const trasladoX = useSharedValue(0);
  const trasladoY = useSharedValue(0);
  const trasladoXGuardado = useSharedValue(0);
  const trasladoYGuardado = useSharedValue(0);
  const descartarY = useSharedValue(0);
  const opacidad = useSharedValue(1);

  const avisarZoom = (activo) => onZoomChange?.(activo);

  const restaurar = () => {
    escala.value = withTiming(1);
    escalaGuardada.value = 1;
    trasladoX.value = withTiming(0);
    trasladoY.value = withTiming(0);
    trasladoXGuardado.value = 0;
    trasladoYGuardado.value = 0;
  };

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
      <Animated.View style={[{ width, height }, styles.slide, estiloAnimado]}>
        <Image source={{ uri }} style={styles.imagen} resizeMode="contain" />
      </Animated.View>
    </GestureDetector>
  );
}

function FotoSimple({ uri, width, height }) {
  return (
    <View style={[{ width, height }, styles.slide]}>
      <Image source={{ uri }} style={styles.imagen} resizeMode="contain" />
    </View>
  );
}

function FotoConGestos(props) {
  if (!GestureDetector || !Gesture || !Animated || !useSharedValue) {
    return <FotoSimple uri={props.uri} width={props.width} height={props.height} />;
  }
  return <FotoConGestosInterno {...props} />;
}

/**
 * Visor de fotos a pantalla completa, reutilizable en toda la app: pellizcar
 * para hacer zoom, doble tap, deslizar entre fotos (deshabilitado mientras
 * alguna está ampliada) y deslizar hacia abajo para cerrar.
 */
export function PhotoViewer({ visible, photos, initialIndex = 0, onClose }) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const [indiceActivo, setIndiceActivo] = useState(initialIndex);
  const [conZoom, setConZoom] = useState(false);

  useEffect(() => {
    if (visible) {
      setIndiceActivo(initialIndex);
      setConZoom(false);
    }
  }, [visible, initialIndex]);

  const fotos = photos || [];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.overlay}>
        <TouchableOpacity
          style={[styles.cerrar, { top: insets.top + 12 }]}
          onPress={onClose}
          hitSlop={theme.control.hitSlop}
          accessibilityRole="button"
          accessibilityLabel="Cerrar"
        >
          <Icon name="close" size={20} color={colors.textWhite} />
        </TouchableOpacity>

        <ScrollView
          key={`visor-${initialIndex}`}
          horizontal
          pagingEnabled
          scrollEnabled={!conZoom}
          showsHorizontalScrollIndicator={false}
          contentOffset={{ x: initialIndex * width, y: 0 }}
          onMomentumScrollEnd={(e) => setIndiceActivo(Math.round(e.nativeEvent.contentOffset.x / width))}
        >
          {fotos.map((uri, i) => (
            <FotoConGestos
              key={uri + i}
              uri={uri}
              width={width}
              height={height}
              onZoomChange={setConZoom}
              onDismiss={onClose}
            />
          ))}
        </ScrollView>

        {fotos.length > 1 && (
          <View style={styles.dots}>
            {fotos.map((_, i) => (
              <View key={i} style={[styles.dot, i === indiceActivo ? styles.dotOn : styles.dotOff]} />
            ))}
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: colors.primary900 },
  cerrar: {
    position: "absolute",
    right: theme.spacing.screen,
    zIndex: 1,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(255,255,255,0.16)",
    alignItems: "center",
    justifyContent: "center",
  },
  slide: { alignItems: "center", justifyContent: "center" },
  imagen: { width: "100%", height: "100%" },
  dots: { position: "absolute", bottom: 28, left: 0, right: 0, flexDirection: "row", justifyContent: "center", gap: 6 },
  dot: { height: 6, borderRadius: 999 },
  dotOn: { width: 20, backgroundColor: "#FFFFFF" },
  dotOff: { width: 6, backgroundColor: "rgba(255,255,255,0.6)" },
});
