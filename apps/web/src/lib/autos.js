import { API_BASE_URL } from "./api";

// ============================================================================
// Acceso al catálogo de autos (GET /autos). Una sola fuente de verdad para la
// landing, el cotizador, el sitemap y las fichas por auto.
// El backend vive en Render (plan gratuito): puede tardar en despertar, así
// que se acota el tiempo de espera y se reintenta una vez.
// ============================================================================

const nombreDePrueba = (a) =>
  /xdd|test|prueba|asdf|dummy|mock|qwer|zzz/i.test(`${a?.marca || ""} ${a?.modelo || ""}`);

const primeraFoto = (a) => {
  const f = (Array.isArray(a?.fotos) && a.fotos[0]) || a?.foto;
  return typeof f === "string" && f.trim().length > 5 ? f.trim() : null;
};

/** Un auto se muestra al público solo si tiene nombre real y al menos una foto. */
export function esAutoPublicable(a) {
  return !!a && !nombreDePrueba(a) && !!primeraFoto(a);
}

export function fotoDeAuto(a) {
  return primeraFoto(a) || null;
}

const RE_UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

/** Recupera el id real desde el parámetro de ruta (que trae `slug-<uuid>`). */
export function extraerIdDeParametro(param) {
  if (!param) return null;
  const m = String(param).match(RE_UUID);
  return m ? m[0] : String(param);
}

/** Slug legible para la URL de la ficha: /auto/toyota-rav4-<id> */
export function autoHref(a) {
  const slug = `${a?.marca || ""}-${a?.modelo || ""}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  return `/auto/${slug ? `${slug}-` : ""}${a?.id}`;
}

async function fetchAutosUnaVez(signal) {
  const res = await fetch(`${API_BASE_URL}/autos`, { signal });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return Array.isArray(data) ? data.filter(esAutoPublicable) : [];
}

/**
 * Trae el catálogo público. `{ timeoutMs, reintentos }`.
 * Lanza si no lo consigue — el llamador decide qué mostrar (nunca datos falsos).
 */
export async function obtenerAutos({ timeoutMs = 12000, reintentos = 1, signal } = {}) {
  let ultimoError;
  for (let intento = 0; intento <= reintentos; intento++) {
    const ctrl = new AbortController();
    const onAbort = () => ctrl.abort();
    if (signal) signal.addEventListener("abort", onAbort);
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      return await fetchAutosUnaVez(ctrl.signal);
    } catch (err) {
      ultimoError = err;
      if (signal?.aborted) throw err;
      if (intento < reintentos) await new Promise((r) => setTimeout(r, 2500));
    } finally {
      clearTimeout(t);
      if (signal) signal.removeEventListener("abort", onAbort);
    }
  }
  throw ultimoError || new Error("No se pudo obtener el catálogo.");
}

/** Un auto por id (para la ficha SSR). `null` si no existe o falla. */
export async function obtenerAutoPorId(id, { timeoutMs = 8000 } = {}) {
  if (!id) return null;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${API_BASE_URL}/autos/${encodeURIComponent(id)}`, {
      signal: ctrl.signal,
    });
    if (!res.ok) return null;
    const a = await res.json();
    return esAutoPublicable(a) ? a : null;
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}
