// Cliente API centralizado para la aplicación Web Next.js
const RAW_API_URL = process.env.NEXT_PUBLIC_API_URL || "https://arriendomiautoya.onrender.com/api/v1";

if (RAW_API_URL.includes("localhost")) {
  console.warn(
    "[API] NEXT_PUBLIC_API_URL apunta a localhost: se usará la API de producción (arriendomiautoya.onrender.com). " +
      "Si es un typo, corrígelo en .env; si estás en desarrollo con backend local, el navegador no puede alcanzarlo desde el servidor."
  );
}

export const API_BASE_URL = RAW_API_URL.includes("localhost")
  ? "https://arriendomiautoya.onrender.com/api/v1"
  : RAW_API_URL;

export async function fetchApi(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`;
  try {
    const res = await fetch(url, {
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
      ...options,
    });
    if (!res.ok) {
      throw new Error(`HTTP error! status: ${res.status}`);
    }
    return await res.json();
  } catch (err) {
    console.warn(`[API] Error fetching ${url}:`, err);
    throw err;
  }
}
