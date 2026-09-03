import "react-native-url-polyfill/auto";
import { AppState } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";

// La app provee estas variables vía su .env
// (EXPO_PUBLIC_* se expone al bundle de cliente por convención de Expo SDK 49+).
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.warn(
    "[supabase] Faltan EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY. " +
      "Copia .env.example a .env en la raíz de la app y completa los valores del proyecto Supabase."
  );
}

export const supabase = createClient(SUPABASE_URL || "https://placeholder.supabase.co", SUPABASE_ANON_KEY || "placeholder", {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

export async function getAccessToken() {
  // getSession() renueva sola la sesión si el access token ya venció, así que
  // esto devuelve un token utilizable mientras el refresh token siga vivo.
  const { data } = await supabase.auth.getSession();
  return data?.session?.access_token || null;
}

/**
 * Fuerza la renovación del token y devuelve el nuevo access token.
 *
 * Lo usa el cliente HTTP cuando el backend responde 401: puede pasar que el
 * token guardado siga vigente para el reloj del teléfono pero no para el del
 * servidor. Devuelve null si la sesión ya no se puede renovar.
 */
export async function refreshAccessToken() {
  try {
    const { data, error } = await supabase.auth.refreshSession();
    if (error) return null;
    return data?.session?.access_token || null;
  } catch {
    return null;
  }
}

/**
 * Mantiene viva la sesión mientras la app está en primer plano.
 *
 * En React Native el temporizador de `autoRefreshToken` no corre de forma
 * confiable con la app en segundo plano: al volver, el access token ya venció
 * y el usuario aparece deslogueado sin haber cerrado sesión. Supabase lo
 * resuelve arrancando y deteniendo el refresco según el estado de la app —
 * esto es exactamente eso, y es la razón principal de que antes pidiera
 * iniciar sesión tan seguido.
 *
 * Devuelve una función para dejar de vigilar.
 */
export function vigilarSesionEnPrimerPlano() {
  const aplicar = (estado) => {
    // Se apaga solo ante un estado explícito de segundo plano. Al arrancar,
    // `currentState` puede venir "unknown" o null (pasa en Android): tratarlo
    // como inactivo dejaría el refresco apagado hasta el primer cambio de
    // estado, que es justo el escenario que se quiere evitar.
    if (estado === "background" || estado === "inactive") supabase.auth.stopAutoRefresh();
    else supabase.auth.startAutoRefresh();
  };

  // El estado inicial también cuenta: si la app arranca activa hay que
  // encender el refresco de inmediato, sin esperar al primer cambio.
  aplicar(AppState.currentState);

  const sub = AppState.addEventListener("change", aplicar);
  return () => {
    supabase.auth.stopAutoRefresh();
    sub?.remove?.();
  };
}
