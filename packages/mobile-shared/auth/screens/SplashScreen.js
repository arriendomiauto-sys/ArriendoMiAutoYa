import React, { useEffect, useRef } from "react";
import { View, Text, StyleSheet, StatusBar, Animated, Easing, Platform } from "react-native";
import Svg, { Defs, LinearGradient, RadialGradient, Stop, Rect, Circle, Path } from "react-native-svg";
import { colors } from "../../theme/colors";

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
 * Ícono vectorial del auto oficial del diseño de la pantalla de carga.
 */
function CarSplashIcon({ size = 42, color = "#2DD4BF" }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 36 36" fill="none">
      {/* Techo y parabrisas */}
      <Path
        d="M9.5 14L12 7.5C12.3 6.6 13.2 6 14.2 6H21.8C22.8 6 23.7 6.6 24 7.5L26.5 14"
        stroke={color}
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Carrocería principal */}
      <Path
        d="M6 14H30C31.1 14 32 14.9 32 16V22C32 23.1 31.1 24 30 24H6C4.9 24 4 23.1 4 22V16C4 14.9 4.9 14 6 14Z"
        stroke={color}
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Faros */}
      <Path
        d="M8.5 19H12.5M23.5 19H27.5"
        stroke={color}
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      {/* Ruedas inferiores */}
      <Path
        d="M7.5 24V26.5C7.5 27.3 8.2 28 9 28H9.5C10.3 28 11 27.3 11 26.5V24M25 24V26.5C25 27.3 25.7 28 26.5 28H27C27.8 28 28.5 27.3 28.5 26.5V24"
        stroke={color}
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/**
 * Pantalla de carga oficial de la app (mobile-renter y mobile-owner).
 * Implementa el diseño estético de alta fidelidad:
 * - Fondo degradado verde esmeralda / petróleo profundo con aros concéntricos sutiles.
 * - Barra superior tipo píldora (notch indicator).
 * - Caja de vidrio oscuro translúcido con ícono frontal de auto en verde menta (#2DD4BF).
 * - Tipografía premium ("Arriendo Mi Auto Ya") con eslogan adaptativo por variante.
 * - Etiqueta "PARA DUEÑOS" en verde brillante para la app de dueño.
 * - Barra de progreso delgada animada con mensaje "Revisando tu sesión".
 */
export function SplashScreen({ variante = "renter", mensaje = "Revisando tu sesión" }) {
  const textos = TEXTOS[variante] || TEXTOS.renter;

  // Animación de entrada suave (fade + ligera escala)
  const entrada = useRef(new Animated.Value(0)).current;
  // Animación continua de la barra de progreso
  const avance = useRef(new Animated.Value(0)).current;

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
    <View style={styles.container} accessibilityRole="progressbar" accessibilityLabel={mensaje}>
      <StatusBar barStyle="light-content" backgroundColor="#061A19" translucent />

      {/* Fondo SVG con gradiente y aros concéntricos sutiles */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <Svg width="100%" height="100%" viewBox="0 0 400 800" preserveAspectRatio="none">
          <Defs>
            <LinearGradient id="bgGrad" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0%" stopColor="#0B2B28" />
              <Stop offset="28%" stopColor="#082220" />
              <Stop offset="65%" stopColor="#061A19" />
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
      <View style={styles.notchPill} />

      {/* Contenido Central */}
      <Animated.View style={[styles.centerContent, estiloEntrada]}>
        {/* Caja del ícono de auto */}
        <View style={styles.iconBox}>
          <CarSplashIcon size={40} color="#2DD4BF" />
        </View>

        {/* Textos de Marca */}
        <View style={styles.brandTextBox}>
          <Text style={styles.brandTitle}>Arriendo Mi Auto Ya</Text>
          <Text style={styles.brandTagline}>{textos.eslogan}</Text>
          {textos.etiqueta ? <Text style={styles.etiqueta}>{textos.etiqueta}</Text> : null}
        </View>
      </Animated.View>

      {/* Pie de carga con barra delgada y mensaje */}
      <View style={styles.footerBox}>
        <View style={styles.barra}>
          <Animated.View style={[styles.tramo, estiloTramo]} />
        </View>
        <Text style={styles.mensaje}>{mensaje}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#061A19",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: Platform.OS === "android" ? 36 : 48,
    paddingBottom: Platform.OS === "android" ? 44 : 56,
    paddingHorizontal: 28,
  },
  notchPill: {
    width: 52,
    height: 4.5,
    borderRadius: 2.5,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    alignSelf: "center",
  },
  centerContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    width: "100%",
  },
  iconBox: {
    width: 84,
    height: 84,
    borderRadius: 24,
    backgroundColor: "rgba(10, 42, 38, 0.7)",
    borderWidth: 1.2,
    borderColor: "rgba(45, 212, 191, 0.22)",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
    marginBottom: 26,
  },
  brandTextBox: {
    alignItems: "center",
    maxWidth: 300,
  },
  brandTitle: {
    fontSize: 25,
    fontWeight: "800",
    color: "#FFFFFF",
    textAlign: "center",
    letterSpacing: -0.3,
    marginBottom: 8,
  },
  brandTagline: {
    fontSize: 15,
    fontWeight: "400",
    color: "rgba(255, 255, 255, 0.72)",
    textAlign: "center",
    lineHeight: 22,
  },
  etiqueta: {
    marginTop: 10,
    fontSize: 12,
    letterSpacing: 2,
    textTransform: "uppercase",
    fontWeight: "800",
    color: "#2DD4BF",
    textAlign: "center",
  },
  footerBox: {
    alignItems: "center",
    gap: 12,
    minHeight: 48,
  },
  barra: {
    width: ANCHO_BARRA,
    height: 3.5,
    borderRadius: 2,
    overflow: "hidden",
    backgroundColor: "rgba(255, 255, 255, 0.14)",
  },
  tramo: {
    width: ANCHO_TRAMO,
    height: 3.5,
    borderRadius: 2,
    backgroundColor: "#2DD4BF",
  },
  mensaje: {
    fontSize: 13,
    fontWeight: "400",
    color: "rgba(255, 255, 255, 0.65)",
    textAlign: "center",
  },
});

