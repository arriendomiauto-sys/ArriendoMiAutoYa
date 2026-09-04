/**
 * Catálogo de marcas y modelos con venta real en Chile.
 *
 * El autocompletado tenía 45 marcas y ningún modelo, así que el dueño escribía
 * el modelo a mano: "Grand i10", "grand i 10", "GRAND I10" y "Grand-i10"
 * terminaban siendo cuatro autos distintos para el buscador, y el arrendatario
 * que filtraba por uno no encontraba los otros tres.
 *
 * No pretende ser exhaustivo — ningún catálogo escrito a mano lo es. Cubre lo
 * que circula y se arrienda: por eso hay más modelos en Chevrolet, Hyundai,
 * Kia, Suzuki y Toyota que en Porsche. El campo sigue aceptando texto libre
 * para el auto que no esté en la lista.
 */

export const MODELOS_POR_MARCA = {
  Audi: ["A1", "A3", "A4", "A5", "Q2", "Q3", "Q5", "Q7"],
  BAIC: ["D20", "X25", "X35", "X55", "Senova"],
  BMW: ["Serie 1", "Serie 2", "Serie 3", "Serie 4", "Serie 5", "X1", "X2", "X3", "X4", "X5"],
  BYD: ["Dolphin", "Han", "Seal", "Song Plus", "Tang", "Yuan Plus"],
  Changan: ["Alsvin", "CS15", "CS35 Plus", "CS55", "CS75", "Eado", "Hunter"],
  Chery: ["Arrizo 5", "Tiggo 2", "Tiggo 3", "Tiggo 4 Pro", "Tiggo 7 Pro", "Tiggo 8 Pro"],
  Chevrolet: [
    "Aveo", "Blazer", "Cavalier", "Captiva", "Colorado", "Cruze", "Groove", "Onix",
    "Sail", "Spark", "Spark GT", "Tahoe", "Tracker", "Trailblazer", "Traverse", "N400",
  ],
  Chrysler: ["300", "Pacifica"],
  Citroën: ["C3", "C4 Cactus", "C5 Aircross", "Berlingo"],
  DFSK: ["Glory 500", "Glory 580", "K01", "C31"],
  Dodge: ["Attitude", "Journey", "Durango"],
  Fiat: ["Argo", "Cronos", "Mobi", "Pulse", "Strada", "Toro"],
  Ford: ["EcoSport", "Escape", "Explorer", "F-150", "Fiesta", "Focus", "Maverick", "Ranger", "Territory"],
  Foton: ["Tunland", "View", "Sauvana"],
  "Great Wall": ["Poer", "Wingle 5", "Wingle 7"],
  Haval: ["H6", "Jolion", "Dargo"],
  Honda: ["Accord", "City", "Civic", "CR-V", "Fit", "HR-V", "Pilot", "WR-V"],
  Hyundai: [
    "Accent", "Creta", "Elantra", "Grand i10", "HB20", "i10", "i20", "Kona",
    "Palisade", "Santa Fe", "Sonata", "Tucson", "Venue", "Veloster",
  ],
  Isuzu: ["D-Max", "MU-X"],
  JAC: ["JS2", "JS3", "JS4", "T6", "T8"],
  Jeep: ["Cherokee", "Compass", "Grand Cherokee", "Renegade", "Wrangler"],
  Jetour: ["Dashing", "X70", "X70 Plus", "X90"],
  Kia: [
    "Carnival", "Cerato", "K3", "Morning", "Niro", "Picanto", "Rio", "Seltos",
    "Sonet", "Sorento", "Soul", "Sportage", "Stonic",
  ],
  "Land Rover": ["Defender", "Discovery", "Discovery Sport", "Range Rover Evoque", "Range Rover Sport"],
  Lexus: ["ES", "NX", "RX", "UX"],
  Mahindra: ["KUV100", "Pik Up", "Scorpio", "XUV300"],
  Maxus: ["T60", "T90", "D60", "G10"],
  Mazda: ["2", "3", "6", "BT-50", "CX-3", "CX-30", "CX-5", "CX-60", "CX-9"],
  "Mercedes-Benz": ["Clase A", "Clase B", "Clase C", "Clase E", "GLA", "GLB", "GLC", "GLE", "Vito"],
  MG: ["3", "5", "HS", "RX5", "ZS", "MG4"],
  Mini: ["Cooper", "Countryman"],
  Mitsubishi: ["ASX", "Eclipse Cross", "L200", "Montero", "Montero Sport", "Outlander", "Xpander"],
  Nissan: [
    "Frontier", "Kicks", "Leaf", "March", "Navara", "Note", "Qashqai", "Sentra",
    "Terrano", "Versa", "X-Trail",
  ],
  Opel: ["Corsa", "Crossland", "Grandland", "Mokka"],
  Peugeot: ["208", "2008", "301", "3008", "308", "5008", "Partner", "Landtrek"],
  Porsche: ["911", "Cayenne", "Macan", "Panamera"],
  RAM: ["1200", "1500", "2500", "700"],
  Renault: ["Captur", "Duster", "Kangoo", "Kardian", "Koleos", "Kwid", "Logan", "Oroch", "Sandero", "Stepway"],
  Skoda: ["Fabia", "Kamiq", "Karoq", "Kodiaq", "Octavia", "Scala"],
  SsangYong: ["Actyon", "Korando", "Musso", "Rexton", "Tivoli"],
  Subaru: ["Crosstrek", "Forester", "Impreza", "Legacy", "Outback", "WRX", "XV"],
  Suzuki: [
    "Alto", "Baleno", "Celerio", "Ciaz", "Dzire", "Ertiga", "Fronx", "Grand Vitara",
    "Ignis", "Jimny", "S-Cross", "Swift", "Vitara", "XL7",
  ],
  Toyota: [
    "4Runner", "C-HR", "Corolla", "Corolla Cross", "Fortuner", "Hilux", "Land Cruiser",
    "Prius", "RAV4", "Rush", "Yaris", "Yaris Cross", "Yaris Sedán",
  ],
  Volkswagen: [
    "Amarok", "Gol", "Golf", "Jetta", "Nivus", "Polo", "Saveiro", "T-Cross",
    "Taos", "Tiguan", "Touareg", "Virtus", "Voyage",
  ],
  Volvo: ["S60", "V40", "XC40", "XC60", "XC90"],
};

/** Marcas ordenadas alfabéticamente, como se muestran en el selector. */
export const MARCAS = Object.keys(MODELOS_POR_MARCA).sort((a, b) => a.localeCompare(b, "es"));

/**
 * Compara ignorando mayúsculas, tildes y separadores.
 *
 * "Grand i10", "grand-i10" y "GRAND I 10" son el mismo auto; sin esto el
 * autocompletado no encontraba lo que el dueño ya había escrito bien.
 */
function normalizar(texto) {
  return (texto || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

/** Marcas que coinciden con lo escrito. Sin texto, devuelve todas. */
export function buscarMarcas(consulta) {
  const q = normalizar(consulta);
  if (!q) return MARCAS;
  const empiezan = MARCAS.filter((m) => normalizar(m).startsWith(q));
  const contienen = MARCAS.filter((m) => !normalizar(m).startsWith(q) && normalizar(m).includes(q));
  // Lo que empieza igual va primero: escribiendo "to" interesa Toyota antes
  // que Foton, aunque las dos contengan "to".
  return [...empiezan, ...contienen];
}

/**
 * Modelos de una marca que coinciden con lo escrito.
 *
 * Si la marca no está en el catálogo devuelve [] y el campo queda como texto
 * libre: es preferible a sugerir los modelos de otra marca.
 */
export function buscarModelos(marca, consulta) {
  const marcaExacta = MARCAS.find((m) => normalizar(m) === normalizar(marca));
  const modelos = marcaExacta ? MODELOS_POR_MARCA[marcaExacta] : [];
  const q = normalizar(consulta);
  if (!q) return modelos;
  const empiezan = modelos.filter((m) => normalizar(m).startsWith(q));
  const contienen = modelos.filter((m) => !normalizar(m).startsWith(q) && normalizar(m).includes(q));
  return [...empiezan, ...contienen];
}

/** `true` si el texto corresponde exactamente a una marca del catálogo. */
export function esMarcaConocida(marca) {
  return MARCAS.some((m) => normalizar(m) === normalizar(marca));
}

/** Nombre canónico de la marca ("toyota" → "Toyota"), o el texto tal cual. */
export function normalizarMarca(marca) {
  return MARCAS.find((m) => normalizar(m) === normalizar(marca)) || marca;
}
