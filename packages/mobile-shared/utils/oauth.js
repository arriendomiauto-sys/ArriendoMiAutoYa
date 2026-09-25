import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";
import { supabase } from "../api/supabase";

// Cierra la pestaña del navegador si quedó abierta tras un redirect (no-op
// en la mayoría de los casos, pero recomendado por expo-web-browser).
WebBrowser.maybeCompleteAuthSession();

/**
 * Proveedores sociales que ofrece la app.
 *
 * Cada uno tiene que estar habilitado en el dashboard de Supabase
 * (Authentication → Providers) con su Client ID / Secret, y la Redirect URL
 * de la app agregada en Authentication → URL Configuration → Redirect URLs
 * (ver `redirectUriOAuth()` abajo para el valor exacto).
 *
 * Google y Apple en todas las plataformas (sin Facebook). En iOS la App
 * Store exige "Sign in with Apple" si hay otro login social; en Android Apple
 * funciona por el mismo flujo web de Supabase (requiere el Services ID de
 * Apple configurado en el proveedor Apple de Supabase).
 */
export const PROVEEDORES_OAUTH = ["google", "apple"];

export const NOMBRE_PROVEEDOR = {
  google: "Google",
  apple: "Apple",
  facebook: "Facebook",
};

/** La Redirect URL que hay que registrar en Supabase. */
export function redirectUriOAuth() {
  return Linking.createURL("auth/callback");
}

/**
 * Inicia sesión (o crea la cuenta, la primera vez) con un proveedor social
 * vía el flujo OAuth de Supabase.
 *
 * Supabase devuelve una URL que se abre en un navegador in-app; al terminar
 * el proveedor redirige a `arriendatuauto://auth/callback?code=...` y ese
 * código se canjea por una sesión. `onAuthStateChange` en AppContext se
 * encarga del resto (isLoggedIn + syncProfile). El enrolamiento
 * (nombre/RUT/carnet) se sigue pidiendo cuando el usuario reserva o publica.
 *
 * Lanza un Error con `code: "oauth_cancelado"` si el usuario cerró el
 * navegador sin completar.
 */
export async function iniciarSesionConProveedor(provider) {
  const redirectTo = redirectUriOAuth();

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo, skipBrowserRedirect: true },
  });
  if (error) throw error;
  if (!data?.url) throw new Error("No se pudo abrir el proveedor de inicio de sesión.");

  const resultado = await WebBrowser.openAuthSessionAsync(data.url, redirectTo, {
    showInRecents: false,
  });

  if (resultado.type !== "success" || !resultado.url) {
    const err = new Error("Inicio de sesión cancelado.");
    err.code = "oauth_cancelado";
    throw err;
  }

  const { queryParams } = Linking.parse(resultado.url);
  if (queryParams?.error || queryParams?.error_description) {
    throw new Error(
      String(queryParams.error_description || queryParams.error) ||
        "El proveedor rechazó el acceso."
    );
  }

  const code = queryParams?.code;
  if (!code) throw new Error("El proveedor no devolvió un código de acceso.");

  const { data: sesion, error: errCanje } = await supabase.auth.exchangeCodeForSession(
    String(code)
  );
  if (errCanje) throw errCanje;
  return sesion;
}
