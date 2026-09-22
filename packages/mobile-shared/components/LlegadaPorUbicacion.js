import React, { useCallback, useEffect, useRef, useState } from "react";
import { AppState, Text, View } from "react-native";
import * as Location from "expo-location";
import { ApiClient } from "../api/client";
import { Button } from "./ui";
import { msjError } from "../utils/msjError";

// Coinciden con el backend (confirmacion_service.py): la llegada se puede confirmar desde 2 h antes de la
// entrega. Si el backend cambia el margen, él manda: rechaza con 409 y este componente muestra el motivo.
const HORAS_ANTICIPACION_MS = 2 * 3600000;
// Cada cuánto intenta comprobar la llegada por sí sola mientras la pantalla está abierta.
const INTERVALO_AUTOMATICO_MS = 120000;

// El backend manda fechas sin zona horaria (UTC): sin la "Z" JS las leería como hora local.
function instante(iso) {
  if (!iso) return null;
  const ms = new Date(/Z$|[+-]\d\d:?\d\d$/.test(iso) ? iso : `${iso}Z`).getTime();
  return Number.isNaN(ms) ? null : ms;
}

/**
 * Llegada al punto de encuentro comprobada POR UBICACIÓN, no por lo que la persona diga.
 *
 * - Mientras la pantalla está abierta y la reserva está en su ventana, intenta comprobar la llegada sola
 *   (sin tocar nada) si el permiso de ubicación YA fue concedido. Nunca pide permisos por sorpresa.
 * - El botón hace lo mismo y sí pide el permiso, explicando para qué.
 * - Solo se usa la ubicación de ahora, con la app abierta; el servidor calcula la distancia y no guarda
 *   las coordenadas.
 * - Quien no comparte su ubicación no es sancionado por eso: solo no puede demostrar su llegada.
 *
 * `rol`: "dueno" | "cliente". `onActualizada(reserva)` recibe la reserva ya actualizada por el backend.
 */
export function LlegadaPorUbicacion({ reserva, rol, onActualizada }) {
  const campoPropio = rol === "dueno" ? "llegada_dueno_en" : "llegada_cliente_en";
  const campoOtro = rol === "dueno" ? "llegada_cliente_en" : "llegada_dueno_en";
  const nombreOtro = rol === "dueno" ? "El arrendatario" : "El dueño";

  const [llegada, setLlegada] = useState(reserva?.[campoPropio] || null);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState(null);
  const enCurso = useRef(false);

  useEffect(() => {
    setLlegada(reserva?.[campoPropio] || null);
  }, [reserva?.[campoPropio]]); // eslint-disable-line react-hooks/exhaustive-deps

  const inicio = instante(reserva?.fecha_inicio);
  const confirmada = reserva?.estado === "confirmada";
  const enVentana = confirmada && inicio !== null && Date.now() >= inicio - HORAS_ANTICIPACION_MS;

  const intentar = useCallback(
    async (manual) => {
      if (enCurso.current || !reserva?.id) return;
      enCurso.current = true;
      if (manual) {
        setEnviando(true);
        setError(null);
      }
      try {
        let permiso = await Location.getForegroundPermissionsAsync();
        if (permiso?.status !== "granted") {
          // Automático: jamás se pide un permiso sin que la persona lo haya provocado.
          if (!manual) return;
          permiso = await Location.requestForegroundPermissionsAsync();
          if (permiso?.status !== "granted") {
            setError(
              "Sin permiso de ubicación no podemos comprobar que llegaste. Puedes activarlo en los ajustes del teléfono."
            );
            return;
          }
        }
        const posicion = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        if (posicion?.mocked || posicion?.coords?.mocked) {
          if (manual) {
            setError(
              "Se detectó una ubicación simulada o no auténtica. Desactiva aplicaciones de ubicación falsa para confirmar tu llegada."
            );
          }
          return;
        }
        const actualizada = await ApiClient.avisarLlegada(reserva.id, {
          latitud: posicion.coords.latitude,
          longitud: posicion.coords.longitude,
          precision_m: posicion.coords.accuracy,
        });
        setLlegada(actualizada?.[campoPropio] || new Date().toISOString());
        onActualizada?.(actualizada);
      } catch (e) {
        // Los intentos automáticos fallan en silencio (p. ej. "todavía estás lejos"): solo el botón avisa.
        if (manual) setError(msjError(e, "No se pudo confirmar tu llegada. Intenta de nuevo."));
      } finally {
        enCurso.current = false;
        if (manual) setEnviando(false);
      }
    },
    [reserva?.id, campoPropio, onActualizada]
  );

  useEffect(() => {
    if (!enVentana || llegada) return undefined;
    const tic = () => {
      if (typeof AppState !== "undefined" && AppState?.currentState === "active") {
        intentar(false);
      }
    };
    tic();
    const timer = setInterval(tic, INTERVALO_AUTOMATICO_MS);
    if (timer?.unref) timer.unref();
    return () => clearInterval(timer);
  }, [enVentana, llegada, intentar]);

  if (!confirmada) return null;
  const otroLlego = Boolean(reserva?.[campoOtro]);
  if (!llegada && !enVentana && !otroLlego) return null;

  return (
    <View className="gap-1.5">
      {otroLlego ? (
        <Text className="text-[13px] font-semibold text-primary">
          {nombreOtro} ya llegó al punto de encuentro.
        </Text>
      ) : null}
      {llegada ? (
        <Text className="text-[13px] font-semibold text-primary">
          Avisaste que llegaste. Ahora se inicia la entrega con el código QR.
        </Text>
      ) : enVentana ? (
        <>
          <Text className="text-xs leading-[17px] text-textMuted">
            <Text className="font-bold text-textSecondary">Verificación puntual (Ley N° 19.496 y 19.628): </Text>
            Comprobamos tu presencia física únicamente con tu ubicación actual al momento de confirmar tu llegada,
            solo desde 2 horas antes de la entrega y con la app abierta. No realizamos rastreo continuo ni almacenamos
            tus coordenadas. Quien confirma la reserva y no se presenta paga una multa contractual de un día de arriendo.
          </Text>
          <Button
            variant="secondary"
            size="sm"
            label="Ya llegué al punto de encuentro"
            iconLeft="pin"
            loading={enviando}
            onPress={() => intentar(true)}
          />
        </>
      ) : null}
      {error ? <Text className="text-[13px] text-danger">{error}</Text> : null}
    </View>
  );
}
