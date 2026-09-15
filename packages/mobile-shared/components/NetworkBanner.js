import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, Text } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "../theme/colors";
import { theme } from "../theme/tokens";
import { Icon } from "./Icon";

/**
 * Aviso flotante global de "sin conexión". Se monta una sola vez a nivel
 * raíz (App.js), por encima de RenterApp/OwnerApp, para que ningún botón se
 * quede cargando en bucle sin que la persona sepa por qué.
 */
export function NetworkBanner({ visible }) {
  const insets = useSafeAreaInsets();
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-12)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: visible ? 1 : 0,
        duration: 220,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: visible ? 0 : -12,
        duration: 220,
        useNativeDriver: true,
      }),
    ]).start();
  }, [visible, opacity, translateY]);

  // Sigue montado durante el fade-out (pointerEvents evita que tape toques
  // cuando ya está invisible pero la animación no terminó).
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.banner,
        {
          top: insets.top + theme.spacing.sm,
          opacity,
          transform: [{ translateY }],
        },
      ]}
      accessibilityLiveRegion="polite"
    >
      <Icon name="alert-triangle" size={16} color={colors.warningText} />
      <Text style={styles.text}>Sin conexión a internet. Los cambios se sincronizarán al reconectar.</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: "absolute",
    left: theme.spacing.lg,
    right: theme.spacing.lg,
    zIndex: 999,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.warningBg,
    borderWidth: 1,
    borderColor: colors.warningBorder,
    borderRadius: theme.radius.card,
    paddingVertical: 10,
    paddingHorizontal: 14,
    ...theme.shadow.md,
  },
  text: {
    flex: 1,
    fontSize: 12.5,
    fontWeight: "600",
    color: colors.warningText,
    lineHeight: 17,
  },
});
