import React from "react";
import { View, Text, StyleSheet, Linking } from "react-native";
import { colors } from "../theme/colors";
import { theme } from "../theme/tokens";
import { Icon } from "../components/Icon";
import { Button } from "../components/ui";
import { BrandLogo } from "../components/BrandLogo";

/**
 * Pantalla bloqueante de actualización obligatoria. Sin `onBack`: no se
 * puede cerrar ni omitir — se muestra ANTES que cualquier otra pantalla,
 * incluido el login, cuando la versión instalada quedó por debajo de la
 * mínima soportada por el backend (ver useVersionCheck).
 */
export function ForceUpdateScreen({ urlStore }) {
  return (
    <View style={styles.container}>
      <BrandLogo size={72} />
      <View style={styles.iconTile}>
        <Icon name="refresh" size={28} color={colors.primary} />
      </View>
      <Text style={styles.title}>Nueva versión disponible</Text>
      <Text style={styles.subtitle}>
        Actualizamos la app con mejoras importantes. Necesitas instalar la última versión para
        seguir usándola.
      </Text>
      <Button
        label="Actualizar ahora"
        onPress={() => urlStore && Linking.openURL(urlStore)}
        disabled={!urlStore}
        style={styles.button}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: theme.spacing.lg,
    paddingHorizontal: theme.spacing.xxl,
    backgroundColor: colors.background,
  },
  iconTile: {
    width: 56,
    height: 56,
    borderRadius: theme.radius.card,
    backgroundColor: colors.accent100 || "rgba(47,191,155,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  title: { ...theme.typography.title, color: colors.text, textAlign: "center" },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.textMuted,
    textAlign: "center",
  },
  button: { marginTop: theme.spacing.md, width: "100%" },
});
