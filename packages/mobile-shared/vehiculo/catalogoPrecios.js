/**
 * Catálogo de tipos de vehículo y lista de precios de referencia con IVA incluido (19%).
 *
 * Todas las tarifas diarias se manejan en múltiplos de $5.000 CLP para mantener
 * precios limpios y consistentes en el marketplace.
 */

export const TIPOS_VEHICULO = [
  {
    id: "economico",
    label: "Económico / Citycar",
    labelCorto: "Económico",
    descripcion: "Hatchback y autos compactos de bajo consumo.",
    icon: "car",
    rangoMin: 25000,
    rangoMax: 40000,
    tarifaDefault: 30000,
    preciosSugeridos: [25000, 30000, 35000, 40000],
    ejemplos: "Suzuki Swift, Hyundai Grand i10, Kia Morning, Spark",
  },
  {
    id: "sedan",
    label: "Sedán",
    labelCorto: "Sedán",
    descripcion: "Autos de 4 puertas con maletero independiente y confort familiar.",
    icon: "car",
    rangoMin: 35000,
    rangoMax: 55000,
    tarifaDefault: 40000,
    preciosSugeridos: [35000, 40000, 45000, 50000, 55000],
    ejemplos: "Toyota Yaris, Hyundai Accent, Nissan Versa, Kia Rio",
  },
  {
    id: "suv",
    label: "SUV / Crossover",
    labelCorto: "SUV",
    descripcion: "Vehículos familiares altos, espaciosos y versátiles.",
    icon: "shield",
    rangoMin: 45000,
    rangoMax: 80000,
    tarifaDefault: 55000,
    preciosSugeridos: [45000, 50000, 55000, 60000, 65000, 70000, 80000],
    ejemplos: "Toyota RAV4, Hyundai Tucson, Kia Sportage, Haval Jolion",
  },
  {
    id: "camioneta",
    label: "Camioneta / Pickup",
    labelCorto: "Camioneta",
    descripcion: "Pickups de trabajo, turismo aventura o tracción 4x4.",
    icon: "shield",
    rangoMin: 55000,
    rangoMax: 95000,
    tarifaDefault: 65000,
    preciosSugeridos: [55000, 60000, 65000, 70000, 75000, 85000, 95000],
    ejemplos: "Toyota Hilux, Mitsubishi L200, Ford Ranger, Maxus T60",
  },
  {
    id: "premium",
    label: "Premium / Alta Gama",
    labelCorto: "Premium",
    descripcion: "Vehículos ejecutivos, deportivos o de marcas de lujo.",
    icon: "star",
    rangoMin: 80000,
    rangoMax: 180000,
    tarifaDefault: 95000,
    preciosSugeridos: [80000, 90000, 95000, 110000, 130000, 150000, 180000],
    ejemplos: "BMW Serie 3, Mercedes-Benz Clase C, Audi Q5, Porsche",
  },
];

export const PASO_PRECIO_CLP = 5000;
export const TARIFA_MINIMA_CLP = 15000;
export const TARIFA_MAXIMA_CLP = 350000;

/**
 * Redondea un monto al múltiplo de $5.000 más cercano, respetando los límites de la plataforma.
 * @param {number|string} monto
 * @returns {number}
 */
export function redondearATramo5000(monto) {
  const num = typeof monto === "number" ? monto : parseInt(monto, 10);
  if (Number.isNaN(num) || num <= 0) return TIPOS_VEHICULO[1].tarifaDefault; // default sedán
  const redondeado = Math.round(num / PASO_PRECIO_CLP) * PASO_PRECIO_CLP;
  return Math.max(TARIFA_MINIMA_CLP, Math.min(TARIFA_MAXIMA_CLP, redondeado));
}

/**
 * Obtiene la configuración de precios y datos de un tipo de vehículo.
 * @param {string} tipoId
 * @returns {object}
 */
export function obtenerConfiguracionTipo(tipoId) {
  const encontrado = TIPOS_VEHICULO.find((t) => t.id === tipoId);
  return encontrado || TIPOS_VEHICULO[1]; // default sedán
}

/**
 * Calcula el desglose tributario y la liquidación del dueño para una tarifa diaria bruta (IVA incluido).
 * @param {number|string} tarifaConIva
 * @returns {{ tarifaBruta: number, subtotalNeto: number, ivaMonto: number, comisionPlataforma: number, gananciaDueno: number }}
 */
export function calcularDesgloseIva(tarifaConIva) {
  const bruta = redondearATramo5000(tarifaConIva);
  const neto = Math.round(bruta / 1.19);
  const iva = bruta - neto;
  const comision = Math.round(bruta * 0.20);
  const ganancia = Math.round(bruta * 0.80);

  return {
    tarifaBruta: bruta,
    subtotalNeto: neto,
    ivaMonto: iva,
    comisionPlataforma: comision,
    gananciaDueno: ganancia,
  };
}
