import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
} from "react-native";
import { colors } from "../../theme/colors";
import { Icon } from "../../components/Icon";

// El rol ya no se elige en esta pantalla (cada app -mobile-owner/mobile-renter-
// es un binario dedicado a un solo rol, fijo desde App.js). El copy reutiliza
// el texto de la tarjeta original correspondiente a cada rol.
const ROLE_COPY = {
  renter: {
    iconName: "key",
    title: "El auto del vecino, arrendado en minutos",
    subtitle:
      "Necesita un auto por unos días. Reserve con garantía protegida y entrega 100% digital.",
    cardIcon: "key",
    cardTitle: "Quiero arrendar",
    cardDesc: "Necesito un auto por unos días. Desde $22.000 el día.",
  },
  owner: {
    iconName: "car",
    title: "Su auto parado puede generar ingresos",
    subtitle:
      "Publique su vehículo y reciba pagos por arriendo directo en su cuenta bancaria.",
    cardIcon: "car",
    cardTitle: "Quiero publicar mi auto",
    cardDesc: "Tengo un auto parado y quiero que genere ingresos.",
  },
};

export function WelcomeScreen({ onNavigate, role = "renter" }) {
  const copy = ROLE_COPY[role] || ROLE_COPY.renter;

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
          <Text style={styles.title}>{copy.title}</Text>
          <Text style={styles.subtitle}>{copy.subtitle}</Text>
        </View>

        {/* Tarjeta única con el camino fijo del rol de esta app */}
        <View style={styles.cardsContainer}>
          <View style={[styles.optionCard, styles.optionCardSelected]}>
            <View style={styles.cardHeader}>
              <Icon
                name={copy.cardIcon}
                size={24}
                color={colors.primary}
                style={{ marginRight: 10 }}
              />
              <Text style={styles.cardTitle}>{copy.cardTitle}</Text>
            </View>
            <Text style={styles.cardDesc}>{copy.cardDesc}</Text>
          </View>
        </View>
      </View>

      {/* Bottom CTA */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={styles.primaryBtn}
          onPress={() => onNavigate("register")}
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
