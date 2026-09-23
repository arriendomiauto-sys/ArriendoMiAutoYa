import { useCallback, useEffect, useMemo, useRef } from "react";
import { BackHandler, Platform, ToastAndroid } from "react-native";

let Gesture = null;
let runOnJS = null;
try {
  Gesture = require("react-native-gesture-handler").Gesture;
} catch {
  // react-native-gesture-handler no disponible en binario nativo
}
try {
  runOnJS = require("react-native-reanimated").runOnJS;
} catch {
  // react-native-reanimated no disponible en binario nativo
}

// Ventana para el segundo toque/gesto de "atrás" que confirma la salida.
// Android traduce tanto el botón físico como el gesto de swipe-back del
// sistema al mismo evento `hardwareBackPress`, así que esto cubre ambos.
const VENTANA_DOBLE_BACK_MS = 2000;

// Franja pegada al borde izquierdo donde debe *arrancar* el dedo para que
// cuente como "swipe back" (mismo umbral que usa el gesto nativo de iOS).
// Más allá de esta franja el arrastre se deja pasar tal cual a lo que haya
// debajo (carruseles de fotos, tabs horizontales, etc.).
const ANCHO_BORDE = 24;
// Distancia u velocidad horizontal mínima para confirmar el gesto (lo que
// sea más rápido de los dos: un swipe corto pero veloz también cuenta).
const UMBRAL_DISTANCIA_PX = 60;
const UMBRAL_VELOCIDAD_PXS = 800;

/**
 * Manejo del botón físico / gesto "atrás" para apps que navegan por estado
 * (sin react-navigation, que trae esto gratis). Cubre dos mecanismos que
 * conviven:
 *
 * 1. Android: el evento `hardwareBackPress` (botón físico Y el gesto de
 *    swipe-back del sistema en Android 10+ llegan acá igual).
 * 2. iOS (y opcionalmente Android también): un gesto de arrastre desde el
 *    borde izquierdo de la pantalla, imitando el "swipe back" nativo de
 *    UINavigationController -- sin react-navigation esta app no lo trae
 *    por sí sola, así que hay que armarlo a mano.
 *
 * Ambos mecanismos accionan la MISMA pila de capas, así que se comportan
 * igual sin importar cómo se disparó el "atrás".
 *
 * `capasAbiertas`: array con las capas abiertas en orden de apilado, donde
 * `capasAbiertas[0]` es la más reciente / visible (la que el usuario ve y la
 * primera que debe cerrarse). Cada capa es un descriptor opcional de la forma
 *
 *   { nivel, onCerrar }
 *
 * - `nivel`: nombre legible de la capa (pantalla hija o modal), solo diagnóstico.
 * - `onCerrar`: función que cierra esa capa (el mismo "setBack" que ya usa la UI).
 *
 * Si hay una capa abierta, el back la cierra (evita salir accidentalmente
 * desde una pantalla hija). Si el array está vacío la app está en la raíz:
 * por defecto Android exige un segundo toque/gesto dentro de
 * `VENTANA_DOBLE_BACK_MS` antes de dejar que el sistema salga (un back
 * accidental en la pantalla principal no debe botar a la app entera); en la
 * raíz, el gesto de borde de iOS simplemente no hace nada (ahí no hay a
 * dónde "volver").
 *
 * `opciones.confirmarSalida` (default true) desactiva ese doble-toque en la
 * raíz si alguna pantalla lo necesita; `opciones.mensajeSalida` cambia el
 * texto del aviso.
 *
 * Devuelve el gesto de borde para que la pantalla raíz lo conecte con
 * `<GestureDetector gesture={gestoVolver}>` envolviendo su contenido. Si
 * gesture-handler/reanimated no están disponibles, devuelve `null` -- el
 * llamador debe tolerar eso (no todo binario nativo trae esas libs).
 */
export function useBackAndroid(capasAbiertas = [], opciones = {}) {
  const { confirmarSalida = true, mensajeSalida = "Presiona de nuevo para salir" } = opciones;
  const ref = useRef(capasAbiertas);
  ref.current = capasAbiertas;
  const ultimoPressEnRaizRef = useRef(0);

  const cerrarCapaActual = useCallback(() => {
    const capa = (ref.current || [])[0];
    if (capa && typeof capa.onCerrar === "function") {
      capa.onCerrar();
      return true;
    }
    return false;
  }, []);

  useEffect(() => {
    if (Platform.OS !== "android") return undefined;

    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (cerrarCapaActual()) return true; // Cierra la capa: la app no sale.
      if ((ref.current || [])[0]) return false; // Había capa pero sin onCerrar: deja pasar.

      // Raíz sin capas abiertas.
      if (!confirmarSalida) return false;
      const ahora = Date.now();
      if (ahora - ultimoPressEnRaizRef.current < VENTANA_DOBLE_BACK_MS) {
        return false; // Segundo toque a tiempo: deja que Android salga.
      }
      ultimoPressEnRaizRef.current = ahora;
      if (ToastAndroid?.show) ToastAndroid.show(mensajeSalida, ToastAndroid.SHORT);
      return true; // Primer toque: se consume, todavía no sale.
    });

    return () => sub.remove();
  }, [confirmarSalida, mensajeSalida, cerrarCapaActual]);

  // Swipe desde el borde izquierdo -> cierra la capa actual, si hay una. En
  // la raíz no hace nada (ni exige doble gesto: ese patrón es solo del back
  // físico de Android). Si no hay gesto-handler disponible, no hay gesto que
  // ofrecer -- el llamador sigue funcionando sin envolver nada.
  const gestoVolver = useMemo(() => {
    if (!Gesture || !runOnJS) return null;
    return Gesture.Pan()
      .activeOffsetX(15)
      .failOffsetY([-15, 15])
      .onEnd((e) => {
        "worklet";
        const xInicio = e.x - e.translationX;
        if (xInicio > ANCHO_BORDE) return; // no arrancó pegado al borde
        if (e.translationX < UMBRAL_DISTANCIA_PX && e.velocityX < UMBRAL_VELOCIDAD_PXS) return;
        runOnJS(cerrarCapaActual)();
      });
  }, [cerrarCapaActual]);

  return gestoVolver;
}
