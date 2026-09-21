// ============================================================================
// Selector de PDF para los certificados oficiales del Registro Civil.
// ----------------------------------------------------------------------------
// `expo-document-picker` se carga a demanda (require dentro de la función) y no con un
// import estático: así el resto de la app, y los tests que importan `mobile-shared`, no
// dependen de que el módulo nativo esté instalado. Instalarlo en las dos apps con
// `npx expo install expo-document-picker` (viene incluido en Expo Go).
// ============================================================================

const TIPO_PDF = "application/pdf";

/**
 * Abre el selector de archivos limitado a PDF.
 * Devuelve `{ cancelado: true }` o `{ cancelado: false, uri, name }`.
 * Lanza un error legible si el módulo no está instalado.
 */
export async function elegirPdf() {
  let DocumentPicker;
  try {
    DocumentPicker = require("expo-document-picker");
  } catch (e) {
    throw new Error(
      "Falta instalar el selector de documentos (expo-document-picker). Actualiza la app e inténtalo de nuevo."
    );
  }

  const resultado = await DocumentPicker.getDocumentAsync({
    type: TIPO_PDF,
    copyToCacheDirectory: true,
    multiple: false,
  });

  // API nueva (`canceled` + `assets`) y antigua (`type: "cancel"`).
  if (resultado.canceled || resultado.type === "cancel") return { cancelado: true };
  const archivo = resultado.assets?.[0] || resultado;
  if (!archivo?.uri) return { cancelado: true };
  return { cancelado: false, uri: archivo.uri, name: archivo.name || "certificado.pdf" };
}
