import { Image } from "react-native";
import * as ImageManipulator from "expo-image-manipulator";
import { ApiClient } from "../api/client";

/**
 * Optimización de fotos antes de subirlas.
 *
 * La cámara de un teléfono actual entrega archivos de 3 a 8 MB (4000 px de
 * ancho). Subir eso por 4G tarda decenas de segundos por foto — y el
 * enrolamiento de un auto pide nueve. Redimensionar a 1600 px y recomprimir
 * deja archivos de 200-400 KB sin pérdida visible en la ficha del auto, que
 * es lo que hace que la carga se sienta rápida.
 */

export const ANCHO_MAXIMO_FOTO = 1600;
export const CALIDAD_JPEG = 0.62;

// Cuántas subidas simultáneas. Más que esto no acelera en redes móviles y
// arriesga el límite de 20 subidas/minuto del backend.
const SUBIDAS_EN_PARALELO = 3;

function medirImagen(uri) {
  return new Promise((resolve) => {
    try {
      Image.getSize(
        uri,
        (width, height) => resolve({ width, height }),
        () => resolve(null)
      );
    } catch {
      resolve(null);
    }
  });
}

/**
 * Devuelve el uri de una versión reducida y recomprimida. Si algo falla
 * (formato raro, imagen ilegible) devuelve el original: es preferible una
 * subida lenta a perder la foto que el usuario ya tomó.
 */
export async function optimizarImagen(uri, { maxAncho = ANCHO_MAXIMO_FOTO, calidad = CALIDAD_JPEG } = {}) {
  if (!uri) return uri;
  try {
    const medidas = await medirImagen(uri);
    // Sin redimensionar si ya es chica: `resize` con un ancho mayor la
    // ESCALARÍA hacia arriba, dejando un archivo más pesado que el original.
    const acciones = medidas && medidas.width > maxAncho ? [{ resize: { width: maxAncho } }] : [];
    const out = await ImageManipulator.manipulateAsync(uri, acciones, {
      compress: calidad,
      format: ImageManipulator.SaveFormat.JPEG,
    });
    return out?.uri || uri;
  } catch {
    return uri;
  }
}

/** Optimiza y sube una imagen. Devuelve la URL almacenada. */
export async function subirImagenOptimizada(uri, { filename, bucket = "general", calidad, maxAncho } = {}) {
  const optimizada = await optimizarImagen(uri, { calidad, maxAncho });
  const nombre = filename || `foto_${Date.now()}.jpg`;
  const subida = await ApiClient.subirArchivoStorage(optimizada, nombre, bucket);
  return subida?.url || null;
}

/**
 * Sube varias imágenes con concurrencia acotada, informando el avance.
 * `items`: [{ uri, filename }]. Devuelve las URLs en el mismo orden.
 */
export async function subirImagenesOptimizadas(items, { bucket = "general", onProgreso } = {}) {
  const urls = new Array(items.length).fill(null);
  let siguiente = 0;
  let listas = 0;

  const trabajador = async () => {
    while (siguiente < items.length) {
      const indice = siguiente++;
      const item = items[indice];
      try {
        urls[indice] = await subirImagenOptimizada(item.uri, { filename: item.filename, bucket });
      } catch (err) {
        urls[indice] = null;
        if (!trabajador.error) trabajador.error = err;
      }
      listas += 1;
      onProgreso?.(listas, items.length);
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(SUBIDAS_EN_PARALELO, items.length) }, () => trabajador())
  );

  if (urls.every((u) => u === null) && trabajador.error) throw trabajador.error;
  return urls;
}
