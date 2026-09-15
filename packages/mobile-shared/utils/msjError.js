import { traducirErrorAuth } from "./authErrors";

const GENERICO = "Algo salió mal. Intenta de nuevo en unos segundos.";
const GENERICO_AUTH = "No se pudo completar la operación. Intenta de nuevo en unos segundos.";

/**
 * Convierte un error de API/negocio/red en un mensaje razonable para el
 * usuario final. Complementa a `traducirErrorAuth` (que cubre Supabase Auth):
 * acá se cubren los errores del cliente HTTP y de pantalla que antes se
 * mostraban crudos (`err.message`) — mensajes en inglés con prefijos de
 * librería, "Error en la solicitud: 500", JSON serializado, etc.
 *
 * Reglas, en orden:
 * - Auth: los patrones conocidos se humanizan reutilizando traducirErrorAuth.
 * - Fallos de conexión: el cliente HTTP ya marca `esFalloDeConexion`; se usa
 *   un mensaje fijo (esconde la URL real del backend).
 * - 5xx / "Error en la solicitud: N": el código de estado no le dice nada al
 *   usuario, se traduce a un mensaje de servidor.
 * - 429 / 401: se traducen a acciones concretas.
 * - Prefijos de librería ("AuthApiError:", "Error:") se limpian para que el
 *   resto del mensaje (que suele venir ya en español del backend) sea lo que
 *   se muestre.
 * - Cualquier otra cosa termina en el mensaje por defecto de la pantalla.
 */
export function msjError(err, mensajeFallback = GENERICO) {
  if (!err) return mensajeFallback;

  const msg = typeof err === "string" ? err : (err.message || "").toString().trim();

  const traducido = traducirErrorAuth(err);
  if (traducido !== GENERICO_AUTH) return traducido;

  if (err.esFalloDeConexion) {
    return "No se pudo conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.";
  }

  if (/^Error en la solicitud:\s*\d+$/.test(msg) || err.status >= 500) {
    return "El servidor está con problemas. Espera unos minutos e inténtalo de nuevo.";
  }

  if (err.status === 429) {
    return "Estás haciendo demasiadas peticiones. Espera un momento e inténtalo de nuevo.";
  }

  if (err.status === 401) {
    return "Tu sesión expiró. Inicia sesión de nuevo.";
  }

  // Errores de Supabase vienen como "AuthApiError: ..." y a veces se filtró
  // uno que no matcheó las reglas de arriba; el prefijo no aporta nada.
  const legible = msg
    .replace(/^(AuthApiError|PostgrestError|Error|TypeError|NetworkError)\s*:\s*/i, "")
    .trim();

  // Si el remanente sigue teniendo forma de error técnico (stack trace, hex,
  // frases de runtime JS), no se muestra: es el caso "SomeInternalError: stack
  // trace 0xDEAD" que no matcheó ninguna regla.
  if (
    !legible ||
    /0x[0-9a-fA-F]+|stack trace|^\s*at\b|cannot read|is not a function|unexpected token|json\.parse\(/i.test(
      legible
    )
  ) {
    return mensajeFallback;
  }

  return legible;
}