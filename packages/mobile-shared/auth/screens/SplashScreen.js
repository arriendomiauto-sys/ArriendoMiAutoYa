import React, { useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  StatusBar,
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

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Center Brand Identity (Pantalla 01) */}
      <View style={styles.centerContent}>
        {/* Logo oficial */}
        <View style={styles.logoBox}>
          <BrandLogo size={96} />
        </View>

        <View style={styles.brandTextBox}>
          <Text style={styles.brandTitle}>Arriendo Mi Auto Ya</Text>
          <Text style={styles.brandTagline}>Autos de personas, no de mostrador</Text>
        </View>
      </View>

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
