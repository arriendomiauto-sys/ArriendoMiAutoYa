import React from "react";
import { View, Image, StyleSheet } from "react-native";

/**
 * Componente oficial BrandLogo - Arriendo Mi Auto Ya
 * Muestra el ícono/isotipo oficial de la aplicación de forma consistente.
 *
 * `zoom` > 1 amplía la imagen dentro del recuadro (que se recorta con
 * `overflow: hidden`), para logos cuyo PNG trae de fábrica un margen vacío
 * alrededor del isotipo: sin esto, ese margen se ve como un doble marco.
 */
export function BrandLogo({ size = 56, style, source, zoom = 1, ...props }) {
  const borderRadius = Math.round(size * 0.22);
  const imageSize = Math.round(size * zoom);
  return (
    <View style={[styles.logo, { width: size, height: size, borderRadius }]}>
      <Image
        source={source || require("../assets/logo.png")}
        style={[{ width: imageSize, height: imageSize }, style]}
        resizeMode="contain"
        accessibilityRole="image"
        accessibilityLabel="Logo oficial Arriendo Mi Auto Ya"
        {...props}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  logo: {
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
});
