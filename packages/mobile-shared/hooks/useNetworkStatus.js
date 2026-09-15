import { useEffect, useState } from "react";
import NetInfo from "@react-native-community/netinfo";

/**
 * Estado de conectividad global. `isConnected` empieza en `true` (no en
 * `null`/`false`) para no mostrar el banner de "sin conexión" en el primer
 * render mientras NetInfo todavía no reportó nada — se corrige con
 * `NetInfo.fetch()` de entrada, antes de esperar al primer evento.
 */
export function useNetworkStatus() {
  const [estado, setEstado] = useState({ isConnected: true, isInternetReachable: true });

  useEffect(() => {
    let activo = true;
    const aplicar = (state) => {
      if (!activo) return;
      setEstado({
        isConnected: state.isConnected !== false,
        // `null` = todavía no se sabe (algunas plataformas tardan en resolverlo);
        // no se trata como "sin internet" para evitar un falso positivo inicial.
        isInternetReachable: state.isInternetReachable !== false,
      });
    };

    NetInfo.fetch().then(aplicar).catch(() => {});
    const unsub = NetInfo.addEventListener(aplicar);

    return () => {
      activo = false;
      unsub();
    };
  }, []);

  return estado;
}
