import { useEffect, useState } from "react";

/**
 * Cuenta regresiva hasta un instante ISO (`expira_en` de una reserva
 * pendiente). Devuelve { restanteMs, etiqueta: "mm:ss", vencido }.
 * Si `expiraEn` es null/inválido, no corre nada (restanteMs = null).
 */
export function useCuentaRegresiva(expiraEn) {
  const objetivo = expiraEn ? new Date(expiraEn).getTime() : NaN;
  const [ahora, setAhora] = useState(() => Date.now());

  useEffect(() => {
    if (!Number.isFinite(objetivo)) return undefined;
    setAhora(Date.now());
    const id = setInterval(() => setAhora(Date.now()), 1000);
    return () => clearInterval(id);
  }, [objetivo]);

  if (!Number.isFinite(objetivo)) {
    return { restanteMs: null, etiqueta: null, vencido: false };
  }

  const restanteMs = Math.max(0, objetivo - ahora);
  const totalSeg = Math.floor(restanteMs / 1000);
  const mm = String(Math.floor(totalSeg / 60)).padStart(2, "0");
  const ss = String(totalSeg % 60).padStart(2, "0");

  return { restanteMs, etiqueta: `${mm}:${ss}`, vencido: restanteMs === 0 };
}
