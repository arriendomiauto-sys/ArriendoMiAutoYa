import { useEffect, useState } from "react";
import { Platform } from "react-native";
import Constants from "expo-constants";
import { ApiClient } from "../api/client";
import { versionEsMenor } from "../utils/semver";

/**
 * Chequeo de versión mínima obligatoria (force update). Cualquier fallo de
 * red (backend dormido, sin conexión) se trata como "no forzar" — este
 * chequeo nunca debe dejar la app colgada ni bloquear su uso por su cuenta.
 */
export function useVersionCheck() {
  const [bloqueado, setBloqueado] = useState(false);
  const [urlStore, setUrlStore] = useState(null);

  useEffect(() => {
    let vivo = true;
    ApiClient.getVersionMinima()
      .then((data) => {
        if (!vivo || !data?.version_minima) return;
        const versionActual = Constants.expoConfig?.version;
        if (!versionActual) return;
        if (versionEsMenor(versionActual, data.version_minima)) {
          setUrlStore(Platform.OS === "ios" ? data.url_store_ios : data.url_store_android);
          setBloqueado(true);
        }
      })
      .catch(() => {
        // Sin respuesta del backend: se sigue usando la app normal.
      });
    return () => {
      vivo = false;
    };
  }, []);

  return { bloqueado, urlStore };
}
