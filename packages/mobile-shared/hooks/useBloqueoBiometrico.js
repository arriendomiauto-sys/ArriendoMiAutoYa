import { useState, useEffect, useRef, useCallback } from "react";
import { AppState } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as LocalAuthentication from "expo-local-authentication";

const CLAVE = "@rentacar/bloqueo_biometrico";

/** Face ID/huella disponible y con algo enrolado en el teléfono. */
export async function hayHardwareBiometrico() {
  try {
    const [tieneHardware, tieneEnrolado] = await Promise.all([
      LocalAuthentication.hasHardwareAsync(),
      LocalAuthentication.isEnrolledAsync(),
    ]);
    return !!(tieneHardware && tieneEnrolado);
  } catch {
    return false;
  }
}

/**
 * Bloqueo de la app con Face ID/huella, activable desde el perfil. No es
 * una segunda capa de autenticación de cuenta (la sesión de Supabase ya
 * está iniciada) — es un candado local para que, si alguien más toma el
 * teléfono desbloqueado, no pueda abrir la app y ver reservas, pagos, etc.
 */
export function useBloqueoBiometrico(isLoggedIn) {
  const [activado, setActivadoState] = useState(false);
  const [cargado, setCargado] = useState(false);
  const [desbloqueada, setDesbloqueada] = useState(true);
  const appState = useRef(AppState.currentState);

  useEffect(() => {
    AsyncStorage.getItem(CLAVE)
      .then((v) => setActivadoState(v === "true"))
      .finally(() => setCargado(true));
  }, []);

  // Con el bloqueo activado, cada inicio de sesión (incluida la rehidratación
  // al abrir la app) arranca bloqueado — hay que autenticar antes de ver nada.
  useEffect(() => {
    if (cargado && isLoggedIn && activado) setDesbloqueada(false);
  }, [cargado, isLoggedIn, activado]);

  useEffect(() => {
    if (!activado) return undefined;
    const sub = AppState.addEventListener("change", (next) => {
      // Solo re-bloquea al VOLVER de segundo plano (alguien pudo tomar el
      // teléfono mientras tanto) — no en transiciones internas que no
      // implican haber soltado la app.
      if (appState.current.match(/background|inactive/) && next === "active") {
        setDesbloqueada(false);
      }
      appState.current = next;
    });
    return () => sub.remove();
  }, [activado]);

  const setActivado = useCallback(async (valor) => {
    setActivadoState(valor);
    setDesbloqueada(!valor);
    try {
      await AsyncStorage.setItem(CLAVE, valor ? "true" : "false");
    } catch {
      // Sin persistencia, el toggle sigue funcionando en memoria por esta
      // sesión — no es crítico que sobreviva a un reinicio de la app.
    }
  }, []);

  const intentarDesbloquear = useCallback(async () => {
    try {
      const resultado = await LocalAuthentication.authenticateAsync({
        promptMessage: "Confirma tu identidad para continuar",
        cancelLabel: "Cancelar",
      });
      if (resultado.success) {
        setDesbloqueada(true);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }, []);

  return { cargado, activado, setActivado, desbloqueada, intentarDesbloquear };
}
