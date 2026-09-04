// Cliente API centralizado para la aplicación Web Next.js
export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "https://arriendomiautoya.onrender.com/api/v1";

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
