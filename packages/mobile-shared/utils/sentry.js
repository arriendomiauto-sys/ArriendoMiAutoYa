/**
 * Captura de errores en producción (Sentry). Best-effort, igual que push.js:
 * sin `EXPO_PUBLIC_SENTRY_DSN` configurado, esta función no hace nada y la
 * app sigue funcionando normal — solo queda sin reportar caídas.
 */
export function inicializarSentry() {
  const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
  if (!dsn) {
    console.log(
      "[sentry] EXPO_PUBLIC_SENTRY_DSN vacío; captura de errores desactivada. " +
        "Revisa la configuración antes de publicar un build de producción."
    );
    return null;
  }

  try {
    const Sentry = require("@sentry/react-native");
    Sentry.init({
      dsn,
      environment: process.env.NODE_ENV === "production" ? "production" : "development",
      tracesSampleRate: 0.2,
      enabled: process.env.NODE_ENV === "production",
    });
    return Sentry;
  } catch (e) {
    console.warn("[sentry] no se pudo inicializar:", e?.message);
    return null;
  }
}
