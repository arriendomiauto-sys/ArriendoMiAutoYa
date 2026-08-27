// Cliente API centralizado para la aplicación Web Next.js
import { supabase } from "./supabase";

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

export async function fetchApi(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`;
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const headers = {
      "Content-Type": "application/json",
      ...options.headers,
    };
    if (session?.access_token) {
      headers["Authorization"] = `Bearer ${session.access_token}`;
    }

    const res = await fetch(url, { ...options, headers });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.detail || `HTTP error! status: ${res.status}`);
    }
    if (res.status === 204) return null;
    return await res.json();
  } catch (err) {
    console.warn(`[API] Error fetching ${url}:`, err);
    throw err;
  }
}
