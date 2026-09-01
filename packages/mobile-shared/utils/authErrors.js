/**
 * Los errores de Supabase Auth (login, registro, recuperar clave) vienen en
 * inglés y a veces son crípticos ("AuthApiError: Invalid login
 * credentials"). El resto de la app está en español — mostrar ese texto
 * crudo directo en un showAlert() es justo el tipo de mensaje incoherente
 * que rompe la experiencia. Esto traduce los casos conocidos a algo que un
 * usuario entienda, y da un mensaje genérico razonable para el resto en
 * vez de exponer el error interno tal cual.
 */
const REGLAS = [
  [/invalid login credentials/i, "El correo o la contraseña no son correctos."],
  [/email not confirmed/i, "Debes confirmar tu correo antes de iniciar sesión. Revisa tu bandeja de entrada."],
  [/user already registered|already been registered/i, "Ya existe una cuenta con este correo. Intenta iniciar sesión."],
  [/password should be at least/i, "La contraseña debe tener al menos 6 caracteres."],
  [/password.*(exceeds|too long|at most|72 bytes)/i, "La contraseña es demasiado larga (máximo 72 caracteres)."],
  [/signup requires a valid password/i, "Debes ingresar una contraseña válida."],
  [/unable to validate email address|invalid email/i, "El formato del correo no es válido."],
  [/email rate limit exceeded/i, "Se enviaron demasiados correos a esta dirección. Espera unos minutos e intenta de nuevo."],
  [/rate limit/i, "Demasiados intentos. Espera unos segundos antes de volver a intentarlo."],
  [/for security purposes/i, "Por seguridad debes esperar unos segundos antes de volver a intentarlo."],
  [/user not found/i, "No encontramos una cuenta con ese correo."],
  [/failed to fetch|network request failed|load failed/i, "No se pudo conectar. Revisa tu conexión a internet e intenta de nuevo."],
];

export function traducirErrorAuth(err) {
  const mensaje = typeof err === "string" ? err : err?.message || "";
  for (const [patron, traduccion] of REGLAS) {
    if (patron.test(mensaje)) return traduccion;
  }
  return "No se pudo completar la operación. Intenta de nuevo en unos segundos.";
}
