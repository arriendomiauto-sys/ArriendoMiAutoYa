/**
 * URL base de la web pública (el Next.js desplegado en Vercel).
 *
 * La usan los enlaces que salen de la app y se abren fuera de ella: sobre
 * todo el correo de recuperación de contraseña que envía Supabase. Ese
 * correo llega al buzón del usuario y se abre en su navegador — muchas veces
 * en otro dispositivo — así que un `http://localhost:3000` no lleva a
 * ninguna parte y deja al usuario sin poder cambiar su clave.
 *
 * Por eso EXPO_PUBLIC_WEB_URL solo se respeta si apunta a un host público
 * por https. Si falta (build de EAS sin env), quedó con un valor de
 * desarrollo (localhost, la IP de la LAN donde corre Expo) o viene con
 * barra final, se normaliza o se cae al dominio de producción.
 */
export const WEB_URL_PRODUCCION = "https://arriendomiautoya.cl";

// Hosts que solo existen en la máquina o en la red del desarrollador:
// loopback, rangos privados RFC 1918 y nombres .local (Bonjour/Expo en LAN).
const HOST_LOCAL =
  /^(localhost|127\.\d+\.\d+\.\d+|0\.0\.0\.0|\[?::1\]?|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)(:\d+)?$/i;

function esPublica(url) {
  // Sin https no sirve: descarta http://, exp:// y cualquier basura.
  const match = /^https:\/\/([^/?#]+)/i.exec(url);
  if (!match) return false;
  const host = match[1].toLowerCase();
  if (HOST_LOCAL.test(host)) return false;
  return !/\.local(:\d+)?$/.test(host);
}

/** Dominio de la web, sin barra final y garantizado público. */
export function baseWebUrl() {
  const configurada = (process.env.EXPO_PUBLIC_WEB_URL || "").trim().replace(/\/+$/, "");
  return esPublica(configurada) ? configurada : WEB_URL_PRODUCCION;
}

/** Arma una URL absoluta de la web: urlWeb("restablecer-contrasena"). */
export function urlWeb(path = "") {
  const ruta = path ? `/${String(path).replace(/^\/+/, "")}` : "";
  return `${baseWebUrl()}${ruta}`;
}
