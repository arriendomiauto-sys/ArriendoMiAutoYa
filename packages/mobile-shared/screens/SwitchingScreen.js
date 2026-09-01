import React from "react";
import { View, Text, StyleSheet, ActivityIndicator } from "react-native";
import { colors } from "../theme/colors";
import { theme } from "../theme/tokens";
import { BrandLogo } from "../components/BrandLogo";

/**
 * Pantalla de transición. Se muestra mientras la app cambia de contexto y el
 * árbol de la experiencia destino todavía se está montando:
 *
 *   - cambio de rol (arrendatario ⇄ dueño) desde el perfil,
 *   - inicio y cierre de sesión (cambio de cuenta),
 *   - rehidratación de la sesión al abrir la app.
 *
 * Sin esto el cambio de modo desmontaba RenterApp y montaba OwnerApp en el
 * mismo frame: se veía un parpadeo de claro a oscuro con las pantallas a
 * medio pintar. Con `overlay` se dibuja encima del árbol nuevo, que así puede
 * montarse tapado y aparecer ya completo.
 *
 * El fondo sigue el modo DESTINO (oscuro para dueño, claro para arrendatario)
 * para que la transición ya entregue el color de la experiencia que viene.
 */
export function SwitchingScreen({
  mode = "renter",
  title = "Un momento…",
  subtitle,
  overlay = false,
}) {
  const dark = mode === "owner";
  const bg = dark ? colors.darkBg : colors.background;
  const text = dark ? colors.textWhite : colors.text;
  const muted = dark ? colors.darkTextMuted : colors.textMuted;

  return (
    <View
      style={[styles.container, { backgroundColor: bg }, overlay && StyleSheet.absoluteFillObject]}
      accessibilityRole="progressbar"
      accessibilityLabel={title}
    >
      <BrandLogo size={80} />
      <View style={styles.textBox}>
        <Text style={[styles.title, { color: text }]}>{title}</Text>
        {subtitle ? <Text style={[styles.subtitle, { color: muted }]}>{subtitle}</Text> : null}
      </View>
      <ActivityIndicator size="small" color={dark ? colors.accent : colors.primary} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: theme.spacing.xl,
    paddingHorizontal: theme.spacing.xxl,
  },
  textBox: { alignItems: "center", gap: 6 },
  title: { ...theme.typography.title, textAlign: "center" },
  subtitle: { fontSize: 14, lineHeight: 20, textAlign: "center" },
});
