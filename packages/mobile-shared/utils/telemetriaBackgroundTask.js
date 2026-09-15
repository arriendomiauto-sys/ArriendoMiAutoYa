import { Platform } from "react-native";
import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ApiClient } from "../api/client";

/**
 * Telemetría GPS en segundo plano durante un arriendo activo.
 *
 * `expo-task-manager` exige que `defineTask` corra en el top-level del
 * bundle (no dentro de un componente que monta/desmonta) para que Android
 * pueda relanzar la tarea headless aunque la app esté cerrada. Por eso este
 * módulo define la tarea al importarse, y `registrarTareaTelemetria()` (que
 * se llama desde index.js antes de `registerRootComponent`) solo existe para
 * dejar explícito el punto donde el módulo se resuelve.
 *
 * La tarea corre en un contexto JS separado, sin acceso al árbol de React:
 * el `reservaId` a reportar se persiste en AsyncStorage al iniciar el
 * arriendo (`iniciarTelemetriaBackground`) y se lee ahí adentro.
 */
export const TELEMETRIA_TASK_NAME = "rentacar-telemetria-background";
const RESERVA_ACTIVA_KEY = "@rentacar/telemetria_reserva_activa";

if (Platform.OS !== "web") {
  try {
    TaskManager.defineTask(TELEMETRIA_TASK_NAME, async ({ data, error }) => {
      if (error) {
        console.warn("[telemetria-bg] la tarea reportó un error:", error.message);
        return;
      }
      try {
        const reservaId = await AsyncStorage.getItem(RESERVA_ACTIVA_KEY);
        // Defensivo: sin reserva activa guardada no hay a quién reportarle
        // (arriendo ya terminado, o la tarea sigue viva de una sesión vieja).
        if (!reservaId) return;

        const locations = data?.locations;
        if (!Array.isArray(locations) || !locations.length) return;
        // Solo la más reciente: varias posiciones pueden llegar juntas y no
        // tiene sentido floodear al backend con todas.
        const ultima = locations[locations.length - 1];
        if (!ultima?.coords) return;

        await ApiClient.enviarTelemetria(reservaId, {
          latitud: ultima.coords.latitude,
          longitud: ultima.coords.longitude,
          precision: ultima.coords.accuracy,
          velocidad: ultima.coords.speed,
          altitud: ultima.coords.altitude,
        });
      } catch (e) {
        console.warn("[telemetria-bg] no se pudo enviar la posición:", e?.message);
      }
    });
  } catch (e) {
    console.warn("[telemetria-bg] no se pudo definir la tarea:", e?.message);
  }
}

/** Solo para dejar explícito, desde index.js, el punto donde este módulo se resuelve. */
export function registrarTareaTelemetria() {}

/**
 * Inicia el reporte en background. Si el permiso de background es denegado,
 * degrada en silencio a que la app siga reportando solo en foreground (no
 * bloquea el arriendo por esto).
 */
export async function iniciarTelemetriaBackground(reservaId, intervaloMs = 180000) {
  if (!reservaId || Platform.OS === "web") return;
  try {
    await AsyncStorage.setItem(RESERVA_ACTIVA_KEY, String(reservaId));

    const fg = await Location.requestForegroundPermissionsAsync();
    if (fg.status !== "granted") return;
    const bg = await Location.requestBackgroundPermissionsAsync();
    if (bg.status !== "granted") return;

    const yaRegistrada = await Location.hasStartedLocationUpdatesAsync(TELEMETRIA_TASK_NAME).catch(
      () => false
    );
    if (yaRegistrada) return;

    await Location.startLocationUpdatesAsync(TELEMETRIA_TASK_NAME, {
      accuracy: Location.Accuracy.Balanced,
      timeInterval: intervaloMs,
      distanceInterval: 50,
      showsBackgroundLocationIndicator: true,
      foregroundService: {
        notificationTitle: "Arriendo en curso",
        notificationBody: "Compartiendo ubicación con el dueño del vehículo",
      },
    });
  } catch (e) {
    console.warn("[telemetria-bg] no se pudo iniciar:", e?.message);
  }
}

/** Se llama al terminar/cancelar el arriendo — corta el reporte en background. */
export async function detenerTelemetriaBackground() {
  if (Platform.OS === "web") return;
  try {
    await AsyncStorage.removeItem(RESERVA_ACTIVA_KEY);
    const yaRegistrada = await Location.hasStartedLocationUpdatesAsync(TELEMETRIA_TASK_NAME).catch(
      () => false
    );
    if (yaRegistrada) await Location.stopLocationUpdatesAsync(TELEMETRIA_TASK_NAME);
  } catch (e) {
    console.warn("[telemetria-bg] no se pudo detener:", e?.message);
  }
}
