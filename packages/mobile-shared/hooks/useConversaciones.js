import { useCallback, useEffect, useState } from "react";
import { AppState } from "react-native";
import { ApiClient } from "../api/client";
import { useApp } from "../context/AppContext";
import { alCambiarChat } from "../utils/chatEvents";

/**
 * Resumen de las conversaciones del usuario: última línea y no leídos.
 *
 * Alimenta dos cosas: el globo de la pestaña Mensajes y la vista previa de la
 * lista de conversaciones. Antes la lista abría cada conversación entera solo
 * para saber si había algo nuevo, y el globo ni siquiera consultaba: estaba
 * encendido siempre.
 *
 * Frescura sin socket propio ni intervalo extra: se refresca al volver del
 * segundo plano, cuando cambia el nº de notificaciones de mensaje sin leer y
 * cuando hay actividad dentro de una conversación (`utils/chatEvents`) —
 * `AppContext` ya consulta las notificaciones cada 30 s, así que el globo y la
 * lista quedan al día a ese ritmo sin nada más corriendo contra la batería.
 */
export function useConversaciones({ activo = true } = {}) {
  const { notifications } = useApp();
  const [conversaciones, setConversaciones] = useState([]);
  const [cargando, setCargando] = useState(true);

  const refrescar = useCallback(async () => {
    if (!activo) return;
    try {
      const datos = await ApiClient.getResumenConversaciones();
      if (Array.isArray(datos)) setConversaciones(datos);
    } catch {
      // Un poll fallido (sin señal, backend despertando) no debe tumbar el
      // globo ni dejar `cargando` pegado en true: se conserva el último
      // resumen y el próximo disparo (notificación, foreground) reintenta.
    } finally {
      setCargando(false);
    }
  }, [activo]);

  useEffect(() => {
    refrescar();
  }, [refrescar]);

  const mensajesPendientes = (notifications || []).filter(
    (n) => n.tipo === "mensaje" && !n.leido
  ).length;
  useEffect(() => {
    if (activo) refrescar();
  }, [mensajesPendientes, activo, refrescar]);

  useEffect(() => {
    if (!activo) return undefined;
    const sub = AppState.addEventListener("change", (estado) => {
      if (estado === "active") refrescar();
    });
    return () => sub.remove();
  }, [activo, refrescar]);

  // Actividad dentro de una conversación (se envía o llega un mensaje) refresca
  // el globo y las vistas previas al instante, sin esperar el poll de 30 s.
  useEffect(() => {
    if (!activo) return undefined;
    return alCambiarChat(() => refrescar());
  }, [activo, refrescar]);

  const noLeidos = conversaciones.reduce((total, c) => total + (c.no_leidos || 0), 0);

  return { conversaciones, noLeidos, cargando, refrescar };
}
