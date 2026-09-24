import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { View, Text, TouchableOpacity, ScrollView, useWindowDimensions, Image } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
let GestureDetector = null;
let Gesture = null;
// El <Modal> de React Native monta su contenido en una jerarquía nativa aparte
// (una ventana/actividad propia), fuera del árbol que cubre el
// GestureHandlerRootView de la raíz de la app -- por eso los gestos de
// pellizco/arrastre fallaban ahí, incluso envolviendo el propio <Modal> con
// OTRO GestureHandlerRootView (Android en particular nunca reenvía bien los
// touches de un Dialog nativo al recognizer de gesture-handler del árbol
// principal). La solución real no es otro parche sobre el <Modal>: es no
// usar <Modal> -- el visor ahora es un overlay absoluto montado una sola vez
// cerca de la raíz de cada app (ver PhotoViewerProvider en App.js), dentro
// del MISMO GestureHandlerRootView que ya cubre el resto de la app.
//
// Justamente por eso el overlay NO debe traer su propio GestureHandlerRootView
// anidado (había uno acá, leftover de cuando SÍ vivía dentro de un <Modal> y
// se probó, sin éxito, taparlo con un segundo root). react-native-gesture-
// handler documenta un solo root por app: Android intercepta el touch
// dispatch a nivel de ese ViewGroup, y dos anidados compiten por el mismo
// stream de eventos -- gestos de un solo puntero (tap, pan) suelen colarse
// igual, pero el pellizco (2 punteros simultáneos) es justo el que se pierde
// entre medio. El único GestureHandlerRootView válido es el de App.js.
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
let FadeIn = null;
let FadeOut = null;

try {
  const reanimated = require("react-native-reanimated");
  Animated = reanimated.default || reanimated;
  useSharedValue = reanimated.useSharedValue;
  useAnimatedStyle = reanimated.useAnimatedStyle;
  withTiming = reanimated.withTiming;
  runOnJS = reanimated.runOnJS;
  FadeIn = reanimated.FadeIn;
  FadeOut = reanimated.FadeOut;
} catch {
  // react-native-reanimated / NativeWorklets no disponible en binario nativo
}

// Sin Modal, el overlay entra/sale con un mount/unmount seco a menos que se
// anime a propósito -- FadeIn/FadeOut de Reanimated reemplazan el
// animationType="fade" que traía el <Modal> anterior. Si reanimated no está
// disponible, cae a View normal (aparece/desaparece sin transición, pero
// sigue siendo funcional).
const OverlayWrapper = Animated ? Animated.View : View;

import { colors } from "../theme/colors";
import { Icon } from "./Icon";

const NIVEL_ZOOM_DOBLE_TAP = 2.5;
const ESCALA_MAXIMA = 4;
const UMBRAL_DESCARTAR = 120;
const TAMANO_MINIATURA = 44;

function RenderFoto({ uri, style, resizeMode = "contain" }) {
  return <Image source={{ uri }} style={style} resizeMode={resizeMode} />;
}

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

  const restaurar = useCallback(() => {
    escala.value = withTiming(1);
    escalaGuardada.value = 1;
    trasladoX.value = withTiming(0);
    trasladoY.value = withTiming(0);
    trasladoXGuardado.value = 0;
    trasladoYGuardado.value = 0;
  }, [escala, escalaGuardada, trasladoX, trasladoY, trasladoXGuardado, trasladoYGuardado]);

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

function FotoSimple({ uri, width, height }) {
  return (
    <View className="items-center justify-center overflow-hidden" style={{ width, height }}>
      <RenderFoto uri={uri} style={{ width: "100%", height: "100%" }} resizeMode="contain" />
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
 * Visor de fotos a pantalla completa: pellizcar para hacer zoom (con doble
 * tap como atajo a un nivel fijo), deslizar entre fotos (deshabilitado
 * mientras una foto está ampliada), tira de miniaturas para saltar directo a
 * una foto, y deslizar hacia abajo para cerrar. Se monta como overlay
 * absoluto -- ver PhotoViewerProvider más abajo -- nunca como <Modal>.
 */
function PhotoViewerOverlay({ photos, initialIndex = 0, onClose }) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const [indiceActivo, setIndiceActivo] = useState(initialIndex);
  const [conZoom, setConZoom] = useState(false);
  const [mostrarPista, setMostrarPista] = useState(true);
  const scrollRef = useRef(null);
  const filmstripRef = useRef(null);

  const fotos = photos || [];

  useEffect(() => {
    const id = setTimeout(() => setMostrarPista(false), 1800);
    return () => clearTimeout(id);
  }, []);

  const irAFoto = (i) => {
    setConZoom(false);
    setIndiceActivo(i);
    scrollRef.current?.scrollTo({ x: i * width, animated: true });
    filmstripRef.current?.scrollTo({
      x: Math.max(0, i * (TAMANO_MINIATURA + 8) - width / 2 + TAMANO_MINIATURA / 2),
      animated: true,
    });
  };

  return (
    <OverlayWrapper
      className="absolute inset-0 bg-primary-950 z-[1000] [elevation:1000]"
      {...(FadeIn ? { entering: FadeIn.duration(180), exiting: FadeOut.duration(150) } : null)}
    >
      <View className="flex-1 bg-primary-950">
        {/* Botón cerrar */}
        <TouchableOpacity
          className="absolute top-3 right-4 z-20 w-[38px] h-[38px] rounded-full bg-white/15 items-center justify-center"
          onPress={onClose}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityRole="button"
          accessibilityLabel="Cerrar visor"
        >
          <Icon name="close" size={20} color={colors.textWhite} />
        </TouchableOpacity>

        {/* Contador de foto activa (reemplaza a las píldoras de zoom: acá el
            zoom es solo con los dedos, no hay botón para eso). */}
        {fotos.length > 1 && (
          <View className="absolute top-3 z-20 self-center bg-[#061e1f]/80 rounded-full px-3 py-1.5 border border-white/20">
            <Text className="text-xs font-bold text-white">
              {indiceActivo + 1} / {fotos.length}
            </Text>
          </View>
        )}

        {/* Pista de pellizco: aparece un instante al abrir y desaparece sola. */}
        {mostrarPista && fotos.length > 0 && (
          <View
            className="absolute self-center z-20"
            style={{ bottom: insets.bottom + (fotos.length > 1 ? 96 : 28) }}
            pointerEvents="none"
          >
            <View className="bg-black/60 rounded-full px-3 py-1.5">
              <Text className="text-white text-xs font-medium">Pellizca la foto para acercar</Text>
            </View>
          </View>
        )}

        <ScrollView
          ref={scrollRef}
          className="flex-1"
          horizontal
          pagingEnabled
          scrollEnabled={!conZoom}
          showsHorizontalScrollIndicator={false}
          contentOffset={{ x: initialIndex * width, y: 0 }}
          onMomentumScrollEnd={(e) => {
            const idx = Math.round(e.nativeEvent.contentOffset.x / width);
            setIndiceActivo(idx);
            setConZoom(false);
            filmstripRef.current?.scrollTo({
              x: Math.max(0, idx * (TAMANO_MINIATURA + 8) - width / 2 + TAMANO_MINIATURA / 2),
              animated: true,
            });
          }}
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

        {/* Tira de miniaturas: salta directo a cualquier foto sin tener que deslizar una por una. */}
        {fotos.length > 1 && (
          <View className="absolute left-0 right-0 z-10" style={{ bottom: insets.bottom + 10 }}>
            <ScrollView
              ref={filmstripRef}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
            >
              {fotos.map((uri, i) => {
                const activa = i === indiceActivo;
                return (
                  <TouchableOpacity
                    key={uri + i}
                    onPress={() => irAFoto(i)}
                    activeOpacity={0.85}
                    accessibilityRole="button"
                    accessibilityLabel={`Ver foto ${i + 1} de ${fotos.length}`}
                  >
                    <Image
                      source={{ uri }}
                      className={`w-11 h-11 rounded-[10px] ${
                        activa ? "opacity-100 border-2 border-accent" : "opacity-50 border-0"
                      }`}
                      resizeMode="cover"
                    />
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}
      </View>
    </OverlayWrapper>
  );
}

const PhotoViewerContext = createContext(null);

/**
 * Se monta UNA vez cerca de la raíz de cada app (dentro del
 * GestureHandlerRootView y del SafeAreaView de App.js), nunca por pantalla.
 * Cualquier pantalla pide abrir el visor con `usePhotoViewer()` en vez de
 * manejar su propio estado de visibilidad + <PhotoViewer visible .../>, así
 * el overlay siempre cubre la pantalla completa de verdad -- ya no depende
 * de si quien lo invoca está anidado dentro de un ScrollView o una card con
 * `overflow` recortado.
 */
export function PhotoViewerProvider({ children }) {
  const [visor, setVisor] = useState(null); // { photos, initialIndex } | null

  const abrir = useCallback((photos, initialIndex = 0) => {
    if (!photos?.length) return;
    setVisor({ photos, initialIndex });
  }, []);

  const cerrar = useCallback(() => setVisor(null), []);

  return (
    <PhotoViewerContext.Provider value={abrir}>
      <View className="flex-1">
        {children}
        {visor && (
          <PhotoViewerOverlay photos={visor.photos} initialIndex={visor.initialIndex} onClose={cerrar} />
        )}
      </View>
    </PhotoViewerContext.Provider>
  );
}

/** Devuelve `abrirVisor(fotos, indiceInicial?)`. Requiere `<PhotoViewerProvider>` en la raíz. */
export function usePhotoViewer() {
  const abrir = useContext(PhotoViewerContext);
  if (!abrir) {
    throw new Error("usePhotoViewer() debe usarse dentro de <PhotoViewerProvider>");
  }
  return abrir;
}
