import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
} from "react-native";
import { colors } from "../../../theme/colors";
import { useApp } from "../../../context/AppContext";
import { Icon } from "../../../shared/components/Icon";

export function WelcomeScreen({ onNavigate }) {
  const { setMode } = useApp();
  const [selectedPath, setSelectedPath] = useState("arrendar"); // 'arrendar' | 'publicar'

  const handleProceed = () => {
    if (selectedPath === "publicar") {
      setMode("conductor");
    } else {
      setMode("pasajero");
    }
    onNavigate("register");
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />

      {/* Main Content (Pantalla 03) */}
      <View style={styles.content}>
        {/* Brand Logo #02 */}
        <View style={styles.logoRow}>
          <Icon name="key" size={48} color={colors.primary} />
        </View>

        <View style={styles.textBox}>
          <Text style={styles.title}>¿Qué lo trae por acá?</Text>
          <Text style={styles.subtitle}>
            Puede hacer las dos cosas con la misma cuenta. Elija por dónde empezar.
          </Text>
        </View>

        {/* 2 Path Cards */}
        <View style={styles.cardsContainer}>
          {/* Card 1: Quiero arrendar */}
          <TouchableOpacity
            style={[
              styles.optionCard,
              selectedPath === "arrendar" && styles.optionCardSelected,
            ]}
            onPress={() => setSelectedPath("arrendar")}
            activeOpacity={0.9}
          >
            <View style={styles.cardHeader}>
              <Icon name="key" size={24} color={colors.primary} style={{ marginRight: 10 }} />
              <Text style={styles.cardTitle}>Quiero arrendar</Text>
            </View>
            <Text style={styles.cardDesc}>
              Necesito un auto por unos días. Desde $22.000 el día.
            </Text>
          </TouchableOpacity>

          {/* Card 2: Quiero publicar mi auto */}
          <TouchableOpacity
            style={[
              styles.optionCard,
              selectedPath === "publicar" && styles.optionCardSelected,
            ]}
            onPress={() => setSelectedPath("publicar")}
            activeOpacity={0.9}
          >
            <View style={styles.cardHeader}>
              <Icon name="car" size={24} color={colors.primary} style={{ marginRight: 10 }} />
              <Text style={styles.cardTitle}>Quiero publicar mi auto</Text>
            </View>
            <Text style={styles.cardDesc}>
              Tengo un auto parado y quiero que genere ingresos.
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Bottom CTA */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={styles.primaryBtn}
          onPress={handleProceed}
          activeOpacity={0.85}
        >
          <Text style={styles.primaryBtnText}>Crear mi cuenta</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.loginLink}
          onPress={() => onNavigate("login")}
          activeOpacity={0.7}
        >
          <Text style={styles.loginLinkText}>
            Ya tengo cuenta{" "}
            <Text style={styles.loginHighlight}>Iniciar sesión</Text>
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: "space-between",
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 32,
    gap: 24,
  },
  logoRow: {
    width: 64,
    height: 48,
    justifyContent: "center",
  },
  textBox: {
    gap: 10,
  },
  title: {
    fontSize: 28,
    fontWeight: "600",
    letterSpacing: -0.4,
    lineHeight: 33,
    color: colors.text,
  },
  subtitle: {
    fontSize: 16,
    color: colors.textMuted,
    lineHeight: 25,
  },
  cardsContainer: {
    gap: 14,
    marginTop: 8,
  },
  optionCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 20,
    gap: 8,
  },
  optionCardSelected: {
    borderWidth: 1.5,
    borderColor: colors.primary,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  cardTitle: {
    fontSize: 19,
    fontWeight: "600",
    color: colors.text,
  },
  cardDesc: {
    fontSize: 15,
    color: colors.textMuted,
    lineHeight: 22,
  },
  bottomBar: {
    paddingHorizontal: 24,
    paddingBottom: 34,
    paddingTop: 16,
    gap: 10,
  },
  primaryBtn: {
    height: 56,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryBtnText: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "600",
  },
  loginLink: {
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  loginLinkText: {
    fontSize: 15,
    color: colors.textMuted,
  },
  loginHighlight: {
    color: colors.accent700,
    fontWeight: "600",
  },
});
