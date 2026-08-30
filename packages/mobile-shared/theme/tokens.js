/**
 * Tokens de diseño compartidos — la escala única de espaciado, radios,
 * tipografía y sombras de toda la app. Las pantallas deben tomar de acá en
 * vez de repetir números sueltos, así el layout se ve parejo entre modos.
 *
 * Marca: teal pino (primary #0F3D3E) + menta (accent #2FBF9B) sobre crema
 * cálido (#FAFAF9). Los colores viven en ./colors; esto es todo lo demás.
 */

// Escala de espaciado en múltiplos de 4. `screen` es el margen lateral
// estándar de una pantalla; `gap` la separación por defecto entre bloques.
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  screen: 20,
  gap: 16,
};

// Radios de esquina. `card` para tarjetas y modales, `pill` para chips y
// botones redondeados, `field` para inputs.
export const radius = {
  sm: 8,
  field: 12,
  card: 16,
  lg: 20,
  pill: 999,
};

// Tipografía. Un solo tamaño de referencia por rol para que los títulos y
// textos no bailen de pantalla en pantalla.
export const typography = {
  display: { fontSize: 28, fontWeight: "700", letterSpacing: -0.5, lineHeight: 34 },
  title: { fontSize: 22, fontWeight: "700", letterSpacing: -0.3, lineHeight: 28 },
  heading: { fontSize: 18, fontWeight: "600", letterSpacing: -0.2, lineHeight: 24 },
  body: { fontSize: 15, fontWeight: "400", lineHeight: 22 },
  bodyStrong: { fontSize: 15, fontWeight: "600", lineHeight: 22 },
  callout: { fontSize: 13, fontWeight: "400", lineHeight: 18 },
  label: { fontSize: 12, fontWeight: "600", letterSpacing: 0.6, textTransform: "uppercase" },
  price: { fontSize: 20, fontWeight: "700", letterSpacing: -0.3 },
};

// Sombras. RN Web usa boxShadow; iOS/Android usan shadow*/elevation. Se
// entregan las dos formas y cada componente aplica la que corresponda.
export const shadow = {
  sm: {
    boxShadow: "0 1px 3px rgba(15, 61, 62, 0.08)",
    shadowColor: "#0F3D3E",
    shadowOpacity: 0.08,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  md: {
    boxShadow: "0 6px 18px rgba(15, 61, 62, 0.10)",
    shadowColor: "#0F3D3E",
    shadowOpacity: 0.1,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  lg: {
    boxShadow: "0 12px 30px rgba(15, 61, 62, 0.16)",
    shadowColor: "#0F3D3E",
    shadowOpacity: 0.16,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 8,
  },
};

// Altura estándar de controles táctiles.
export const control = {
  height: 52,
  heightSm: 44,
  hitSlop: { top: 8, bottom: 8, left: 8, right: 8 },
};

export const theme = { spacing, radius, typography, shadow, control };

export default theme;
