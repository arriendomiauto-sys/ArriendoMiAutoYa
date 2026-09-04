import { useCallback, useEffect, useState } from "react";
import { AppState } from "react-native";
import { ApiClient } from "../api/client";

/**
 * Resumen de las conversaciones del usuario: última línea y no leídos.
 *
 * Alimenta dos cosas: el globo de la pestaña Mensajes y la vista previa de la
 * lista de conversaciones. Antes la lista abría cada conversación entera solo
 * para saber si había algo nuevo, y el globo ni siquiera consultaba: estaba
 * encendido siempre.
 *
 * Se refresca al volver del segundo plano, que es cuando de verdad puede haber
 * llegado algo — no con un intervalo corriendo contra la batería.
 */
export function useConversaciones({ activo = true } = {}) {
  const [conversaciones, setConversaciones] = useState([]);
  const [cargando, setCargando] = useState(true);

  const refrescar = useCallback(async () => {
    if (!activo) return;
    setConversaciones(await ApiClient.getResumenConversaciones());
    setCargando(false);
  }, [activo]);

  useEffect(() => {
    refrescar();
  }, [refrescar]);

  useEffect(() => {
    if (!activo) return undefined;
    const sub = AppState.addEventListener("change", (estado) => {
      if (estado === "active") refrescar();
    });
    return () => sub.remove();
  }, [activo, refrescar]);

  const noLeidos = conversaciones.reduce((total, c) => total + (c.no_leidos || 0), 0);

  return { conversaciones, noLeidos, cargando, refrescar };
}
