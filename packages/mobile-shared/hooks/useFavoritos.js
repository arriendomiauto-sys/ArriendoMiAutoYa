import { useState, useEffect, useCallback } from "react";
import { ApiClient } from "../api/client";

/**
 * Wishlist de autos. Trae los ids una vez al montar y ofrece un toggle
 * optimista (marca/desmarca de inmediato en pantalla, y revierte si el
 * backend falla) — igual al patrón ya usado para pausar un auto en
 * MyCarsScreen.
 */
export function useFavoritos() {
  const [favoritoIds, setFavoritoIds] = useState(() => new Set());
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    let vivo = true;
    ApiClient.getIdsFavoritos().then((ids) => {
      if (!vivo) return;
      setFavoritoIds(new Set(ids || []));
      setCargando(false);
    });
    return () => {
      vivo = false;
    };
  }, []);

  const esFavorito = useCallback((autoId) => favoritoIds.has(autoId), [favoritoIds]);

  const toggle = useCallback(async (autoId) => {
    const yaEra = favoritoIds.has(autoId);
    setFavoritoIds((prev) => {
      const siguiente = new Set(prev);
      if (yaEra) siguiente.delete(autoId);
      else siguiente.add(autoId);
      return siguiente;
    });
    try {
      if (yaEra) await ApiClient.quitarFavorito(autoId);
      else await ApiClient.marcarFavorito(autoId);
    } catch {
      // Sin conexión o error del backend: se revierte el cambio optimista.
      setFavoritoIds((prev) => {
        const siguiente = new Set(prev);
        if (yaEra) siguiente.add(autoId);
        else siguiente.delete(autoId);
        return siguiente;
      });
    }
  }, [favoritoIds]);

  return { favoritoIds, cargando, esFavorito, toggle };
}
