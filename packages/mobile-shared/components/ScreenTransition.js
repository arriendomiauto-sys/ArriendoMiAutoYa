import React from "react";
import { View } from "react-native";

let Animated = null;
let FadeInUp = null;
try {
  const reanimated = require("react-native-reanimated");
  Animated = reanimated.default || reanimated;
  FadeInUp = reanimated.FadeInUp;
} catch {
  // react-native-reanimated no disponible en binario nativo
}

/**
 * Envoltorio de transición para la pantalla activa. Esta app no usa
 * react-navigation (navega por estado, con un if-chain grande en cada
 * `renderContent()`), así que los cambios de pantalla no traían ninguna
 * animación: aparecían de golpe, sin la sensación fluida de una app nativa.
 *
 * Se usa envolviendo el resultado de `renderContent()` con una `key` que
 * cambie según qué pantalla está activa (ej. `capasAbiertas[0]?.nivel`): al
 * cambiar la key, React desmonta el `Animated.View` anterior y monta uno
 * nuevo, lo que dispara la animación de entrada.
 *
 * Es un fundido + deslizamiento leve hacia arriba, no un slide horizontal
 * completo: sin lógica de "hacia adelante" vs "atrás" (esta app no la
 * rastrea), un slide siempre-desde-la-derecha se vería invertido al volver.
 * El fundido se ve bien entrando y saliendo, sin importar la dirección.
 */
export function ScreenTransition({ children, style }) {
  if (!Animated) {
    return <View style={[{ flex: 1 }, style]}>{children}</View>;
  }
  return (
    <Animated.View
      // Offset chico a propósito (14px): el valor por defecto de FadeInUp
      // es un salto grande, más pensado para un ítem de lista que para una
      // pantalla completa -- acá solo se busca un roce sutil, no un salto.
      entering={FadeInUp.duration(220).withInitialValues({ transform: [{ translateY: 14 }] })}
      // Sin `exiting`: en Android, la animación de salida de Reanimated al
      // desmontar dejaba a veces la pantalla anterior como vista fantasma
      // congelada encima de la nueva (mismo bug que tenía el visor de fotos).
      style={[{ flex: 1 }, style]}
    >
      {children}
    </Animated.View>
  );
}
