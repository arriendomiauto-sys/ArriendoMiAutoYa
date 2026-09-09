/**
 * Formateo de direcciones chilenas a partir del resultado de
 * `Location.reverseGeocodeAsync` (expo-location).
 *
 * Formato de salida:  "calle número, ciudad, comuna, región"
 *
 *  - "calle número": `street` + `streetNumber` (o `name` si no viene la calle).
 *  - "comuna": solo se agrega si es distinta de la ciudad — en Chile muchísimas
 *    ciudades y comunas se llaman igual (Los Ángeles, Osorno, Rancagua...), y
 *    repetirlo ensucia la dirección.
 *  - Ningún nivel se repite y los vacíos se descartan.
 */

function _limpio(valor) {
  return typeof valor === "string" ? valor.trim() : "";
}

/**
 * @param {object|null} geo  un elemento del array que devuelve `reverseGeocodeAsync`
 * @returns {string}  la dirección formateada, o "" si no hay datos usables
 */
export function formatearDireccionChile(geo) {
  if (!geo || typeof geo !== "object") return "";

  // Bloque 1: calle y número. iOS a veces mete "Calle 123" completo en `name`;
  // si el número ya está en la calle no se repite.
  const calle = _limpio(geo.street) || _limpio(geo.name);
  const numero = _limpio(geo.streetNumber);
  const calleNumero =
    numero && calle && !calle.includes(numero) ? `${calle} ${numero}` : calle;

  // Bloque 2: ciudad, comuna y región. Los nombres de comuna llegan en
  // `district` (Android) o `subregion` según el dispositivo.
  const ciudad = _limpio(geo.city) || _limpio(geo.subregion);
  const comuna = _limpio(geo.district) || _limpio(geo.subregion) || _limpio(geo.city);
  const region = _limpio(geo.region);

  // Bloque 3: armado sin repetir niveles (comparación sin distinguir mayúsculas).
  const partes = [];
  const agregar = (valor) => {
    if (!valor) return;
    if (partes.some((p) => p.toLowerCase() === valor.toLowerCase())) return;
    partes.push(valor);
  };

  agregar(calleNumero);
  agregar(ciudad);
  if (comuna && comuna.toLowerCase() !== ciudad.toLowerCase()) agregar(comuna);
  agregar(region);

  return partes.join(", ");
}

export default formatearDireccionChile;
