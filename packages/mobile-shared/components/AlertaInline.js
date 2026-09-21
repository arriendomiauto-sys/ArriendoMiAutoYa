import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { colors } from "../theme/colors";
import { theme } from "../theme/tokens";
import { Icon } from "./Icon";

/**
 * Aviso de error dentro de la pantalla (en vez de un `showAlert` modal): queda
 * a la vista mientras la persona corrige el formulario. Se anuncia como alerta
 * y lleva ícono, así que no depende solo del rojo para entenderse.
 */
export function AlertaInline({ titulo, mensaje, testID }) {
  return (
    <View testID={testID} style={styles.caja} accessibilityRole="alert">
      <Icon name="alert" size={16} color={colors.dangerText} />
      <View style={styles.textos}>
        <Text style={styles.titulo}>{titulo}</Text>
        <Text style={styles.mensaje}>{mensaje}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  caja: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: theme.spacing.sm,
    padding: theme.spacing.md,
    borderRadius: theme.radius.field,
    borderWidth: 1,
    borderColor: colors.dangerBorder,
    backgroundColor: colors.dangerBg,
  },
  textos: { flex: 1 },
  titulo: { ...theme.typography.callout, fontWeight: "700", color: colors.dangerText },
  mensaje: { ...theme.typography.callout, color: colors.dangerText },
});
