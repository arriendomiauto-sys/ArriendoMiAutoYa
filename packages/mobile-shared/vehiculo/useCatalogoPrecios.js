import { useEffect, useState } from "react";
import { TIPOS_VEHICULO, aplicarTarifasConfig } from "./catalogoPrecios";
import { getAccessToken } from "../api/supabase";

/**
 * Trae las tarifas por categoría que fijó RentACar desde el panel
 * (`GET /admin/configuracion` → `tarifas_categoria`) y las fusiona con los
 * datos fijos de cada categoría. Si el backend no responde o el campo aún no
 * existe, devuelve las tarifas por defecto de `catalogoPrecios` — el
 * asistente de publicación nunca se queda sin catálogo.
 *
 * El endpoint exige una sesión válida (auditoría de seguridad), así que se
 * adjunta el Bearer token de la sesión Supabase cuando existe. Sin sesión el
 * 401 cae en el mismo fallback a defaults.
 */

const API_BASE_URL =
  (typeof process !== "undefined" && process.env?.EXPO_PUBLIC_API_URL) ||
  "https://arriendomiautoya.onrender.com/api/v1";

// Las tarifas cambian poquísimo; se cachean a nivel de módulo para no volver
// a pedirlas cada vez que se abre el asistente.
let cache = null;

export function useCatalogoPrecios() {
  const [tipos, setTipos] = useState(cache || TIPOS_VEHICULO);

  useEffect(() => {
    if (cache || process.env.NODE_ENV === "test") return;
    let vivo = true;
    (async () => {
      try {
        const token = await getAccessToken();
        const resp = await fetch(`${API_BASE_URL}/admin/configuracion`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!resp.ok) return;
        const config = await resp.json();
        const fusion = aplicarTarifasConfig(config?.tarifas_categoria);
        cache = fusion;
        if (vivo) setTipos(fusion);
      } catch {
        // Sin conexión: se queda con los defaults que ya están en el estado.
      }
    })();
    return () => {
      vivo = false;
    };
  }, []);

  return tipos;
}
