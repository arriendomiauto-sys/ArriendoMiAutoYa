import React, { useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  StatusBar,
  Animated,
} from "react-native";
import { colors } from "../../theme/colors";
import { theme } from "../../theme/tokens";
import { BrandLogo } from "../../components/BrandLogo";

/**
 * `duracionMs` se acorta en los arranques siguientes al primero: la marca ya
 * se vio y alargar cada apertura de la app no aporta nada.
 */
export function SplashScreen({ onFinish, duracionMs = 1800 }) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onFinish();
    }, duracionMs);
    return () => clearTimeout(timer);
  }, [duracionMs]);

  // La marca entra con un pequeño respiro (opacidad + escala) en vez de
  // aparecer de golpe: es lo primero que ve alguien que recién abre la app,
  // y un salto seco ahí se siente más a error de carga que a intención.
  const entrada = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(entrada, { toValue: 1, duration: 500, useNativeDriver: true }).start();
  }, [entrada]);
  const estiloEntrada = {
    opacity: entrada,
    transform: [{ scale: entrada.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] }) }],
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Center Brand Identity (Pantalla 01) */}
      <Animated.View style={[styles.centerContent, estiloEntrada]}>
        {/* Logo oficial */}
        <View style={styles.logoBox}>
          <BrandLogo size={96} />
        </View>

        <View style={styles.brandTextBox}>
          <Text style={styles.brandTitle}>Arriendo Mi Auto Ya</Text>
          <Text style={styles.brandTagline}>Autos de personas, no de mostrador</Text>
        </View>
      </Animated.View>

      {/* Bottom Spinner */}
      <View style={styles.footerBox}>
        <ActivityIndicator size="small" color={colors.textWhite} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.primary,
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 48,
    paddingHorizontal: theme.spacing.xxl,
  },
  centerContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: theme.spacing.xxl,
  },
  logoBox: {
    width: 120,
    height: 90,
    alignItems: "center",
    justifyContent: "center",
  },
  brandTextBox: {
    alignItems: "center",
    gap: 6,
  },
  brandTitle: {
    ...theme.typography.display,
    color: colors.textWhite,
  },
  brandTagline: {
    ...theme.typography.bodyStrong,
    fontWeight: "400",
    color: colors.accent300,
  },
  footerBox: {
    height: 48,
    justifyContent: "center",
    alignItems: "center",
  },
});
