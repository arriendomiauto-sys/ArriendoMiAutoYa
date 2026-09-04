import React, { useState, useEffect, useCallback } from "react";
import { View, Text, StyleSheet, StatusBar, TouchableOpacity } from "react-native";
import { colors } from "../theme/colors";
import { theme } from "../theme/tokens";
import { Icon } from "../components/Icon";
import { Button } from "../components/ui";

export function BiometricLockScreen({ onIntentarDesbloquear, onLogout }) {
  const [verificando, setVerificando] = useState(false);
  const [fallo, setFallo] = useState(false);

  const intentar = useCallback(async () => {
    setVerificando(true);
    setFallo(false);
    const ok = await onIntentarDesbloquear();
    setVerificando(false);
    if (!ok) setFallo(true);
  }, [onIntentarDesbloquear]);

  // Se ofrece el desbloqueo de inmediato al aparecer esta pantalla — no
  // hace falta que la persona toque un botón primero para que salga el
  // prompt nativo de Face ID/huella.
  useEffect(() => {
    intentar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <View style={styles.iconCircle}>
        <Icon name="shield" size={40} color={colors.accent} />
      </View>
      <Text style={styles.title}>App bloqueada</Text>
      <Text style={styles.subtitle}>Confirma tu identidad para continuar.</Text>
      {fallo && (
        <Text style={styles.errorText}>No se pudo verificar tu identidad. Inténtalo de nuevo.</Text>
      )}
      <Button
        label={verificando ? "Verificando…" : "Desbloquear"}
        onPress={intentar}
        loading={verificando}
        tone="dark"
        style={{ marginTop: theme.spacing.lg }}
      />
      {onLogout ? (
        <TouchableOpacity onPress={onLogout} hitSlop={theme.control.hitSlop} style={{ marginTop: theme.spacing.lg }}>
          <Text style={styles.logoutText}>Cerrar sesión</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.darkBg,
    alignItems: "center",
    justifyContent: "center",
    padding: theme.spacing.xxl,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.darkCardSubtle,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: theme.spacing.lg,
  },
  title: { fontSize: 20, fontWeight: "700", color: colors.textWhite },
  subtitle: { fontSize: 14, color: colors.textSilver, marginTop: 6, textAlign: "center" },
  errorText: { fontSize: 13, color: colors.danger, marginTop: theme.spacing.md, textAlign: "center" },
  logoutText: { fontSize: 14, fontWeight: "600", color: colors.textSilver },
});
