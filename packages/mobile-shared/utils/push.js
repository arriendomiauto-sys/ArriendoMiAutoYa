/**
 * Registro de push notifications (expo-notifications). Best-effort: si el
 * usuario no da permiso, si corre en un simulador, o si algo falla, se
 * devuelve null y la app sigue funcionando solo con notificaciones in-app.
 */
import { Platform } from "react-native";

let _cache = { intentado: false, token: null };

/**
 * `true` si la app corre dentro de Expo Go (el cliente de la tienda, no un
 * development build ni un standalone).
 *
 * Desde el SDK 53, expo-notifications ni siquiera deja requerirse sin
 * quejarse en Expo Go para Android: el propio módulo hace un
 * `console.error` apenas se carga, antes de que cualquier try/catch propio
 * pueda evitarlo. La única forma de que no aparezca ese banner rojo es no
 * tocar el módulo en absoluto cuando se sabe de antemano que va a fallar.
 */
function corriendoEnExpoGo() {
  try {
    const Constants = require("expo-constants").default;
    return Constants?.executionEnvironment === "storeClient";
  } catch {
    return false;
  }
}

export async function registrarPushToken(apiClient) {
  if (_cache.intentado) {
    if (_cache.token) apiClient?.registrarPushToken?.(_cache.token).catch(() => {});
    return _cache.token;
  }
  _cache.intentado = true;

  if (corriendoEnExpoGo()) {
    // No es un fallo: las notificaciones remotas simplemente no existen acá.
    // Se avisa una sola vez, con un nivel que no asuste, y sin cargar
    // expo-notifications — cargarlo es lo que dispara el banner de error.
    console.log(
      "[push] Expo Go no soporta notificaciones remotas (desde el SDK 53 en Android). " +
        "Usa un development build para probarlas: https://docs.expo.dev/develop/development-builds/introduction/"
    );
    return null;
  }

  try {
    const Notifications = require("expo-notifications");
    const Device = require("expo-device");

    if (!Device.isDevice) return null; // los simuladores no reciben push

    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });

    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "General",
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }

    const { status: existente } = await Notifications.getPermissionsAsync();
    let status = existente;
    if (existente !== "granted") {
      status = (await Notifications.requestPermissionsAsync()).status;
    }
    if (status !== "granted") return null;

    const projectId =
      require("expo-constants").default?.expoConfig?.extra?.eas?.projectId ||
      require("expo-constants").default?.easConfig?.projectId;
    const { data: token } = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined
    );

    _cache.token = token;
    apiClient?.registrarPushToken?.(token).catch(() => {});
    return token;
  } catch (e) {
    console.warn("[push] no se pudo registrar:", e?.message);
    return null;
  }
}
