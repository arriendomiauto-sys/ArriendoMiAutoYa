/**
 * Reglas de los campos del registro de cuenta (arrendatario y dueño).
 *
 * El registro NO pide RUT ni fecha de nacimiento: esos datos salen de la cédula
 * durante la verificación de identidad (KYC). Cada `error*` devuelve el mensaje
 * que se muestra bajo el campo, o `null` si el valor está bien.
 */

const LETRAS = /[A-Za-zÁÉÍÓÚÜáéíóúüÑñ]/;
const CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const MENSAJE_NOMBRE = "Escribe tu nombre como aparece en tu cédula.";
export const MENSAJE_APELLIDO = "Escribe tu apellido como aparece en tu cédula.";
export const MENSAJE_CORREO = "Escribe un correo válido, como nombre@correo.cl.";
export const MENSAJE_CELULAR = "El celular tiene 9 dígitos y empieza con 9.";
export const MENSAJE_CELULAR_OCUPADO = "Este celular ya tiene una cuenta. Inicia sesión con ella.";
export const MENSAJE_CODIGO = "El código no coincide o venció. Pide uno nuevo.";
export const LARGO_CODIGO = 6;

/** Un nombre o apellido: con letras y sin números, como figura en la cédula. */
function errorTexto(valor, mensaje) {
  const texto = (valor || "").trim();
  if (!texto || !LETRAS.test(texto) || /\d/.test(texto)) return mensaje;
  return null;
}

export const errorNombre = (valor) => errorTexto(valor, MENSAJE_NOMBRE);
export const errorApellido = (valor) => errorTexto(valor, MENSAJE_APELLIDO);

export function errorCorreo(valor) {
  return CORREO.test((valor || "").trim()) ? null : MENSAJE_CORREO;
}

/** Las tres reglas de la contraseña, para marcarlas una a una mientras se escribe. */
export function reglasContrasena(valor = "") {
  return {
    largo: valor.length >= 8,
    letra: LETRAS.test(valor),
    numero: /\d/.test(valor),
  };
}

export function contrasenaValida(valor) {
  const r = reglasContrasena(valor);
  return r.largo && r.letra && r.numero;
}

/** Solo dígitos del celular, sin el 56 del país si vino pegado. */
export function digitosCelular(texto) {
  let digitos = String(texto || "").replace(/\D/g, "");
  if (digitos.startsWith("569") && digitos.length > 9) digitos = digitos.slice(2);
  return digitos.slice(0, 9);
}

/** Muestra el celular agrupado como 9 1234 5678 (el +56 va aparte, fijo). */
export function formatearCelular(texto) {
  const d = digitosCelular(texto);
  if (d.length <= 1) return d;
  if (d.length <= 5) return `${d.slice(0, 1)} ${d.slice(1)}`;
  return `${d.slice(0, 1)} ${d.slice(1, 5)} ${d.slice(5)}`;
}

export function errorCelular(valor) {
  const d = digitosCelular(valor);
  return d.length === 9 && d.startsWith("9") ? null : MENSAJE_CELULAR;
}

/**
 * Errores del paso "Tu cuenta" por campo (solo los campos con error). El valor
 * es el mensaje a mostrar; la contraseña va en `true` porque no lleva mensaje
 * aparte: sus tres reglas ya se marcan en vivo bajo el campo.
 */
export function erroresCuenta(form) {
  const errores = {};
  const nombre = errorNombre(form.nombre);
  const apellido = errorApellido(form.apellido);
  const correo = errorCorreo(form.email);
  const celular = errorCelular(form.telefono);
  if (nombre) errores.nombre = nombre;
  if (apellido) errores.apellido = apellido;
  if (correo) errores.email = correo;
  if (!contrasenaValida(form.password)) errores.password = true;
  if (celular) errores.telefono = celular;
  return errores;
}
