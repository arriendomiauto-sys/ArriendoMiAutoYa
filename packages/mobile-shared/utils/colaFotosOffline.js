import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Persistencia local de la cola de fotos del checklist de entrega/devolución.
 *
 * Las 8 fotos se toman muchas veces en la calle o en un estacionamiento
 * subterráneo, con señal mala o nula. Antes, si `subirImagenOptimizada`
 * fallaba, la foto recién tomada se perdía por completo — el usuario tenía
 * que volver a sacarla, a veces caminando hasta tener señal.
 *
 * Esto guarda la cola (foto local + su estado de subida) en AsyncStorage
 * apenas se toma cada foto, no cuando termina de subir. Así, si la app se
 * cierra o pierde la conexión a mitad de camino, al volver a abrir la
 * pantalla la foto local sigue ahí y solo falta reintentar la subida — no
 * hay que repetir la foto.
 */

const PREFIJO = "@rentacar/checklist_offline_";

function clave(reservaId, tipo) {
  return `${PREFIJO}${reservaId}_${tipo}`;
}

/** Guarda la cola. Es best-effort: si falla, la app sigue funcionando en memoria. */
export async function guardarColaFotos(reservaId, tipo, cola) {
  if (!reservaId) return;
  try {
    await AsyncStorage.setItem(clave(reservaId, tipo), JSON.stringify(cola));
  } catch {
    // Sin almacenamiento persistente la sesión sigue andando en memoria; se
    // pierde la resiliencia ante un cierre de la app, no el checklist actual.
  }
}

/** Lee la cola guardada, o `null` si no hay ninguna (o no se pudo leer). */
export async function leerColaFotos(reservaId, tipo) {
  if (!reservaId) return null;
  try {
    const crudo = await AsyncStorage.getItem(clave(reservaId, tipo));
    return crudo ? JSON.parse(crudo) : null;
  } catch {
    return null;
  }
}

/** Se llama al terminar el checklist con éxito: ya no hace falta conservar la cola. */
export async function borrarColaFotos(reservaId, tipo) {
  if (!reservaId) return;
  try {
    await AsyncStorage.removeItem(clave(reservaId, tipo));
  } catch {
    // No pasa nada si queda una cola vieja huérfana: la próxima vez que se
    // abra un checklist para esta misma reserva y tipo se sobrescribe.
  }
}
