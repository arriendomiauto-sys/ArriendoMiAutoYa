import React, { useEffect, useRef } from "react";
import { View, Text, Animated, Easing } from "react-native";
import { colors } from "../theme/colors";
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
export function SuccessCheck({ size = 72, iconSize = 36, style, className = "" }) {
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
    <View
      className={`items-center justify-center ${className}`}
      style={[{ width: size, height: size }, style]}
    >
      <Animated.View
        pointerEvents="none"
        className="absolute border-2 border-accent"
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          opacity: anillo.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] }),
          transform: [{ scale: anillo.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1.6] }) }],
        }}
      />
      <Animated.View
        className="bg-accent-100 items-center justify-center"
        style={{ width: size, height: size, borderRadius: size / 2, transform: [{ scale: escala }] }}
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
      if (!vivo.current) return;
      try {
        Animated?.timing(opacidad, { toValue: 0, duration: 220, useNativeDriver: true }).start(() => {
          if (vivo.current) alTerminar.current?.();
        });
      } catch {
        // Ignora fallos si el entorno se desmontó durante el timer
      }
    }, duracion);
    return () => {
      vivo.current = false;
      clearTimeout(t);
    };
  }, [opacidad, duracion]);

  return (
    <Animated.View
      className="absolute inset-0 bg-[#061e1f]/[0.78] items-center justify-center gap-3 z-20"
      style={{ opacity: opacidad }}
      pointerEvents="none"
      accessibilityRole="alert"
      accessibilityLabel={label || "Verificado"}
    >
      <SuccessCheck size={84} iconSize={42} />
      {label ? <Text className="text-white text-base font-bold tracking-wide">{label}</Text> : null}
    </Animated.View>
  );
}
