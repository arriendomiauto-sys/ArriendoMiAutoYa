import { useEffect, useRef, useState } from "react";
import * as Location from "expo-location";
import { ApiClient } from "../api/client";

/**
 * Hook para transmitir la ubicación GPS desde el celular del arrendatario
 * mientras la reserva esté en curso.
 * Se reporta al montar y luego periódicamente cada `intervaloMs` (por defecto 3 min).
 */
export function useTelemetriaArriendo(reservaId, activo = false, intervaloMs = 180000) {
  const [transmitiendo, setTransmitiendo] = useState(false);
  const [ultimaUbicacion, setUltimaUbicacion] = useState(null);
  const [error, setError] = useState(null);
  const timerRef = useRef(null);

  const enviarPosicion = async () => {
    if (!reservaId || !activo) return;
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setError("Permiso de ubicación no concedido");
        return;
      }

      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      if (!loc?.coords) return;

      setTransmitiendo(true);
      const res = await ApiClient.enviarTelemetria(reservaId, {
        latitud: loc.coords.latitude,
        longitud: loc.coords.longitude,
        precision: loc.coords.accuracy,
        velocidad: loc.coords.speed,
        altitud: loc.coords.altitude,
      });

      if (res?.ok) {
        setUltimaUbicacion({
          latitud: loc.coords.latitude,
          longitud: loc.coords.longitude,
          timestamp: new Date().toISOString(),
        });
        setError(null);
      }
    } catch (err) {
      setError(err?.message || "Error al transmitir telemetría");
    } finally {
      setTransmitiendo(false);
    }
  };

  useEffect(() => {
    if (!reservaId || !activo) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    // Envío inicial
    enviarPosicion();

    // Intervalo recurrente
    timerRef.current = setInterval(enviarPosicion, intervaloMs);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [reservaId, activo, intervaloMs]);

  return {
    transmitiendo,
    ultimaUbicacion,
    error,
    forzarEnvio: enviarPosicion,
  };
}
