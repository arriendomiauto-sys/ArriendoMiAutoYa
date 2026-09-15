import { useEffect, useRef } from "react";
import { BackHandler, Platform } from "react-native";

/**
 * Manejo del botón físico "atrás" de Android para apps que navegan por
 * estado (sin react-navigation). En iOS/web no registra nada.
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
 * Si el array está vacío la app está en la raíz: el hook devuelve `false` y el
 * back por defecto de Android sale de la app. Si hay una capa abierta, la
 * cierra y devuelve `true` (evita salir accidentalmente desde una pantalla hija).
 */
export function useBackAndroid(capasAbiertas = []) {
  const ref = useRef(capasAbiertas);
  ref.current = capasAbiertas;

  useEffect(() => {
    if (Platform.OS !== "android") return undefined;

    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      const capa = (ref.current || [])[0];
      if (!capa) return false; // Raíz: deja que Android salga de la app.
      if (typeof capa.onCerrar === "function") {
        capa.onCerrar();
        return true; // Cierra la capa: la app no sale.
      }
      return false;
    });

    return () => sub.remove();
  }, []);
}