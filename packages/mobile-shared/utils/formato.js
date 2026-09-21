/**
 * Utilidades de formateo y estandarización en tiempo real para RUTs y Teléfonos.
 */

/**
 * Formatea un RUT chileno en vivo mientras el usuario escribe (XX.XXX.XXX-X).
 * @param {string} texto
 * @returns {string}
 */
export function formatearRutEnVivo(texto) {
  if (!texto || typeof texto !== "string") return "";

  // Permitir solo dígitos y letra K, y CAPAR a 9 caracteres significativos
  // (8 del cuerpo + 1 dígito verificador). Sin este tope, pegar o tipear rápido
  // de más metía 20+ dígitos y el RUT quedaba "12.345.678.901.234-5".
  const limpio = texto.replace(/[^0-9kK]/g, "").toUpperCase().slice(0, 9);
  if (!limpio) return "";
  if (limpio.length === 1) return limpio;

  // Si tiene 2 o más caracteres, el último es el DV
  const cuerpo = limpio.slice(0, -1);
  const dv = limpio.slice(-1);

  // Formatear cuerpo con puntos de miles
  const cuerpoFmt = cuerpo.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${cuerpoFmt}-${dv}`;
}

/**
 * Formatea los 8 dígitos móviles de un teléfono chileno en bloques de 4 (XXXX XXXX).
 * Ideal para campos que ya muestran visualmente el prefijo "+56 9".
 * @param {string} texto
 * @returns {string}
 */
export function formatearTelefonoInput(texto) {
  if (!texto || typeof texto !== "string") return "";

  // Extraer solo dígitos
  let digitos = texto.replace(/\D/g, "");

  // Si el usuario pegó el número con 56 o 569, extraer solo los 8 dígitos móviles
  if (digitos.startsWith("569") && digitos.length >= 11) {
    digitos = digitos.slice(3, 11);
  } else if (digitos.startsWith("56") && digitos.length === 10) {
    digitos = digitos.slice(2, 10);
  } else if (digitos.startsWith("9") && digitos.length >= 9) {
    digitos = digitos.slice(1, 9);
  } else if (digitos.length > 8) {
    digitos = digitos.slice(-8);
  }

  // Limitar a máximo 8 dígitos
  digitos = digitos.slice(0, 8);

  if (digitos.length > 4) {
    return `${digitos.slice(0, 4)} ${digitos.slice(4)}`;
  }
  return digitos;
}

/**
 * Normaliza un número telefónico al formato estándar completo "+56 9 XXXX XXXX" para guardar en la BD.
 * @param {string} texto
 * @returns {string}
 */
export function normalizarTelefonoCompleto(texto) {
  if (!texto || typeof texto !== "string") return "";

  const digitos = texto.replace(/\D/g, "");
  if (!digitos) return "";

  let movil = digitos;
  if (digitos.startsWith("569") && digitos.length >= 11) {
    movil = digitos.slice(3, 11);
  } else if (digitos.startsWith("56") && digitos.length === 10) {
    movil = digitos.slice(2, 10);
  } else if (digitos.startsWith("9") && digitos.length >= 9) {
    movil = digitos.slice(1, 9);
  } else if (digitos.length >= 8) {
    movil = digitos.slice(-8);
  }

  if (movil.length === 8) {
    return `+56 9 ${movil.slice(0, 4)} ${movil.slice(4, 8)}`;
  } else if (movil.length > 4) {
    return `+56 9 ${movil.slice(0, 4)} ${movil.slice(4)}`;
  }
  return `+56 9 ${movil}`;
}

/**
 * Extrae solo los 8 dígitos móviles para mostrar en un input que ya tiene el prefijo "+56 9".
 * @param {string} tel
 * @returns {string}
 */
export function extraerMovilSinPrefijo(tel) {
  if (!tel || typeof tel !== "string") return "";
  const digitos = tel.replace(/\D/g, "");
  if (!digitos) return "";

  let movil = digitos;
  if (digitos.startsWith("569") && digitos.length >= 11) {
    movil = digitos.slice(3, 11);
  } else if (digitos.startsWith("56") && digitos.length === 10) {
    movil = digitos.slice(2, 10);
  } else if (digitos.startsWith("9") && digitos.length >= 9) {
    movil = digitos.slice(1, 9);
  } else if (digitos.length >= 8) {
    movil = digitos.slice(-8);
  }

  return formatearTelefonoInput(movil);
}

/**
 * Agrupa los miles con punto mientras el usuario escribe (25400 -> 25.400),
 * como se lee un kilometraje en Chile. Devuelve solo lo formateado: para
 * enviar al backend hay que volver a quedarse con los dígitos.
 * @param {string} texto
 * @returns {string}
 */
export function formatearMilesEnVivo(texto) {
  const digitos = String(texto ?? "").replace(/\D/g, "").replace(/^0+/, "");
  return digitos.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}
