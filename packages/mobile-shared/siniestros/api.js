import { ApiClient } from "../api/client";

/**
 * Accidentes durante el arriendo (ver RentACar-api: features/operations/siniestros).
 * El reporte abre una disputa "accidente" (la garantía queda asegurada) y el
 * soporte 24/7 lo toma; todo lo que se decide queda en `actualizaciones`, con
 * el mismo texto para el arrendatario y el dueño.
 */
export function reportarSiniestro(reservaId, datos) {
  return ApiClient.request(`/reservas/${reservaId}/siniestro`, {
    method: "POST",
    body: JSON.stringify(datos),
  });
}

/** El caso más reciente de la reserva, o null si no hay ninguno. */
export async function verSiniestro(reservaId) {
  try {
    return await ApiClient.request(`/reservas/${reservaId}/siniestro`);
  } catch (err) {
    if (err?.status === 404) return null;
    throw err;
  }
}

export const ESTADO_SINIESTRO = {
  reportado: { variant: "danger", label: "Esperando a soporte" },
  en_atencion: { variant: "warning", label: "Soporte a cargo" },
  cerrado: { variant: "neutral", label: "Caso cerrado" },
};
