import { useCallback, useRef, useState } from "react";
import { esErrorCredenciales, traducirErrorAuth } from "../utils/authErrors";

// Pasado este tiempo sin respuesta de `login` se libera el formulario y se avisa
// de un problema de red, en vez de dejar el botón girando para siempre.
const TIMEOUT_LOGIN_MS = 15000;

const TIMEOUT = Symbol("timeout-login");

/**
 * Estado del envío del formulario de login, compartido por la pantalla de
 * arrendatario y la de dueño.
 *
 * `error` es `{ titulo, mensaje, campo }` o `null`; `campo: "password"` indica
 * que hay que marcar la contraseña (solo cuando Supabase rechazó las
 * credenciales). `signInWithPassword` no se puede cancelar: si vence el timeout
 * y el login termina bien después, la sesión igual se abre y el padre deja de
 * mostrar el login, igual que antes.
 */
export function useEnvioLogin(login) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  // El botón y la tecla "go" del teclado pueden disparar dos envíos antes de que
  // `loading` (estado) llegue a renderizarse; la ref cierra esa ventana.
  const enCurso = useRef(false);

  const enviar = useCallback(
    async (email, password) => {
      if (enCurso.current) return;
      const correo = email.trim();
      if (!correo || !password.trim()) {
        setError({ titulo: "Faltan datos", mensaje: "Ingresa tu correo y tu contraseña.", campo: null });
        return;
      }

      enCurso.current = true;
      setError(null);
      setLoading(true);
      let idTimeout;
      try {
        const vencido = new Promise((resolve) => {
          idTimeout = setTimeout(() => resolve(TIMEOUT), TIMEOUT_LOGIN_MS);
        });
        const resultado = await Promise.race([login(correo, password), vencido]);
        if (resultado === TIMEOUT) {
          setError({
            titulo: "Sin respuesta",
            mensaje: "Revisa tu conexión a internet e inténtalo de nuevo.",
            campo: null,
          });
        }
      } catch (err) {
        setError(
          esErrorCredenciales(err)
            ? {
                titulo: "Correo o contraseña incorrectos",
                mensaje: "Revisa los datos e inténtalo de nuevo, o cambia tu contraseña.",
                campo: "password",
              }
            : { titulo: "No se pudo iniciar sesión", mensaje: traducirErrorAuth(err), campo: null }
        );
      } finally {
        clearTimeout(idTimeout);
        enCurso.current = false;
        setLoading(false);
      }
    },
    [login]
  );

  const limpiarError = useCallback(() => setError(null), []);

  return { loading, error, enviar, limpiarError };
}
