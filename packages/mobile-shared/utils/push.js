/**
 * Registro de push notifications (expo-notifications). Best-effort: si el
 * usuario no da permiso, si corre en un simulador, o si algo falla, se
 * devuelve null y la app sigue funcionando solo con notificaciones in-app.
 */
import { Platform } from "react-native";

let _cache = { intentado: false, token: null };

export async function registrarPushToken(apiClient) {
  if (_cache.intentado) {
    if (_cache.token) apiClient?.registrarPushToken?.(_cache.token).catch(() => {});
    return _cache.token;
  }
  _cache.intentado = true;

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
