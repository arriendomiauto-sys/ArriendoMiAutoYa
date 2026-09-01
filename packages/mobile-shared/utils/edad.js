/**
 * Edad real del usuario, leída de la cédula por el OCR del backend.
 *
 * En el registro la edad es solo una declaración marcada a mano; acá se
 * contrasta contra la fecha de nacimiento que el OCR extrae del carnet, que
 * es el dato que sirve para validar de verdad.
 *
 * El OCR devuelve la fecha en formatos distintos según la ruta: el mock
 * entrega ISO ("1992-05-14") y Google Vision devuelve el texto tal como
 * aparece impreso en la cédula ("14 MAY 1992", "14/05/1992", "14-05-1992").
 */

const MESES_ABREVIADOS = {
  ENE: 1, FEB: 2, MAR: 3, ABR: 4, MAY: 5, JUN: 6,
  JUL: 7, AGO: 8, SEP: 9, SEPT: 9, OCT: 10, NOV: 11, DIC: 12,
};

// Edades fuera de este rango significan que se leyó mal (o que la fecha
// capturada no era la de nacimiento): se tratan como "no se pudo leer" en
// vez de rechazar a alguien por un error del OCR.
const EDAD_MIN_PLAUSIBLE = 15;
const EDAD_MAX_PLAUSIBLE = 110;

/**
 * Convierte a Date la fecha de nacimiento que vino del OCR.
 * Devuelve null si no se puede interpretar.
 */
export function parsearFechaCarnet(valor) {
  if (valor instanceof Date) return isNaN(valor) ? null : valor;
  if (typeof valor !== "string") return null;

  const texto = valor.trim().toUpperCase();
  if (!texto) return null;

  // ISO: 1992-05-14
  const iso = texto.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (iso) return construir(Number(iso[1]), Number(iso[2]), Number(iso[3]));

  // Impreso en la cédula: 14/05/1992, 14-05-1992, 14 05 1992, 14 MAY 1992
  const partes = texto.match(/^(\d{1,2})[\/\-\s]([A-ZÁÉÍÓÚ]{3,4}|\d{1,2})[\/\-\s](\d{4})$/);
  if (!partes) return null;

  const dia = Number(partes[1]);
  const anio = Number(partes[3]);
  const mesTexto = partes[2];
  const mes = /^\d+$/.test(mesTexto) ? Number(mesTexto) : MESES_ABREVIADOS[mesTexto];
  if (!mes) return null;

  return construir(anio, mes, dia);
}

function construir(anio, mes, dia) {
  if (mes < 1 || mes > 12 || dia < 1 || dia > 31) return null;
  const d = new Date(anio, mes - 1, dia);
  // Rechaza fechas que no existen (31 de febrero se desborda a marzo).
  if (d.getFullYear() !== anio || d.getMonth() !== mes - 1 || d.getDate() !== dia) return null;
  return d;
}

/** Años cumplidos a la fecha `hoy`. */
export function calcularEdad(fechaNacimiento, hoy = new Date()) {
  const nacimiento = parsearFechaCarnet(fechaNacimiento);
  if (!nacimiento) return null;

  let edad = hoy.getFullYear() - nacimiento.getFullYear();
  const cumpleEsteAnio =
    hoy.getMonth() > nacimiento.getMonth() ||
    (hoy.getMonth() === nacimiento.getMonth() && hoy.getDate() >= nacimiento.getDate());
  if (!cumpleEsteAnio) edad -= 1;

  if (edad < EDAD_MIN_PLAUSIBLE || edad > EDAD_MAX_PLAUSIBLE) return null;
  return edad;
}

/**
 * Edad a partir de la respuesta de /enrolamiento/procesar-documentos.
 * null = el OCR no pudo leer la fecha (no es motivo para rechazar; el
 * backend ya manda esos casos a revisión manual).
 */
export function edadDesdeOcr(datosExtraidos) {
  return calcularEdad(datosExtraidos?.fecha_nacimiento);
}
