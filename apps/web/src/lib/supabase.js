import { createClient } from "@supabase/supabase-js";

/**
 * Cliente Supabase.
 *
 * Si faltan las variables de entorno (NEXT_PUBLIC_SUPABASE_URL /
 * NEXT_PUBLIC_SUPABASE_ANON_KEY) usamos un placeholder para que
 * `next build` no falle al recolectar datos de página. Las llamadas
 * de autenticación fallarán en tiempo de ejecución hasta que se
 * configuren las variables en el entorno (p. ej. en Vercel).
 */
const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-anon-key";

export const isSupabaseConfigured = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

if (!isSupabaseConfigured && typeof window !== "undefined") {
  console.warn(
    "[supabase] Faltan NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY. " +
      "El cliente está en modo placeholder y la autenticación no funcionará."
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
