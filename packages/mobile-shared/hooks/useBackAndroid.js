import { useEffect, useRef } from "react";
import { BackHandler, Platform, ToastAndroid } from "react-native";

// Ventana para el segundo toque/gesto de "atrás" que confirma la salida.
// Android traduce tanto el botón físico como el gesto de swipe-back del
// sistema al mismo evento `hardwareBackPress`, así que esto cubre ambos.
const VENTANA_DOBLE_BACK_MS = 2000;

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
 * Si hay una capa abierta, el back la cierra y devuelve `true` (evita salir
 * accidentalmente desde una pantalla hija). Si el array está vacío la app
 * está en la raíz: por defecto exige un segundo toque/gesto dentro de
 * `VENTANA_DOBLE_BACK_MS` antes de dejar que Android salga (un back
 * accidental en la pantalla principal no debe botar a la app entera).
 *
 * `opciones.confirmarSalida` (default true) desactiva ese doble-toque en la
 * raíz si alguna pantalla lo necesita; `opciones.mensajeSalida` cambia el
 * texto del aviso.
 */
export function useBackAndroid(capasAbiertas = [], opciones = {}) {
  const { confirmarSalida = true, mensajeSalida = "Presiona de nuevo para salir" } = opciones;
  const ref = useRef(capasAbiertas);
  ref.current = capasAbiertas;
  const ultimoPressEnRaizRef = useRef(0);

  useEffect(() => {
    if (Platform.OS !== "android") return undefined;

    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      const capa = (ref.current || [])[0];
      if (capa) {
        if (typeof capa.onCerrar === "function") {
          capa.onCerrar();
          return true; // Cierra la capa: la app no sale.
        }
        return false;
      }

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
  }, [confirmarSalida, mensajeSalida]);
}