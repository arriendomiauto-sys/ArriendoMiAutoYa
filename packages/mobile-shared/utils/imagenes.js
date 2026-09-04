import { Image } from "react-native";
import * as ImageManipulator from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { ApiClient } from "../api/client";
import { showAlert } from "./alert";

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

// Un documento que después lee el OCR (cédula, licencia, boleta) necesita más
// resolución y menos compresión que una foto de carrocería: el texto chico es
// lo primero que se pierde. Sigue siendo ~4 veces más liviano que el original.
export const AJUSTES_DOCUMENTO = { maxAncho: 2000, calidad: 0.85 };

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
  let subida = null;
  let ultimoError = null;
  for (let intento = 0; intento < 2; intento++) {
    try {
      subida = await ApiClient.subirArchivoStorage(optimizada, nombre, bucket);
      if (subida?.url) break;
    } catch (err) {
      ultimoError = err;
      if (intento === 0) await new Promise((r) => setTimeout(r, 1500));
    }
  }
  if (!subida && ultimoError) throw ultimoError;
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


/**
 * Pide la foto al usuario resolviendo el permiso correspondiente.
 *
 * Cada pantalla repetía este mismo bloque (pedir permiso, lanzar el picker,
 * distinguir cancelación de error) con textos distintos. Devuelve el `uri`
 * elegido, o `null` si el usuario canceló o no dio permiso.
 */
export async function elegirImagen({ origen = "camera", motivoPermiso } = {}) {
  const esCamara = origen === "camera";

  const permiso = esCamara
    ? await ImagePicker.requestCameraPermissionsAsync()
    : await ImagePicker.requestMediaLibraryPermissionsAsync();

  if (!permiso.granted) {
    showAlert(
      "Permiso requerido",
      motivoPermiso ||
        (esCamara
          ? "Necesitamos acceso a la cámara para tomar la foto."
          : "Necesitamos acceso a tus fotos para adjuntar el archivo.")
    );
    return null;
  }

  const resultado = esCamara
    ? await ImagePicker.launchCameraAsync({ quality: 0.9 })
    : await ImagePicker.launchImageLibraryAsync({ quality: 0.9 });

  if (resultado.canceled || !resultado.assets?.length) return null;
  return resultado.assets[0]?.uri || null;
}

/**
 * Atajo completo: elegir foto, optimizarla y subirla.
 *
 * Devuelve `{ url, cancelado }`. Se separa "cancelado" del error para que la
 * pantalla no muestre una alerta de fallo cuando el usuario simplemente cerró
 * la cámara.
 */
export async function elegirYSubirImagen({
  origen = "camera",
  bucket = "general",
  filename,
  calidad,
  maxAncho,
  motivoPermiso,
} = {}) {
  const uri = await elegirImagen({ origen, motivoPermiso });
  if (!uri) return { url: null, cancelado: true };

  const url = await subirImagenOptimizada(uri, { filename, bucket, calidad, maxAncho });
  return { url, cancelado: false };
}
