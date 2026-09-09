// ============================================================================
// Utilidades de carga dinámica para escáner y navegador web
// Evita excepciones fatales en runtime cuando los módulos nativos no están presentes
// ============================================================================

// Carga perezosa de expo-web-browser para la sesión hosted de Didit
export function loadWebBrowser() {
  try {
    const module = require("expo-web-browser");
    return module?.default ?? module;
  } catch (error) {
    console.warn("[kycScanners] expo-web-browser no disponible:", error?.message);
    return null;
  }
}

// Carga perezosa de react-native-document-scanner-plugin para el flujo casero
export function loadDocumentScanner() {
  try {
    const module = require("react-native-document-scanner-plugin");
    const scanner = module?.default ?? module;
    if (typeof scanner?.scanDocument !== "function") return null;
    return {
      scanDocument: (options) => scanner.scanDocument(options),
      ResponseType: module.ResponseType,
      Status: module.ScanDocumentResponseStatus,
    };
  } catch (error) {
    console.warn("[kycScanners] escáner nativo no disponible:", error?.message);
    return null;
  }
}

// Validador de RUT chileno con dígito verificador Módulo 11
export function isChileanRutValid(rawRut) {
  if (!rawRut) return false;
  const clean = rawRut.replace(/\./g, "").replace(/-/g, "").trim().toUpperCase();
  if (clean.length < 2) return false;
  const body = clean.slice(0, -1);
  const dv = clean.slice(-1);
  if (!/^\d+$/.test(body)) return false;

  let sum = 0;
  let multiplier = 2;
  for (let i = body.length - 1; i >= 0; i--) {
    sum += parseInt(body[i], 10) * multiplier;
    multiplier = multiplier === 7 ? 2 : multiplier + 1;
  }
  const remainder = 11 - (sum % 11);
  const expectedDv = remainder === 11 ? "0" : remainder === 10 ? "K" : String(remainder);
  return dv === expectedDv;
}
