import { useCallback, useEffect, useRef, useState } from "react";
import { useApp } from "../../context/AppContext";
import { ApiClient } from "../../api/client";
import { supabase } from "../../api/supabase";
import { showAlert } from "../../utils/alert";
import { traducirErrorAuth } from "../../utils/authErrors";
import { normalizarTelefonoCompleto } from "../../utils/formato";
import { LARGO_CODIGO, MENSAJE_CODIGO, erroresCuenta } from "./validaciones";
import { useReferralCodeDetector } from "./useReferralCodeDetector";

export const PASO_CUENTA = "cuenta";
export const PASO_TERMINOS = "terminos";
export const PASO_CODIGO = "codigo";
export const PASO_EXITO = "exito";

/** Pasos con barra de progreso: 1) Datos de la cuenta 2) Términos y condiciones 3) Verificación por correo (el éxito ya es el final). */
export const TOTAL_PASOS = 3;
const ESPERA_REENVIO_S = 45;

const NUMERO_DE_PASO = { [PASO_CUENTA]: 1, [PASO_TERMINOS]: 2, [PASO_CODIGO]: 3 };

const nuevoCodigo = () => Array(LARGO_CODIGO).fill("");

/**
 * Estado y acciones del registro de cuenta, compartidos por la app de
 * arrendatario y la de dueño.
 *
 * Flujo en 2 pasos:
 *  1. "cuenta": nombre, apellido, correo, contraseña, celular y aceptación de términos.
 *               Al completar se valida, crea la cuenta en Supabase y envía el código.
 *  2. "codigo": verificación del correo con el código de 6 dígitos.
 *  Final: "exito".
 */
export function useRegistroCuenta({ role }) {
  const { register } = useApp();

  const [paso, setPaso] = useState(PASO_CUENTA);
  const [loading, setLoading] = useState(false);
  const enCurso = useRef(false);

  const { detectedCode, clearDetectedCode } = useReferralCodeDetector();
  const [codigoReferido, setCodigoReferido] = useState("");

  useEffect(() => {
    if (detectedCode && !codigoReferido) {
      setCodigoReferido(detectedCode);
    }
  }, [detectedCode]);

  const [form, setForm] = useState({ nombre: "", apellido: "", email: "", password: "", telefono: "" });
  // Los errores aparecen al salir de un campo o al intentar avanzar, no mientras
  // se escribe por primera vez.
  const [tocados, setTocados] = useState({});
  const [intentado, setIntentado] = useState(false);
  const [avisoCorreoExistente, setAvisoCorreoExistente] = useState(false);
  const [errorEnvio, setErrorEnvio] = useState(null);

  // Código de verificación
  const [codigo, setCodigo] = useState(nuevoCodigo);
  const [errorCodigo, setErrorCodigo] = useState(null);
  const [tiempoReenvio, setTiempoReenvio] = useState(ESPERA_REENVIO_S);
  const casillasRef = useRef([]);

  // Refs para que "Siguiente" del teclado salte al campo que sigue.
  const apellidoRef = useRef(null);
  const emailRef = useRef(null);
  const passwordRef = useRef(null);
  const telefonoRef = useRef(null);

  useEffect(() => {
    if (paso !== PASO_CODIGO || tiempoReenvio <= 0) return undefined;
    const id = setInterval(() => setTiempoReenvio((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(id);
  }, [paso, tiempoReenvio]);

  const cambiar = (campo) => (texto) => {
    if (campo === "email" && avisoCorreoExistente) setAvisoCorreoExistente(false);
    if (errorEnvio) setErrorEnvio(null);
    setForm((f) => ({ ...f, [campo]: texto }));
  };

  const alSalir = (campo) => () => setTocados((t) => ({ ...t, [campo]: true }));

  /** `{ error, invalid }` de un campo del formulario, listo para pasarle al input. */
  const campo = (nombre) => {
    const error = intentado || tocados[nombre] ? erroresCuenta(form)[nombre] : undefined;
    return { error: typeof error === "string" ? error : undefined, invalid: !!error };
  };

  // ---- Paso 1 -> 2: Valida datos, crea la cuenta y pasa directamente al paso de código ---
  const aceptarYCrear = async () => {
    setIntentado(true);
    const errores = erroresCuenta(form);
    if (errores.telefono && Object.keys(errores).length === 1) telefonoRef.current?.focus();
    if (Object.keys(errores).length > 0) return false;

    if (enCurso.current) return false;
    enCurso.current = true;
    setErrorEnvio(null);
    setLoading(true);
    try {
      await register(form.email.trim(), form.password, role);
      setCodigo(nuevoCodigo());
      setErrorCodigo(null);
      setTiempoReenvio(ESPERA_REENVIO_S);
      setPaso(PASO_CODIGO);
      return true;
    } catch (err) {
      if (err?.code === "already_registered") {
        setAvisoCorreoExistente(true);
        setPaso(PASO_CUENTA);
      } else {
        setErrorEnvio({ titulo: "No se pudo crear la cuenta", mensaje: traducirErrorAuth(err) });
      }
      return false;
    } finally {
      enCurso.current = false;
      setLoading(false);
    }
  };

  const validar = () => {
    setIntentado(true);
    const errores = erroresCuenta(form);
    if (errores.telefono && Object.keys(errores).length === 1) telefonoRef.current?.focus();
    return Object.keys(errores).length === 0;
  };

  const continuar = () => {
    if (!validar()) return false;
    setPaso(PASO_TERMINOS);
    return true;
  };

  // ---- Paso 3: código ------------------------------------------------------
  const cambiarDigito = (indice, valor) => {
    if (errorCodigo) setErrorCodigo(null);
    const digitos = String(valor || "").replace(/\D/g, "");
    // Pegar el código completo llena las seis casillas.
    if (digitos.length >= LARGO_CODIGO) {
      setCodigo(digitos.slice(0, LARGO_CODIGO).split(""));
      casillasRef.current[LARGO_CODIGO - 1]?.focus();
      return;
    }
    setCodigo((actual) => {
      const nuevo = [...actual];
      nuevo[indice] = digitos.slice(-1);
      return nuevo;
    });
    if (digitos && indice < LARGO_CODIGO - 1) casillasRef.current[indice + 1]?.focus();
  };

  const teclaDigito = (indice, evento) => {
    if (evento?.nativeEvent?.key === "Backspace" && !codigo[indice] && indice > 0) {
      setCodigo((actual) => {
        const nuevo = [...actual];
        nuevo[indice - 1] = "";
        return nuevo;
      });
      casillasRef.current[indice - 1]?.focus();
    }
  };

  const verificar = async () => {
    if (enCurso.current) return;
    const token = codigo.join("");
    if (token.length < LARGO_CODIGO) {
      setErrorCodigo(`Escribe los ${LARGO_CODIGO} dígitos que enviamos a tu correo.`);
      return;
    }

    enCurso.current = true;
    setLoading(true);
    try {
      const email = form.email.trim();
      let resultado = await supabase.auth.verifyOtp({ email, token, type: "signup" });
      if (resultado.error) resultado = await supabase.auth.verifyOtp({ email, token, type: "email" });
      if (resultado.error) throw resultado.error;

      // El perfil se completa con lo que se pidió acá; el RUT y la fecha de
      // nacimiento llegan después, desde la verificación de identidad.
      try {
        await ApiClient.actualizarPerfilBasico({
          nombre: `${form.nombre.trim()} ${form.apellido.trim()}`,
          telefono: normalizarTelefonoCompleto(form.telefono),
        });
      } catch (err) {
        console.warn("[Registro] No se pudo guardar el perfil básico:", err?.message);
      }

      if (codigoReferido && codigoReferido.trim()) {
        try {
          await ApiClient.aplicarCodigoReferido(codigoReferido.trim().toUpperCase());
          await clearDetectedCode();
        } catch (err) {
          console.warn("[Registro] No se pudo aplicar código de referido:", err?.message);
        }
      }
      setPaso(PASO_EXITO);
    } catch {
      setErrorCodigo(MENSAJE_CODIGO);
    } finally {
      enCurso.current = false;
      setLoading(false);
    }
  };

  const reenviar = async () => {
    if (tiempoReenvio > 0 || enCurso.current) return;
    enCurso.current = true;
    setLoading(true);
    try {
      await supabase.auth.resend({ type: "signup", email: form.email.trim() });
      setTiempoReenvio(ESPERA_REENVIO_S);
      setCodigo(nuevoCodigo());
      setErrorCodigo(null);
      showAlert("Código reenviado", `Enviamos un nuevo código a ${form.email.trim()}.`);
    } catch {
      showAlert("No se pudo reenviar", "Hubo un problema enviando el código. Inténtalo otra vez.");
    } finally {
      enCurso.current = false;
      setLoading(false);
    }
  };

  // ---- Navegación ----------------------------------------------------------
  const irACuenta = useCallback(() => setPaso(PASO_CUENTA), []);
  /**
   * Un paso atrás; desde el primero, `alSalirDelRegistro` (normalmente volver al
   * login). Desde el código se vuelve al paso 1 —para corregir el correo—, no a
   * los términos: aceptarlos otra vez crearía la cuenta de nuevo.
   */
  const volver = (alSalirDelRegistro) => {
    if (paso === PASO_CUENTA) alSalirDelRegistro?.();
    else setPaso(PASO_CUENTA);
  };

  return {
    paso,
    numeroDePaso: NUMERO_DE_PASO[paso] || TOTAL_PASOS,
    totalPasos: TOTAL_PASOS,
    loading,
    form,
    cambiar,
    alSalir,
    campo,
    refs: { apellidoRef, emailRef, passwordRef, telefonoRef },
    avisoCorreoExistente,
    errorEnvio,
    validar,
    continuar,
    aceptarYCrear,
    codigo: {
      digitos: codigo,
      casillasRef,
      error: errorCodigo,
      tiempoReenvio,
      cambiarDigito,
      teclaDigito,
      verificar,
      reenviar,
    },
    codigoReferido,
    setCodigoReferido,
    codigoDetectadoAutomaticamente: Boolean(detectedCode),
    irACuenta,
    volver,
  };
}
