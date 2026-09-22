import React, { useEffect, useRef } from "react";
import { Animated, Text } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "../theme/colors";
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
      className="absolute left-4 right-4 z-[999] flex-row items-center gap-2 bg-amber-50 border border-amber-200 rounded-2xl py-2.5 px-3.5 shadow-md"
      style={{
        top: insets.top + 8,
        opacity,
        transform: [{ translateY }],
      }}
      accessibilityLiveRegion="polite"
    >
      <Icon name="alert-triangle" size={16} color={colors.warningText} />
      <Text className="flex-1 text-[12.5px] font-semibold text-amber-900 leading-[17px]">
        Sin conexión a internet. Los cambios se sincronizarán al reconectar.
      </Text>
    </Animated.View>
  );
}
