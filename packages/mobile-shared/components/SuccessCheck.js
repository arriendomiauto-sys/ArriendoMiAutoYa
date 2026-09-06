import React, { useEffect, useRef } from "react";
import { View, Text, StyleSheet, Animated, Easing } from "react-native";
import { colors } from "../theme/colors";
import { theme } from "../theme/tokens";
import { Icon } from "./Icon";

/**
 * Círculo de éxito animado: aparece con un "pop" (spring) y un anillo que se
 * expande y se desvanece. Reemplaza al check estático que se mostraba al
 * cerrar la entrega/devolución y se usa también en el destello de
 * confirmación tras verificar el código QR y la identidad.
 *
 * Usa el `Animated` del core de React Native (como SwitchingScreen), sin
 * dependencias nuevas.
 */
export function SuccessCheck({ size = 72, iconSize = 36, style }) {
  const escala = useRef(new Animated.Value(0)).current;
  const anillo = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    escala.setValue(0);
    anillo.setValue(0);
    Animated.parallel([
      Animated.spring(escala, {
        toValue: 1,
        friction: 5,
        tension: 140,
        useNativeDriver: true,
      }),
      Animated.timing(anillo, {
        toValue: 1,
        duration: 620,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start();
  }, [escala, anillo]);

  return (
    <View style={[{ width: size, height: size, alignItems: "center", justifyContent: "center" }, style]}>
      <Animated.View
        pointerEvents="none"
        style={[
          styles.anillo,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            opacity: anillo.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] }),
            transform: [{ scale: anillo.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1.6] }) }],
          },
        ]}
      />
      <Animated.View
        style={[
          styles.circulo,
          { width: size, height: size, borderRadius: size / 2, transform: [{ scale: escala }] },
        ]}
      >
        <Icon name="check" size={iconSize} color={colors.accent700} />
      </Animated.View>
    </View>
  );
}

/**
 * Destello de confirmación a pantalla completa, no bloqueante: se dibuja
 * encima de la pantalla que sigue (que ya está montada abajo) y se retira
 * solo tras `duracion` ms llamando a `onDone`.
 */
export function SuccessFlash({ label, duracion = 1100, onDone }) {
  const opacidad = useRef(new Animated.Value(0)).current;
  const vivo = useRef(true);
  // `onDone` suele llegar como función inline (cambia en cada render del
  // padre): se guarda en un ref para no reiniciar el temporizador.
  const alTerminar = useRef(onDone);
  alTerminar.current = onDone;

  useEffect(() => {
    vivo.current = true;
    Animated.timing(opacidad, { toValue: 1, duration: 160, useNativeDriver: true }).start();
    const t = setTimeout(() => {
      Animated.timing(opacidad, { toValue: 0, duration: 220, useNativeDriver: true }).start(() => {
        if (vivo.current) alTerminar.current?.();
      });
    }, duracion);
    return () => {
      vivo.current = false;
      clearTimeout(t);
    };
  }, [opacidad, duracion]);

  return (
    <Animated.View
      style={[StyleSheet.absoluteFill, styles.flash, { opacity: opacidad }]}
      pointerEvents="none"
      accessibilityRole="alert"
      accessibilityLabel={label || "Verificado"}
    >
      <SuccessCheck size={84} iconSize={42} />
      {label ? <Text style={styles.flashLabel}>{label}</Text> : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  circulo: {
    backgroundColor: colors.accent100,
    alignItems: "center",
    justifyContent: "center",
  },
  anillo: {
    position: "absolute",
    borderWidth: 2,
    borderColor: colors.accent,
  },
  flash: {
    backgroundColor: "rgba(6,30,31,0.78)",
    alignItems: "center",
    justifyContent: "center",
    gap: theme.spacing.md,
    zIndex: 20,
  },
  flashLabel: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
});
