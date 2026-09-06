import { Platform, Vibration } from "react-native";

/**
 * Feedback háptico con degradación elegante.
 *
 * `expo-haptics` es un módulo nativo: si el development build todavía no lo
 * incluye (o se corre en un entorno sin binario nativo, como los tests), el
 * `require` falla y se cae a `Vibration` de React Native, que es parte del
 * core y siempre está disponible. Así la vibración de confirmación funciona
 * desde ya y se vuelve más fina (patrones success/warning de iOS) en cuanto
 * se reconstruye el binario.
 */
let Haptics = null;
try {
  // eslint-disable-next-line global-require
  Haptics = require("expo-haptics");
} catch (e) {
  Haptics = null;
}

const vibrar = (patronAndroid, msIos) => {
  try {
    Vibration.vibrate(Platform.OS === "android" ? patronAndroid : msIos);
  } catch (e) {
    // Algunos entornos (web, tests) no exponen Vibration: no es crítico.
  }
};

/** Confirmación positiva: lectura de QR válida, identidad verificada, etc. */
export async function hapticoExito() {
  try {
    if (Haptics?.notificationAsync) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      return;
    }
  } catch (e) {
    /* cae al patrón de Vibration */
  }
  // Dos toques cortos ascendentes ~ "ta- da".
  vibrar([0, 35, 60, 45], 250);
}

/** Algo falló o no coincide: código inválido, identidad rechazada. */
export async function hapticoError() {
  try {
    if (Haptics?.notificationAsync) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }
  } catch (e) {
    /* cae al patrón de Vibration */
  }
  vibrar([0, 90, 70, 90], 400);
}

/** Toque sutil para interacciones menores (opcional). */
export async function hapticoToque() {
  try {
    if (Haptics?.impactAsync) {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      return;
    }
  } catch (e) {
    /* cae al patrón de Vibration */
  }
  vibrar(15, 15);
}
