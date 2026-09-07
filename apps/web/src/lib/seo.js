/* ──────────────────────────────────────────────────────────────
   Configuración SEO central del sitio
   ────────────────────────────────────────────────────────────── */

export const SITE_URL = "https://arriendomiautoya.cl";
export const SITE_NAME = "ArriendoMiAutoYa";

export const DEFAULT_TITLE =
  "ArriendoMiAutoYa — Arrienda autos directamente de sus dueños";
export const DEFAULT_DESCRIPTION =
  "Arrienda autos particulares verificados desde la app. Seguro con deducible de 15 UF (50/50), verificación de identidad en 60 segundos y entrega con código QR.";
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
