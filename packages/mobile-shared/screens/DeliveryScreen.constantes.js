// ================================================================ CONSTANTES
// Datos fijos y helpers puros del flujo de entrega/devolución. Viven aparte
// de DeliveryScreen.js para que la pantalla se quede solo con el estado, la
// cámara y el checklist. Nada de esto depende de hooks ni de props.

// Los 8 ángulos fotográficos del checklist. Cada entrada es un tramo del
// vehículo que se registra al entregar (y de nuevo al devolver, para poder
// comparar). El índice activo lo maneja DeliveryScreen.
export const ANGLES = [
  { id: 1, name: "Frontal", desc: "Parte delantera completa" },
  { id: 2, name: "Lateral izq.", desc: "Costado del conductor" },
  { id: 3, name: "Trasera", desc: "Parte trasera completa" },
  { id: 4, name: "Lateral der.", desc: "Costado del copiloto" },
  { id: 5, name: "Asientos", desc: "Asientos delanteros y traseros" },
  { id: 6, name: "Tablero int.", desc: "Consola central y volante" },
  { id: 7, name: "Maletero", desc: "Maletero abierto" },
  { id: 8, name: "Tablero km", desc: "Odómetro y combustible nítido" },
];

// Símbolo del selector -> valor que espera el backend
// (Literal["lleno","3/4","1/2","1/4","vacio"] en ChecklistRequest).
export const FUEL_SYMBOL_TO_VALUE = { E: "vacio", "¼": "1/4", "½": "1/2", "¾": "3/4", F: "lleno" };
export const FUEL_LEVELS = ["E", "¼", "½", "¾", "F"];

// La devolución es un recorrido de 3 pasos con avance visible; antes eran 7
// stages sueltos sin ninguna señal de cuánto faltaba.
export const PASOS = ["Verificar", "Inspeccionar", "Cerrar"];

// Tipos de diferencia reportables en la devolución (sección de daño).
export const TIPOS_DANO = ["Rayón", "Golpe", "Vidrio", "Neumático", "Interior", "Falta combustible"];

// Puntajes posibles al calificar al cliente (estrellas).
export const PUNTAJES_CALIFICACION = [1, 2, 3, 4, 5];

// Categorías de la tarjeta de Peritaje Asistido por IA. `clave` mira el
// campo homónimo en `analisisIA.probabilidades`; `label` es el rótulo.
export const CATEGORIAS_IA = [
  { clave: "rayon", label: "Rayón" },
  { clave: "abolladura", label: "Golpe" },
  { clave: "choque", label: "Choque" },
  { clave: "suciedad", label: "Suciedad" },
];

/** Formatea un monto CLP con el separador de miles chileno. Acepta `undefined` como 0. */
export const formatCLP = (monto) => `${(monto || 0).toLocaleString("es-CL")}`;