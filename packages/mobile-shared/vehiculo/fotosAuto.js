/**
 * Las 9 fotos que se piden al publicar un auto, una por tarjeta y con su
 * propia cámara guiada — el mismo trato que el KYC de identidad, en vez de
 * un "sube algunas fotos" que dejaba fichas con dos imágenes borrosas.
 *
 * `camara` es la configuración que recibe <DocumentCameraModal>: título y
 * ayuda que se muestran sobre el visor, y si esa toma lleva la patente a la
 * vista (frontal y trasera), que se tapa antes de subirla.
 */
export const FOTOS_AUTO = [
  {
    key: "frontal",
    titulo: "Frontal",
    ayuda: "De frente, auto completo",
    icon: "car",
    camara: {
      titulo: "Frente del auto",
      hint: "Auto completo de frente dentro del marco. La patente va en la franja marcada: la tapamos antes de publicar.",
      censurarPatente: true,
    },
  },
  {
    key: "trasera",
    titulo: "Trasera",
    ayuda: "Por detrás, auto completo",
    icon: "car",
    camara: {
      titulo: "Parte trasera",
      hint: "Toda la parte trasera dentro del marco. Deja la patente en la franja marcada para taparla.",
      censurarPatente: true,
    },
  },
  {
    key: "lateral_izquierdo",
    titulo: "Lateral izquierdo",
    ayuda: "Costado del conductor",
    icon: "car",
    camara: {
      titulo: "Lateral izquierdo",
      hint: "Párate a unos 3 metros y toma el costado completo, de parachoques a parachoques.",
    },
  },
  {
    key: "lateral_derecho",
    titulo: "Lateral derecho",
    ayuda: "Costado del acompañante",
    icon: "car",
    camara: {
      titulo: "Lateral derecho",
      hint: "El otro costado completo, a la misma distancia y con buena luz.",
    },
  },
  {
    key: "interior_delantero",
    titulo: "Interior delantero",
    ayuda: "Asientos delanteros",
    icon: "user",
    camara: {
      titulo: "Asientos delanteros",
      hint: "Desde la puerta del conductor: butacas, palanca y consola central.",
    },
  },
  {
    key: "interior_trasero",
    titulo: "Interior trasero",
    ayuda: "Asientos traseros",
    icon: "user",
    camara: {
      titulo: "Asientos traseros",
      hint: "Desde la puerta trasera: banca completa y espacio para las piernas.",
    },
  },
  {
    key: "maletero",
    titulo: "Maletero",
    ayuda: "Capacidad de carga",
    icon: "maletero",
    camara: {
      titulo: "Maletero",
      hint: "Maletero abierto y vacío, para que se vea el espacio real.",
    },
  },
  {
    key: "tablero",
    titulo: "Panel / tablero",
    ayuda: "Con el kilometraje visible",
    icon: "kilometraje",
    camara: {
      titulo: "Panel de instrumentos",
      hint: "Tablero encendido: que se lean el kilometraje y el nivel de combustible.",
    },
  },
  {
    key: "limpieza",
    titulo: "Limpieza",
    ayuda: "Estado de aseo del interior",
    icon: "check",
    camara: {
      titulo: "Estado de limpieza",
      hint: "Tapiz y alfombras como se entrega el auto: es la referencia si después hay que cobrar lavado.",
    },
  },
];

export const TOTAL_FOTOS_AUTO = FOTOS_AUTO.length;
