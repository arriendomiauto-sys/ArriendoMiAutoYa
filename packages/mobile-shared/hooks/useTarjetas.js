import { useCallback, useEffect, useMemo, useState } from "react";
import { ApiClient } from "../api/client";
import { crearCardToken } from "../api/mercadopago";

// Caché de proceso con TTL corto: "Mis tarjetas" y el checkout usan el hook
// por separado y nunca están montados a la vez, pero volver de uno al otro no
// debería gatillar otro GET. El TTL evita mostrar datos viejos (p. ej. tras
// cambiar de cuenta). Se refresca con `recargar()` y con cada alta/baja.
const CACHE_TTL_MS = 60_000;
let _cache = null;
let _cacheTs = 0;
const cacheVigente = () => _cache && Date.now() - _cacheTs < CACHE_TTL_MS;

/** Invalida la caché — llamar al cerrar sesión. */
export function limpiarCacheTarjetas() {
  _cache = null;
  _cacheTs = 0;
}

/**
 * Medios de pago del usuario (vault de Mercado Pago).
 *
 * `agregar` hace todo el baile: tokeniza contra MP en el dispositivo y recién
 * ese token (nunca el número) va a nuestro backend. Devuelve un resultado
 * `{ ok }` en vez de tirar, para que el formulario muestre el error inline
 * (NOMBRE_NO_COINCIDE en el campo del titular, TARJETA_INVALIDA en el número…).
 */
export function useTarjetas() {
  const [tarjetas, setTarjetasState] = useState(cacheVigente() ? _cache : []);
  const [cargando, setCargando] = useState(!cacheVigente());
  const [error, setError] = useState(null);

  // Todo lo que escribe la lista pasa por acá para mantener la caché al día.
  const setTarjetas = useCallback((valorOFn) => {
    setTarjetasState((prev) => {
      const siguiente = typeof valorOFn === "function" ? valorOFn(prev) : valorOFn;
      _cache = siguiente;
      _cacheTs = Date.now();
      return siguiente;
    });
  }, []);

  const recargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      setTarjetas(await ApiClient.getTarjetas());
    } catch (e) {
      setError(e?.message || "No pudimos cargar tus tarjetas.");
    } finally {
      setCargando(false);
    }
  }, [setTarjetas]);

  useEffect(() => {
    if (cacheVigente()) return undefined; // datos frescos: no refetch al remontar
    let vivo = true;
    ApiClient.getTarjetas()
      .then((t) => vivo && setTarjetas(t))
      .catch((e) => vivo && setError(e?.message || "No pudimos cargar tus tarjetas."))
      .finally(() => vivo && setCargando(false));
    return () => {
      vivo = false;
    };
  }, [setTarjetas]);

  const agregar = useCallback(
    async ({ numero, vencimiento, cvv, titular, rut, tipoManual }) => {
      try {
        const token = await crearCardToken({ numero, vencimiento, cvv, titular, rut, tipoManual });
        const tarjeta = await ApiClient.agregarTarjeta({
          card_token: token.card_token,
          payment_method_id: token.payment_method_id,
          // Pistas para el backend: el tipo seleccionado o detectado
          tipo: tipoManual || token.tipo || null,
          ultimos4: token.ultimos4 || null,
        });
        setTarjetas((prev) => [tarjeta, ...prev.filter((t) => t.id !== tarjeta.id)]);
        return { ok: true, tarjeta };
      } catch (e) {
        let msg = e?.mensaje || e?.message || "No se pudo guardar la tarjeta.";
        if (typeof msg === "string" && msg.trim().startsWith("{")) {
          try {
            const parsed = JSON.parse(msg);
            msg = parsed.mensaje || parsed.motivo || parsed.message || parsed.msg || msg;
          } catch {}
        }
        return {
          ok: false,
          codigo: e?.codigo || null,
          campo: e?.codigo === "NOMBRE_NO_COINCIDE" ? "titular" : e?.campo || "numero",
          titularDetectado: e?.titularDetectado || null,
          mensaje: msg,
        };
      }
    },
    []
  );

  const eliminar = useCallback(async (tarjetaId) => {
    const previo = tarjetas;
    setTarjetas((prev) => prev.filter((t) => t.id !== tarjetaId));
    try {
      await ApiClient.eliminarTarjeta(tarjetaId);
      return { ok: true };
    } catch (e) {
      setTarjetas(previo); // revierte
      let msg = e?.mensaje || e?.message || "No se pudo eliminar.";
      if (typeof msg === "string" && msg.trim().startsWith("{")) {
        try {
          const parsed = JSON.parse(msg);
          msg = parsed.mensaje || parsed.motivo || parsed.message || parsed.msg || msg;
        } catch {}
      }
      return { ok: false, codigo: e?.codigo || null, mensaje: msg };
    }
  }, [tarjetas]);

  const validadas = useMemo(() => tarjetas.filter((t) => t.estado === "validada"), [tarjetas]);
  const tarjetasDebito = useMemo(() => validadas.filter((t) => t.tipo === "debito"), [validadas]);
  const tarjetasCredito = useMemo(() => validadas.filter((t) => t.tipo === "credito"), [validadas]);

  return {
    tarjetas,
    cargando,
    error,
    recargar,
    agregar,
    eliminar,
    // El cobro del arriendo acepta débito o crédito (ver checkout_service.py
    // en el backend): `validadas` es el pool completo para ese selector.
    validadas,
    tarjetasDebito,
    tarjetasCredito,
    tieneDebito: tarjetasDebito.length > 0,
    tieneCredito: tarjetasCredito.length > 0,
  };
}
