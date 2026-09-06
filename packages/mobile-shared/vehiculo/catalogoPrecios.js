/**
 * Catálogo de tipos de vehículo y tarifas de referencia (IVA 19% incluido).
 *
 * Las tarifas las fija RentACar por categoría y son CONFIGURABLES desde el
 * panel de administración (Configuración de plataforma → "Tarifas por
 * categoría", campo `tarifas_categoria`). Acá viven los valores por defecto:
 * si el panel todavía no definió un override — o el backend no responde — la
 * app usa estos. Ver `useCatalogoPrecios` para el enganche remoto.
 *
 * Regla de precio del dueño: cada categoría tiene un precio `base` fijado por
 * la plataforma. El dueño parte de ese `base` y SOLO puede bajarlo, en tramos
 * de $5.000, hasta el piso `min` de su categoría. Nada de montos sueltos: el
 * catálogo entrega los escalones ya redondeados y el control de tarifa no
 * acepta texto libre.
 */

export const PASO_PRECIO_CLP = 5000;
export const TARIFA_MINIMA_CLP = 15000; // piso absoluto de la plataforma
export const TARIFA_MAXIMA_CLP = 350000; // techo absoluto de la plataforma

/** Redondea al múltiplo de $5.000 más cercano dentro de un rango. */
function aTramo(monto, piso = TARIFA_MINIMA_CLP, techo = TARIFA_MAXIMA_CLP) {
  const num = typeof monto === "number" ? monto : parseInt(monto, 10);
  if (Number.isNaN(num) || num <= 0) return piso;
  const red = Math.round(num / PASO_PRECIO_CLP) * PASO_PRECIO_CLP;
  return Math.max(piso, Math.min(techo, red));
}

/**
 * Tarifas por defecto, por categoría. `base` = precio fijado por RentACar y
 * tope para el dueño; `min` = piso hasta donde puede descontar. Ambos en CLP,
 * múltiplos de $5.000. Es la MISMA forma que guarda el panel en
 * `configuracion.tarifas_categoria`.
 */
export const TARIFAS_CATEGORIA_DEFAULT = {
  economico: { base: 40000, min: 25000 },
  sedan: { base: 55000, min: 35000 },
  suv: { base: 80000, min: 45000 },
  camioneta: { base: 95000, min: 55000 },
  premium: { base: 180000, min: 80000 },
};

// Datos fijos de cada categoría (nombre, ejemplos, ícono). Lo que NO cambia
// desde el panel — solo las tarifas.
const CATEGORIAS_BASE = [
  {
    id: "economico",
    label: "Económico / Citycar",
    labelCorto: "Económico",
    descripcion: "Hatchback y autos compactos de bajo consumo.",
    icon: "car",
    ejemplos: "Suzuki Swift, Hyundai Grand i10, Kia Morning, Chevrolet Spark",
  },
  {
    id: "sedan",
    label: "Sedán",
    labelCorto: "Sedán",
    descripcion: "Autos de 4 puertas con maletero independiente y confort familiar.",
    icon: "car",
    ejemplos: "Toyota Yaris, Hyundai Accent, Nissan Versa, Kia Rio",
  },
  {
    id: "suv",
    label: "SUV / Crossover",
    labelCorto: "SUV",
    descripcion: "Vehículos familiares altos, espaciosos y versátiles.",
    icon: "shield",
    ejemplos: "Toyota RAV4, Hyundai Tucson, Kia Sportage, Haval Jolion",
  },
  {
    id: "camioneta",
    label: "Camioneta / Pickup",
    labelCorto: "Camioneta",
    descripcion: "Pickups de trabajo, turismo aventura o tracción 4x4.",
    icon: "shield",
    ejemplos: "Toyota Hilux, Mitsubishi L200, Ford Ranger, Maxus T60",
  },
  {
    id: "premium",
    label: "Premium / Alta Gama",
    labelCorto: "Premium",
    descripcion: "Vehículos ejecutivos, deportivos o de marcas de lujo.",
    icon: "star",
    ejemplos: "BMW Serie 3, Mercedes-Benz Clase C, Audi Q5, Porsche Macan",
  },
];

/**
 * Escalones de tarifa que puede elegir el dueño: del `base` hacia abajo, de
 * $5.000 en $5.000, hasta `min`. Descendente, ya redondeado.
 */
export function escalonesTarifa(min, base) {
  const piso = aTramo(min);
  const techo = aTramo(base);
  const escalones = [];
  for (let v = techo; v >= piso; v -= PASO_PRECIO_CLP) escalones.push(v);
  if (!escalones.length) escalones.push(piso);
  return escalones;
}

/** Deja un monto dentro de [min, base] y cuadrado a $5.000. */
export function clampTarifa(valor, { min, base }) {
  return aTramo(valor, aTramo(min), aTramo(base));
}

/**
 * Construye la lista de categorías fusionando los datos fijos con las tarifas
 * (las del panel si llegan, si no las de `TARIFAS_CATEGORIA_DEFAULT`). Cada
 * ítem trae `base`, `min` y `escalones`, más alias de compatibilidad
 * (`rangoMin`/`rangoMax`/`tarifaDefault`/`preciosSugeridos`).
 */
export function aplicarTarifasConfig(overrides) {
  const cfg = overrides && typeof overrides === "object" ? overrides : {};
  return CATEGORIAS_BASE.map((cat) => {
    const def = TARIFAS_CATEGORIA_DEFAULT[cat.id] || {};
    const ov = cfg[cat.id] || {};
    const base = aTramo(ov.base ?? def.base);
    const minPedido = aTramo(ov.min ?? def.min);
    const min = Math.min(minPedido, base); // el piso nunca por sobre el tope
    const escalones = escalonesTarifa(min, base);
    return {
      ...cat,
      base,
      min,
      escalones,
      // Alias de compatibilidad con consumidores antiguos.
      rangoMin: min,
      rangoMax: base,
      tarifaDefault: base,
      preciosSugeridos: escalones,
    };
  });
}

/** Lista de categorías con las tarifas por defecto. */
export const TIPOS_VEHICULO = aplicarTarifasConfig(TARIFAS_CATEGORIA_DEFAULT);

/**
 * Config de una categoría por id. Acepta una lista ya fusionada (la del hook)
 * para no re-mezclar; si no se pasa, usa la de defaults.
 */
export function obtenerConfiguracionTipo(tipoId, lista = TIPOS_VEHICULO) {
  return lista.find((t) => t.id === tipoId) || lista[1] || TIPOS_VEHICULO[1];
}

/**
 * Redondea al múltiplo de $5.000 más cercano respetando los límites de la
 * plataforma. Se mantiene por compatibilidad; el asistente usa `clampTarifa`.
 */
export function redondearATramo5000(monto) {
  return aTramo(monto);
}

/**
 * Desglose tributario y liquidación del dueño para una tarifa diaria bruta
 * (IVA incluido).
 */
export function calcularDesgloseIva(tarifaConIva) {
  const bruta = aTramo(tarifaConIva);
  const neto = Math.round(bruta / 1.19);
  const iva = bruta - neto;
  const comision = Math.round(bruta * 0.2);
  const ganancia = Math.round(bruta * 0.8);
  return {
    tarifaBruta: bruta,
    subtotalNeto: neto,
    ivaMonto: iva,
    comisionPlataforma: comision,
    gananciaDueno: ganancia,
  };
}
