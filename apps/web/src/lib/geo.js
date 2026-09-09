// ============================================================================
// Utilidades de geolocalización para el mapa de autos.
// Sin dependencias externas: la geolocalización del navegador + una lista de
// comunas con coordenadas para quien prefiere elegir a mano o niega el permiso.
// ============================================================================

const RADIO_TIERRA_KM = 6371;

/** Distancia en kilómetros entre dos puntos {lat, lng} (fórmula de Haversine). */
export function haversineKm(a, b) {
  if (!a || !b) return Infinity;
  const rad = (x) => (x * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return RADIO_TIERRA_KM * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

/** "a 3,2 km" / "a 850 m" para mostrar la distancia de un auto. */
export function formatearDistancia(km) {
  if (km == null || !Number.isFinite(km)) return null;
  if (km < 1) return `a ${Math.round(km * 1000)} m`;
  if (km < 10) return `a ${km.toFixed(1).replace(".", ",")} km`;
  return `a ${Math.round(km)} km`;
}

// Comunas / ciudades de Chile con más demanda. Coordenadas del centro de la
// comuna — sirven para centrar el mapa y filtrar por cercanía sin llamar a
// ninguna API de geocodificación.
export const COMUNAS = [
  { nombre: "Providencia", region: "RM", lat: -33.4314, lng: -70.6093 },
  { nombre: "Las Condes", region: "RM", lat: -33.4089, lng: -70.5698 },
  { nombre: "Ñuñoa", region: "RM", lat: -33.4569, lng: -70.5977 },
  { nombre: "Santiago Centro", region: "RM", lat: -33.4489, lng: -70.6693 },
  { nombre: "Vitacura", region: "RM", lat: -33.3899, lng: -70.5723 },
  { nombre: "La Reina", region: "RM", lat: -33.4436, lng: -70.5389 },
  { nombre: "Macul", region: "RM", lat: -33.4889, lng: -70.5983 },
  { nombre: "Maipú", region: "RM", lat: -33.5107, lng: -70.7577 },
  { nombre: "La Florida", region: "RM", lat: -33.5225, lng: -70.5989 },
  { nombre: "Puente Alto", region: "RM", lat: -33.6116, lng: -70.5762 },
  { nombre: "San Miguel", region: "RM", lat: -33.4966, lng: -70.6512 },
  { nombre: "Quilicura", region: "RM", lat: -33.3672, lng: -70.7285 },
  { nombre: "Estación Central", region: "RM", lat: -33.4606, lng: -70.6947 },
  { nombre: "Viña del Mar", region: "Valparaíso", lat: -33.0245, lng: -71.5518 },
  { nombre: "Valparaíso", region: "Valparaíso", lat: -33.0472, lng: -71.6127 },
  { nombre: "Concón", region: "Valparaíso", lat: -32.9228, lng: -71.5253 },
  { nombre: "Concepción", region: "Biobío", lat: -36.827, lng: -73.0503 },
  { nombre: "Talcahuano", region: "Biobío", lat: -36.7249, lng: -73.1168 },
  { nombre: "Los Ángeles", region: "Biobío", lat: -37.4697, lng: -72.3537 },
  { nombre: "Chillán", region: "Ñuble", lat: -36.6066, lng: -72.1034 },
  { nombre: "Temuco", region: "Araucanía", lat: -38.7359, lng: -72.5904 },
  { nombre: "Valdivia", region: "Los Ríos", lat: -39.8142, lng: -73.2459 },
  { nombre: "Puerto Montt", region: "Los Lagos", lat: -41.4693, lng: -72.9424 },
  { nombre: "La Serena", region: "Coquimbo", lat: -29.9027, lng: -71.252 },
  { nombre: "Coquimbo", region: "Coquimbo", lat: -29.9533, lng: -71.3436 },
  { nombre: "Antofagasta", region: "Antofagasta", lat: -23.6524, lng: -70.3954 },
  { nombre: "Iquique", region: "Tarapacá", lat: -20.2141, lng: -70.1524 },
  { nombre: "Rancagua", region: "O'Higgins", lat: -34.1708, lng: -70.7444 },
  { nombre: "Talca", region: "Maule", lat: -35.4264, lng: -71.6554 },
  { nombre: "Arica", region: "Arica y Parinacota", lat: -18.4783, lng: -70.3126 },
];

/** Comuna de la lista más cercana a un punto — para el rótulo "cerca de …". */
export function comunaMasCercana(punto) {
  if (!punto) return null;
  let mejor = null;
  let mejorKm = Infinity;
  for (const c of COMUNAS) {
    const km = haversineKm(punto, c);
    if (km < mejorKm) {
      mejorKm = km;
      mejor = c;
    }
  }
  return mejor ? { ...mejor, distanciaKm: mejorKm } : null;
}

/**
 * Pide la ubicación al navegador. Devuelve `{ lat, lng, precisionM }` o
 * rechaza con `{ code, mensaje }` — `code` en:
 *   "no-soportado" | "inseguro" | "denegado" | "no-disponible" | "timeout"
 */
export function solicitarUbicacionGPS({ timeoutMs = 10000 } = {}) {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject({ code: "no-soportado", mensaje: "Tu navegador no permite ubicación." });
      return;
    }
    // La API de geolocalización solo funciona en contextos seguros (HTTPS o
    // localhost). En http:// el navegador la bloquea sin preguntar.
    if (
      typeof window !== "undefined" &&
      window.isSecureContext === false
    ) {
      reject({ code: "inseguro", mensaje: "La ubicación necesita una conexión segura (HTTPS)." });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          precisionM: pos.coords.accuracy,
        });
      },
      (err) => {
        const mapa = {
          1: { code: "denegado", mensaje: "Bloqueaste el permiso de ubicación." },
          2: { code: "no-disponible", mensaje: "No pudimos obtener tu ubicación." },
          3: { code: "timeout", mensaje: "La ubicación tardó demasiado." },
        };
        reject(mapa[err?.code] || { code: "error", mensaje: "No se pudo obtener tu ubicación." });
      },
      { enableHighAccuracy: false, timeout: timeoutMs, maximumAge: 5 * 60 * 1000 }
    );
  });
}

/**
 * Estado del permiso de ubicación sin dispararlo:
 * "granted" | "prompt" | "denied" | "desconocido".
 */
export async function estadoPermisoUbicacion() {
  try {
    if (typeof navigator === "undefined" || !navigator.permissions?.query) {
      return "desconocido";
    }
    const r = await navigator.permissions.query({ name: "geolocation" });
    return r.state || "desconocido";
  } catch {
    return "desconocido";
  }
}

// --- Persistencia de la última ubicación elegida --------------------------
const CLAVE_LS = "amay_ubicacion";

export function guardarUbicacion(ubi) {
  try {
    if (ubi) localStorage.setItem(CLAVE_LS, JSON.stringify(ubi));
    else localStorage.removeItem(CLAVE_LS);
  } catch {
    /* modo privado / storage bloqueado: se ignora */
  }
}

export function leerUbicacion() {
  try {
    const raw = localStorage.getItem(CLAVE_LS);
    if (!raw) return null;
    const u = JSON.parse(raw);
    if (typeof u?.lat === "number" && typeof u?.lng === "number") return u;
    return null;
  } catch {
    return null;
  }
}
