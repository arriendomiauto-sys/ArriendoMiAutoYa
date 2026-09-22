import React, { useEffect, useRef } from "react";
import { View, Text, StatusBar, Animated, Easing, Platform } from "react-native";
import Svg, { Defs, LinearGradient, RadialGradient, Stop, Rect, Circle } from "react-native-svg";
import { BrandLogo } from "../../components/BrandLogo";

const TEXTOS = {
  renter: {
    eslogan: "Autos entre personas, cerca\nde ti",
    etiqueta: null,
  },
  owner: {
    eslogan: "Tu auto, trabajando por ti",
    etiqueta: "Para dueños",
  },
};

const ANCHO_BARRA = 140;
const ANCHO_TRAMO = 64;

/**
 * Pantalla de carga oficial de la app (mobile-renter y mobile-owner).
 * Implementa el diseño estético de alta fidelidad:
 * - Fondo degradado verde esmeralda / petróleo profundo con aros concéntricos sutiles.
 * - Barra superior tipo píldora (notch indicator).
 * - Caja de vidrio oscuro translúcido con el logo oficial propio de cada aplicación.
 * - Tipografía premium ("Arriendo Mi Auto Ya") con eslogan adaptativo por variante.
 * - Etiqueta "PARA DUEÑOS" en verde brillante para la app de dueño.
 * - Barra de progreso delgada animada con mensaje "Revisando tu sesión".
 */
export function SplashScreen({
  variante = "renter",
  mensaje = "Revisando tu sesión",
  logoSource,
  logoZoom,
  duracionMs,
  onFinish,
}) {
  const textos = TEXTOS[variante] || TEXTOS.renter;
  const zoomFinal = logoZoom || (variante === "owner" ? 1.33 : 1);

  // Animación de entrada suave (fade + ligera escala)
  const entrada = useRef(new Animated.Value(0)).current;
  // Animación continua de la barra de progreso
  const avance = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (typeof onFinish === "function" && typeof duracionMs === "number") {
      const timer = setTimeout(() => {
        onFinish();
      }, duracionMs);
      return () => clearTimeout(timer);
    }
  }, [duracionMs, onFinish]);

  useEffect(() => {
    Animated.timing(entrada, {
      toValue: 1,
      duration: 450,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();

    const barra = Animated.loop(
      Animated.timing(avance, {
        toValue: 1,
        duration: 1300,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      })
    );
    barra.start();
    return () => barra.stop();
  }, [entrada, avance]);

  const estiloEntrada = {
    opacity: entrada,
    transform: [
      {
        scale: entrada.interpolate({
          inputRange: [0, 1],
          outputRange: [0.94, 1],
        }),
      },
    ],
  };

  const estiloTramo = {
    transform: [
      {
        translateX: avance.interpolate({
          inputRange: [0, 1],
          outputRange: [-ANCHO_TRAMO, ANCHO_BARRA],
        }),
      },
    ],
  };

  return (
    <View
      className="flex-1 bg-[#061A19] justify-between items-center px-7"
      style={{
        paddingTop: Platform.OS === "android" ? 36 : 48,
        paddingBottom: Platform.OS === "android" ? 44 : 56,
      }}
      accessibilityRole="progressbar"
      accessibilityLabel={mensaje}
    >
      <StatusBar barStyle="light-content" backgroundColor="#061A19" translucent />

      {/* Fondo SVG con gradientes y círculos concéntricos de ambientación */}
      <View className="absolute inset-0" pointerEvents="none">
        <Svg width="100%" height="100%" viewBox="0 0 400 800" preserveAspectRatio="xMidYMid slice">
          <Defs>
            <LinearGradient id="bgGrad" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0%" stopColor="#0B2B28" />
              <Stop offset="45%" stopColor="#07201E" />
              <Stop offset="100%" stopColor="#041211" />
            </LinearGradient>
            <RadialGradient id="centerAura" cx="50%" cy="38%" r="65%">
              <Stop offset="0%" stopColor="#144A43" stopOpacity="0.45" />
              <Stop offset="45%" stopColor="#082220" stopOpacity="0.2" />
              <Stop offset="100%" stopColor="#061A19" stopOpacity="0" />
            </RadialGradient>
          </Defs>

          <Rect x="0" y="0" width="400" height="800" fill="url(#bgGrad)" />
          <Rect x="0" y="0" width="400" height="800" fill="url(#centerAura)" />

          {/* Círculos concéntricos envolventes centrados en el logo */}
          <Circle cx="200" cy="304" r="120" stroke="rgba(45, 212, 191, 0.11)" strokeWidth="1.2" fill="none" />
          <Circle cx="200" cy="304" r="200" stroke="rgba(45, 212, 191, 0.08)" strokeWidth="1.2" fill="none" />
          <Circle cx="200" cy="304" r="290" stroke="rgba(45, 212, 191, 0.06)" strokeWidth="1.2" fill="none" />
          <Circle cx="200" cy="304" r="390" stroke="rgba(45, 212, 191, 0.04)" strokeWidth="1.2" fill="none" />
        </Svg>
      </View>

      {/* Píldora superior / Notch bar */}
      <View className="w-[52px] h-[4.5px] rounded-[2.5px] bg-white/20 self-center" />

      {/* Contenido Central */}
      <Animated.View className="flex-1 justify-center items-center w-full" style={estiloEntrada}>
        {/* Caja del logo oficial de la app */}
        <View
          className="w-[84px] h-[84px] rounded-3xl bg-[rgba(10,42,38,0.7)] border-[1.2px] border-teal-400/20 items-center justify-center mb-6.5 shadow-lg"
          style={{ elevation: 6 }}
        >
          <BrandLogo
            size={74}
            source={logoSource}
            zoom={zoomFinal}
          />
        </View>

        {/* Textos de Marca */}
        <View className="items-center max-w-[300px]">
          <Text className="text-[25px] font-extrabold text-white text-center tracking-tight mb-2">Arriendo Mi Auto Ya</Text>
          <Text className="text-[15px] font-normal text-white/70 text-center leading-[22px]">{textos.eslogan}</Text>
          {textos.etiqueta ? <Text className="mt-2.5 text-xs tracking-widest uppercase font-extrabold text-[#2DD4BF] text-center">{textos.etiqueta}</Text> : null}
        </View>
      </Animated.View>

      {/* Pie de carga con barra delgada y mensaje */}
      <View className="items-center gap-3 min-h-[48px]">
        <View className="h-[3.5px] rounded-sm overflow-hidden bg-white/15" style={{ width: ANCHO_BARRA }}>
          <Animated.View className="h-[3.5px] rounded-sm bg-[#2DD4BF]" style={[{ width: ANCHO_TRAMO }, estiloTramo]} />
        </View>
        <Text className="text-[13px] font-normal text-white/65 text-center">{mensaje}</Text>
      </View>
    </View>
  );
}
