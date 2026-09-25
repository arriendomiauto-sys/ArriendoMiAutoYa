import { useCallback, useEffect, useState } from "react";
import { ApiClient } from "../api/client";

/**
 * Estado de los antecedentes del usuario (certificado de antecedentes + hoja
 * de vida) y si la plataforma los exige para reservar (`obligatorio`, lo dice
 * el backend según ANTECEDENTES_OBLIGATORIOS).
 *
 * `estadoInicial` (el `antecedentes_estado` del perfil ya cargado) se usa
 * mientras llega la respuesta, para no mostrar el aviso de golpe. Con
 * `activo=false` no consulta nada (p. ej. sin sesión).
 */
export function useEstadoAntecedentes({ estadoInicial = null, activo = true } = {}) {
  const [estado, setEstado] = useState(estadoInicial);
  const [obligatorio, setObligatorio] = useState(false);

  const recargar = useCallback(async () => {
    try {
      const datos = await ApiClient.getEstadoAntecedentes();
      if (datos?.estado) setEstado(datos.estado);
      setObligatorio(!!datos?.obligatorio);
    } catch {
      // Sin red: se queda con lo último conocido; el backend igual valida al reservar.
    }
  }, []);

  useEffect(() => {
    if (activo) recargar();
  }, [activo, recargar]);

  return { estado, obligatorio, recargar };
}
