import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet } from "react-native";
import { colors } from "../theme/colors";

/**
 * Placeholder animado estilo YouTube (skeleton que "rebota": pulsa la opacidad
 * entre ~0.45 y 1). Un mismo componente sirve para siluetar una imagen (foto
 * del auto cargando) o una barra de texto (líneas de un card en carga), solo
 * cambiando el alto/ancho/radio que se pase por `style`.
 *
 * Se usa con `useNativeDriver`, así que la animación corre en el hilo de UI y
 * no le roba frames al JS.
 */
export function Skeleton({ style, testID }) {
  const pulso = useRef(new Animated.Value(0.45)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulso, {
          toValue: 1,
          duration: 650,
          useNativeDriver: true,
        }),
        Animated.timing(pulso, {
          toValue: 0.45,
          duration: 650,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulso]);

  return (
    <Animated.View
      testID={testID}
      style={[styles.skeleton, { opacity: pulso }, style]}
    />
  );
}

const styles = StyleSheet.create({
  skeleton: {
    backgroundColor: colors.skeleton,
    borderRadius: 8,
  },
});