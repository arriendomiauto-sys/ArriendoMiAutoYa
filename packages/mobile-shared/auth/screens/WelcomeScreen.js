import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, StatusBar } from "react-native";
import { colors } from "../../theme/colors";
import { theme } from "../../theme/tokens";
import { Icon } from "../../components/Icon";
import { BrandLogo } from "../../components/BrandLogo";
import { Button, Card, BottomBar } from "../../components/ui";

// La app es un solo binario con dos experiencias. Acá el usuario elige con
// cuál partir; después alterna entre modos desde su perfil.
const ROLE_OPTIONS = [
  {
    key: "renter",
    cardIcon: "key",
    cardTitle: "Quiero arrendar",
    cardDesc: "Necesito un auto por unos días. Desde $22.000 el día.",
  },
  {
    key: "owner",
    cardIcon: "car",
    cardTitle: "Quiero publicar mi auto",
    cardDesc: "Tengo un auto parado y quiero que genere ingresos.",
  },
];

export function WelcomeScreen({ onNavigate, onSelectRole, role = "renter" }) {
  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />

      <View style={styles.content}>
        <View style={styles.logoRow}>
          <BrandLogo size={52} />
        </View>

        <View style={styles.textBox}>
          <Text style={styles.title}>El auto del vecino, arrendado en minutos</Text>
          <Text style={styles.subtitle}>
            Publica tu auto o arrienda el de otra persona, con garantía protegida
            y entrega 100% digital. ¿Qué quieres hacer?
          </Text>
        </View>

        {/* Selección de rol: define el modo con el que arranca la app */}
        <View style={styles.cardsContainer}>
          {ROLE_OPTIONS.map((opt) => {
            const selected = role === opt.key;
            return (
              <TouchableOpacity
                key={opt.key}
                onPress={() => onSelectRole?.(opt.key)}
                activeOpacity={0.85}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
              >
                <Card
                  style={[styles.optionCard, selected && styles.optionCardSelected]}
                  elevated={selected}
                >
                  <View style={styles.cardHeader}>
                    <Icon name={opt.cardIcon} size={24} color={colors.primary} />
                    <Text style={styles.cardTitle}>{opt.cardTitle}</Text>
                  </View>
                  <Text style={styles.cardDesc}>{opt.cardDesc}</Text>
                </Card>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <BottomBar bordered={false} style={styles.bottomBar}>
        <Button label="Crear mi cuenta" onPress={() => onNavigate("register")} />

        <TouchableOpacity
          style={styles.loginLink}
          onPress={() => onNavigate("login")}
          activeOpacity={0.7}
        >
          <Text style={styles.loginLinkText}>
            Ya tengo cuenta <Text style={styles.loginHighlight}>Iniciar sesión</Text>
          </Text>
        </TouchableOpacity>
      </BottomBar>
    </View>
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
    paddingHorizontal: theme.spacing.xxl,
    paddingTop: theme.spacing.xxxl,
    gap: theme.spacing.xxl,
  },
  logoRow: {
    height: 48,
    justifyContent: "center",
  },
  textBox: {
    gap: theme.spacing.sm,
  },
  title: {
    ...theme.typography.display,
    color: colors.text,
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 25,
    color: colors.textMuted,
  },
  cardsContainer: {
    gap: theme.spacing.md,
    marginTop: theme.spacing.sm,
  },
  optionCard: {
    padding: theme.spacing.xl,
    gap: theme.spacing.sm,
  },
  optionCardSelected: {
    borderWidth: 1.5,
    borderColor: colors.primary,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
  },
  cardTitle: {
    ...theme.typography.heading,
    color: colors.text,
  },
  cardDesc: {
    ...theme.typography.body,
    color: colors.textMuted,
  },
  bottomBar: {
    paddingHorizontal: theme.spacing.xxl,
    backgroundColor: "transparent",
  },
  loginLink: {
    height: theme.control.heightSm,
    alignItems: "center",
    justifyContent: "center",
  },
  loginLinkText: {
    ...theme.typography.bodyStrong,
    fontWeight: "400",
    color: colors.textMuted,
  },
  loginHighlight: {
    color: colors.accent700,
    fontWeight: "600",
  },
});
