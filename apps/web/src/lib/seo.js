/* ──────────────────────────────────────────────────────────────
   Configuración SEO central del sitio
   ────────────────────────────────────────────────────────────── */

export const SITE_URL = "https://arriendomiautoya.cl";
export const SITE_NAME = "ArriendoMiAutoYa";

export const DEFAULT_TITLE =
  "Arriendo de Autos y Financia tu Auto | ArriendoMiAutoYa Chile";
export const DEFAULT_DESCRIPTION =
  "Arrienda autos desde $19.000/día o financia la cuota de tu auto ganando hasta $800.000/mes. Seguro con deducible 15 UF, sin mesón ni trámites en Chile.";
export const DEFAULT_KEYWORDS =
  "arriendo de autos chile, rent a car santiago, financia tu auto, pagar cuota auto arriendo, rent a car economico, arriendo autos particulares, financiamiento automotriz, arriendo auto por dia, ganar dinero con mi auto chile, rent a car viña del mar, arriendomiautoya";
export const DEFAULT_OG_IMAGE = `${SITE_URL}/hero-car.jpg`;

/**
 * Construye una URL absoluta y canónica a partir de un path relativo.
 * Elimina query strings y normaliza la barra final.
 */
export function absoluteUrl(path = "/") {
  const clean = String(path).split("?")[0].split("#")[0];
  if (clean === "/" || clean === "") return SITE_URL;
  return `${SITE_URL}${clean.startsWith("/") ? "" : "/"}${clean}`.replace(/\/$/, "");
}
