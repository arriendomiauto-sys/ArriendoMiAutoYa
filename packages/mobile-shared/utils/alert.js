import { Alert, Platform } from "react-native";

/**
 * Reemplazo de Alert.alert que sí funciona en RN-Web.
 *
 * React Native Web no implementa Alert.alert como un diálogo visual — la
 * llamada no hace nada (ni error en consola, ni UI). Eso hizo que varios
 * flujos con validaciones o manejo de errores parecieran "no responder" al
 * probarlos con `expo start --web` (ej. el botón de login: si el request
 * fallaba, el catch llamaba a Alert.alert y no se veía absolutamente nada).
 *
 * Misma firma que Alert.alert(title, message, buttons, options):
 * - Nativo (iOS/Android): delega directo en Alert.alert. `options` se
 *   reenvía tal cual -- en particular `{ cancelable: false }` para que el
 *   botón/gesto de volver de Android no descarte la alerta sin que la
 *   persona toque un botón (útil después de una acción que ya ocurrió en el
 *   servidor, como publicar un auto: si se descarta sin querer, la pantalla
 *   se queda como si nada hubiera pasado, con el mismo botón listo para
 *   tocarlo de nuevo y duplicar la acción).
 * - Web: usa window.alert/confirm. Con 0-1 botones se comporta como un
 *   aviso simple; con 2+ botones, "Aceptar" dispara el botón que no sea
 *   style "cancel" (o el último de la lista) y "Cancelar" dispara el que
 *   tenga style "cancel" — no hay soporte para más de 2 acciones en web,
 *   el navegador no lo permite. `options` no aplica en web.
 */
export function showAlert(title, message, buttons, options) {
  if (Platform.OS !== "web") {
    Alert.alert(title, message, buttons, options);
    return;
  }

  const text = message ? `${title}\n\n${message}` : title;

  if (!buttons || buttons.length <= 1) {
    window.alert(text);
    buttons?.[0]?.onPress?.();
    return;
  }

  const cancelBtn = buttons.find((b) => b.style === "cancel");
  const confirmBtn = buttons.find((b) => b.style !== "cancel") || buttons[buttons.length - 1];

  if (window.confirm(text)) {
    confirmBtn?.onPress?.();
  } else {
    cancelBtn?.onPress?.();
  }
}
