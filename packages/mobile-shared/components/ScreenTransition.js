import React, { useEffect, useRef } from "react";
import { View } from "react-native";

let Animated = null;
let FadeInUp = null;
let FadeInRight = null;
let FadeInLeft = null;
let Easing = null;
try {
  const reanimated = require("react-native-reanimated");
  Animated = reanimated.default || reanimated;
  FadeInUp = reanimated.FadeInUp;
  FadeInRight = reanimated.FadeInRight;
  FadeInLeft = reanimated.FadeInLeft;
  Easing = reanimated.Easing;
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
 * `direccion` dice de dónde entra la pantalla nueva:
 *  - "adelante": se abrió algo encima (detalle, pago, ajustes) -> entra
 *    deslizándose corto desde la derecha, como un push nativo.
 *  - "atras": se cerró la capa de arriba -> entra desde la izquierda.
 *  - "cambio" (default): cambio lateral, p. ej. de pestaña -> fundido con un
 *    roce leve hacia arriba.
 * Los desplazamientos son cortos (14-24 px) a propósito: un slide de pantalla
 * completa sin la pantalla anterior saliendo al mismo tiempo se ve como un
 * salto, no como un movimiento.
 */
function animacionDeEntrada(direccion) {
  const curva = Easing?.out ? Easing.out(Easing.cubic) : undefined;
  const conCurva = (anim) => (curva && typeof anim.easing === "function" ? anim.easing(curva) : anim);
  if (direccion === "adelante" && FadeInRight) {
    return conCurva(FadeInRight.duration(240)).withInitialValues({ transform: [{ translateX: 24 }] });
  }
  if (direccion === "atras" && FadeInLeft) {
    return conCurva(FadeInLeft.duration(240)).withInitialValues({ transform: [{ translateX: -24 }] });
  }
  // Offset chico a propósito (14px): el valor por defecto de FadeInUp es un
  // salto grande, más pensado para un ítem de lista que para una pantalla.
  return conCurva(FadeInUp.duration(220)).withInitialValues({ transform: [{ translateY: 14 }] });
}

/**
 * Deduce la `direccion` de ScreenTransition comparando con el render anterior.
 * `profundidad`: cuántas capas hay abiertas (más = se abrió algo encima).
 * `grupo`: si cambia (p. ej. la pestaña), es un cambio lateral, no un avance.
 */
export function useDireccionTransicion(profundidad, grupo) {
  const anterior = useRef({ profundidad, grupo });
  const previo = anterior.current;
  let direccion = "cambio";
  if (previo.grupo === grupo) {
    if (profundidad > previo.profundidad) direccion = "adelante";
    else if (profundidad < previo.profundidad) direccion = "atras";
  }
  // Se actualiza después del commit: si se escribiera durante el render, un
  // re-render sin cambio de pantalla lo pisaría antes de que se monte la nueva.
  useEffect(() => {
    anterior.current = { profundidad, grupo };
  }, [profundidad, grupo]);
  return direccion;
}

export function ScreenTransition({ children, style, direccion = "cambio" }) {
  if (!Animated) {
    return <View style={[{ flex: 1 }, style]}>{children}</View>;
  }
  return (
    <Animated.View
      entering={animacionDeEntrada(direccion)}
      // Sin `exiting`: en Android, la animación de salida de Reanimated al
      // desmontar dejaba a veces la pantalla anterior como vista fantasma
      // congelada encima de la nueva (mismo bug que tenía el visor de fotos).
      style={[{ flex: 1 }, style]}
    >
      {children}
    </Animated.View>
  );
}
