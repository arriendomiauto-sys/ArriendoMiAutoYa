import React from "react";
import { View, Text, StyleSheet, StatusBar } from "react-native";
import { colors } from "../../theme/colors";
import { theme } from "../../theme/tokens";
import { Icon } from "../../components/Icon";
import { Button } from "../../components/ui";

/**
 * Se muestra cuando no se pudo revisar la sesión por la red. Aclara que la
 * cuenta sigue guardada: no es un cierre de sesión, y por eso ofrece
 * reintentar en vez de mandar al login.
 */
export function SinConexionScreen({ onReintentar }) {
  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />

      <View style={styles.centro}>
        <View style={styles.icono}>
          <Icon name="wifi-off" size={32} color={colors.warningText} strokeWidth={2} />
        </View>
        <Text style={styles.titulo}>Sin conexión</Text>
        <Text style={styles.mensaje}>
          No pudimos revisar tu sesión. Tu cuenta sigue guardada en este teléfono.
        </Text>
      </View>

      <Button testID="btn-reintentar-sesion" label="Reintentar" onPress={onReintentar} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: "space-between",
    paddingHorizontal: theme.spacing.xxl,
    paddingVertical: 34,
  },
  centro: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  icono: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.warningBg,
    borderWidth: 1,
    borderColor: colors.warningBorder,
  },
  titulo: {
    ...theme.typography.title,
    color: colors.text,
    marginTop: 4,
  },
  mensaje: {
    ...theme.typography.callout,
    color: colors.textMuted,
    textAlign: "center",
    maxWidth: 280,
  },
});
