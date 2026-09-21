import { useCallback, useRef, useState } from "react";
import { traducirErrorAuth } from "../utils/authErrors";
import { useCuentaRegresiva } from "./useCuentaRegresiva";

// Supabase no deja pedir otro correo de recuperación antes de 60 s; se espera lo
// mismo acá para que nadie toque "Reenviar" diez veces seguidas y reciba un
// error de límite en vez del correo.
const ESPERA_REENVIO_MS = 60000;

/**
 * Estado del envío del correo de recuperación de contraseña, compartido por la
 * pantalla de arrendatario y la de dueño.
 *
 * `enviado` pasa a true al primer envío exitoso y ya no vuelve a false: un
 * fallo al reenviar se muestra en `error` sin sacar a la persona de la
 * pantalla de confirmación. `etiquetaEspera` es "m:ss" mientras dura la espera
 * de reenvío. La espera es solo del lado del teléfono; el límite real lo
 * impone Supabase y llega como `error` traducido.
 */
export function useEnvioRecuperacion(resetPassword) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [enviado, setEnviado] = useState(false);
  const [correo, setCorreo] = useState(null);
  const [expiraEn, setExpiraEn] = useState(null);
  // La tecla "go" del teclado puede disparar dos envíos antes de que `loading`
  // (estado) llegue a renderizarse; la ref cierra esa ventana. `bloqueadoHasta`
  // es la misma espera que muestra la cuenta regresiva, leída sin depender del
  // último render.
  const enCurso = useRef(false);
  const bloqueadoHasta = useRef(0);
  const { restanteMs } = useCuentaRegresiva(expiraEn);

  const enviar = useCallback(
    async (email) => {
      if (enCurso.current || Date.now() < bloqueadoHasta.current) return;
      const destino = email.trim();
      if (!destino) {
        setError({ titulo: "Falta el correo", mensaje: "Ingresa el correo con el que te registraste." });
        return;
      }

      enCurso.current = true;
      setError(null);
      setLoading(true);
      try {
        await resetPassword(destino);
        bloqueadoHasta.current = Date.now() + ESPERA_REENVIO_MS;
        setExpiraEn(new Date(bloqueadoHasta.current).toISOString());
        setCorreo(destino);
        setEnviado(true);
      } catch (err) {
        setError({ titulo: "No se pudo enviar el correo", mensaje: traducirErrorAuth(err) });
      } finally {
        enCurso.current = false;
        setLoading(false);
      }
    },
    [resetPassword]
  );

  const limpiarError = useCallback(() => setError(null), []);

  const segundos = restanteMs === null ? null : Math.ceil(restanteMs / 1000);
  const etiquetaEspera =
    segundos === null ? null : `${Math.floor(segundos / 60)}:${String(segundos % 60).padStart(2, "0")}`;

  return {
    loading,
    error,
    enviado,
    correo,
    puedeReenviar: restanteMs === null || restanteMs === 0,
    etiquetaEspera,
    enviar,
    limpiarError,
  };
}
