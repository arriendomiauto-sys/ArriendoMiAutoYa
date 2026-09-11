import { io } from "socket.io-client";
import { getAccessToken } from "./supabase";

/**
 * Canal en vivo del chat de una reserva mediante Socket.IO.
 *
 * Conecta al servidor de Socket.IO en tiempo real con soporte para reconexión
 * automática, fallback a polling si el WebSocket nativo tiene problemas de red,
 * y salas privadas por reserva (`reserva_{id}`).
 *
 * `enviar(texto, clientId)` usa el ACK del servidor: el emit lleva un callback
 * y el backend responde `{ ok, mensaje }` con el mensaje ya persistido. Así la
 * pantalla puede conciliar el mensaje optimista con el real sin esperar a que
 * llegue por el broadcast `nuevo_mensaje` (que también llega, y se deduplica).
 */

const API_BASE_URL =
  (typeof process !== "undefined" && process.env?.EXPO_PUBLIC_API_URL) ||
  "https://arriendomiautoya.onrender.com/api/v1";

// Cuánto se espera el ACK de un `enviar_mensaje` antes de dar el mensaje por
// no entregado. El backend en frío (Render) puede tardar, pero pasado esto es
// mejor marcar "fallido" y ofrecer reintentar que dejar el reloj girando.
const ACK_TIMEOUT_MS = 12000;

/** Obtiene el origen base del servidor (quitando el path /api/v1) */
function getSocketBaseUrl() {
  try {
    const url = new URL(API_BASE_URL);
    return url.origin;
  } catch {
    return API_BASE_URL.replace(/\/api\/v1\/?$/, "");
  }
}

export function conectarChat(
  reservaId,
  { onMensaje, onEstado, onEscribiendo, onEnvioResuelto, onEntregaConfirmada } = {}
) {
  let socket = null;
  let cerradoAProposito = false;

  const avisar = (estado) => onEstado && onEstado(estado);

  const iniciar = async () => {
    if (cerradoAProposito) return;

    let token;
    try {
      token = await getAccessToken();
    } catch {
      token = null;
    }

    if (!token) {
      avisar("sin-sesion");
      return;
    }

    avisar("conectando");

    try {
      socket = io(getSocketBaseUrl(), {
        path: "/socket.io",
        auth: { token },
        query: { token },
        transports: ["websocket", "polling"],
        reconnection: true,
        reconnectionAttempts: 15,
        reconnectionDelay: 1500,
        reconnectionDelayMax: 10000,
        timeout: 10000,
      });

      socket.on("connect", () => {
        // Al (re)conectar, unirse a la sala de la reserva.
        socket.emit("unir_reserva", { reserva_id: reservaId }, (resp) => {
          if (resp && resp.ok) avisar("conectado");
        });
      });

      socket.on("reserva_unida", () => {
        avisar("conectado");
      });

      socket.on("nuevo_mensaje", (datos) => {
        const msg = datos?.mensaje || datos;
        if (msg && onMensaje) {
          onMensaje({ ...msg, _clientId: datos?.client_id });
        }
      });

      socket.on("usuario_escribiendo", (datos) => {
        if (onEscribiendo) onEscribiendo(true, datos);
      });

      socket.on("usuario_dejo_de_escribir", (datos) => {
        if (onEscribiendo) onEscribiendo(false, datos);
      });

      socket.on("entrega_confirmada", (datos) => {
        if (onEntregaConfirmada) onEntregaConfirmada(datos);
      });

      socket.on("connect_error", () => {
        avisar("error");
      });

      socket.on("disconnect", () => {
        if (!cerradoAProposito) avisar("desconectado");
      });
    } catch {
      avisar("error");
    }
  };

  iniciar();

  return {
    /**
     * Emite el mensaje por Socket.IO. Devuelve `true` si el canal estaba
     * arriba (y por tanto el ACK / broadcast conciliarán el optimista) o
     * `false` para que la pantalla lo mande por REST.
     */
    enviar(texto, clientId) {
      if (!socket || !socket.connected) return false;
      let resuelto = false;
      const resolver = (ok, mensaje, error) => {
        if (resuelto) return;
        resuelto = true;
        clearTimeout(temporizador);
        onEnvioResuelto && onEnvioResuelto({ clientId, ok, mensaje, error });
      };
      const temporizador = setTimeout(
        () => resolver(false, null, "timeout"),
        ACK_TIMEOUT_MS
      );
      try {
        socket.emit(
          "enviar_mensaje",
          { reserva_id: reservaId, texto, client_id: clientId },
          (ack) => {
            if (ack && ack.ok && ack.mensaje) {
              if (onMensaje) onMensaje({ ...ack.mensaje, _clientId: clientId });
              resolver(true, ack.mensaje);
            } else {
              resolver(false, null, (ack && ack.error) || "rechazado");
            }
          }
        );
        return true;
      } catch {
        resolver(false, null, "emit-error");
        return false;
      }
    },
    escribir(estaEscribiendo) {
      if (!socket || !socket.connected) return;
      try {
        socket.emit(estaEscribiendo ? "escribiendo" : "dejo_de_escribir", {
          reserva_id: reservaId,
        });
      } catch {
        /* ignora si se desconecta */
      }
    },
    conectado() {
      return !!socket && socket.connected;
    },
    cerrar() {
      cerradoAProposito = true;
      if (socket) {
        try {
          socket.disconnect();
        } catch {
          /* ya cerrado */
        }
        socket = null;
      }
    },
  };
}
