import React, { useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  StatusBar,
} from "react-native";
import { colors } from "../../theme/colors";
import { Icon } from "../../components/Icon";

export function SplashScreen({ onFinish }) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onFinish();
    }, 1800);
    return () => clearTimeout(timer);
  }, []);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Center Brand Identity (Pantalla 01) */}
      <View style={styles.centerContent}>
        {/* Logo 02 del documento HTML */}
        <View style={styles.logoBox}>
          <Icon name="key" size={68} color="#FFFFFF" />
        </View>

        <View style={styles.brandTextBox}>
          <Text style={styles.brandTitle}>Arriendo Mi Auto Ya</Text>
          <Text style={styles.brandTagline}>Autos de personas, no de mostrador</Text>
        </View>
      </View>

      {/* Bottom Spinner */}
      <View style={styles.footerBox}>
        <ActivityIndicator size="small" color="#FFFFFF" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0F3D3E",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 48,
    paddingHorizontal: 24,
  },
  centerContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 28,
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
    fontSize: 28,
    fontWeight: "600",
    color: "#FFFFFF",
    letterSpacing: -0.5,
  },
  brandTagline: {
    fontSize: 15,
    color: "#92E3CB",
    fontWeight: "400",
  },
  footerBox: {
    height: 48,
    justifyContent: "center",
    alignItems: "center",
  },
});
