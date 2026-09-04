import { io } from "socket.io-client";
import { getAccessToken } from "./supabase";

/**
 * Canal en vivo del chat de una reserva mediante Socket.IO.
 *
 * Conecta al servidor de Socket.IO en tiempo real con soporte para reconexión
 * automática, fallback a polling si el WebSocket nativo tiene problemas de red,
 * y salas privadas por reserva (`reserva_{id}`).
 */

const API_BASE_URL =
  (typeof process !== "undefined" && process.env?.EXPO_PUBLIC_API_URL) ||
  "https://api.arriendatuauto.com/api/v1";

/** Obtiene el origen base del servidor (quitando el path /api/v1) */
function getSocketBaseUrl() {
  try {
    const url = new URL(API_BASE_URL);
    return url.origin;
  } catch {
    return API_BASE_URL.replace(/\/api\/v1\/?$/, "");
  }
}

export function conectarChat(reservaId, { onMensaje, onEstado, onEscribiendo } = {}) {
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
        // Al conectar, unirse a la sala de la reserva
        socket.emit("unir_reserva", { reserva_id: reservaId }, (resp) => {
          if (resp && resp.ok) {
            avisar("conectado");
          }
        });
      });

      socket.on("reserva_unida", () => {
        avisar("conectado");
      });

      socket.on("nuevo_mensaje", (datos) => {
        const msg = datos?.mensaje || datos;
        if (msg && onMensaje) {
          onMensaje(msg);
        }
      });

      socket.on("usuario_escribiendo", (datos) => {
        if (onEscribiendo) onEscribiendo(true, datos);
      });

      socket.on("usuario_dejo_de_escribir", (datos) => {
        if (onEscribiendo) onEscribiendo(false, datos);
      });

      socket.on("connect_error", () => {
        avisar("error");
      });

      socket.on("disconnect", (reason) => {
        if (!cerradoAProposito) {
          avisar("desconectado");
        }
      });
    } catch (err) {
      avisar("error");
    }
  };

  iniciar();

  return {
    /** `true` si el mensaje se emitió por Socket.IO; `false` para mandar por REST. */
    enviar(texto) {
      if (!socket || !socket.connected) return false;
      try {
        socket.emit("enviar_mensaje", { reserva_id: reservaId, texto });
        return true;
      } catch {
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
