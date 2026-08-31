import React from "react";
import { Image, StyleSheet } from "react-native";

/**
 * Componente oficial BrandLogo - Arriendo Mi Auto Ya
 * Muestra el ícono/isotipo oficial de la aplicación de forma consistente.
 */
export function BrandLogo({ size = 56, style, ...props }) {
  const borderRadius = Math.round(size * 0.22);
  return (
    <Image
      source={require("../assets/logo.png")}
      style={[
        styles.logo,
        {
          width: size,
          height: size,
          borderRadius,
        },
        style,
      ]}
      resizeMode="contain"
      accessibilityRole="image"
      accessibilityLabel="Logo oficial Arriendo Mi Auto Ya"
      {...props}
    />
  );
}

const styles = StyleSheet.create({
  logo: {
    overflow: "hidden",
  },
});
