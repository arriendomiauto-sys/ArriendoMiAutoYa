/**
 * Sistema de Color Oficial - Arriendo Mi Auto Ya
 * Extraído íntegramente de Arriendo Mi Auto Ya.dc.html
 * 
 * Contraste verificado según WCAG AA/AAA.
 */

export const colors = {
  // ==========================================
  // 1. ESCALA PRIMARY (Teal / Verde Pino)
  // Base 700 (#0F3D3E) — marca, botón principal, encabezados
  // ==========================================
  primary100: "#E6F0F0",
  primary200: "#C2DBDB",
  primary300: "#94BFBF",
  primary400: "#5E9A9B",
  primary500: "#2E7375",
  primary600: "#1B5657", // Hover / Pressed
  primary700: "#0F3D3E", // Base Primary
  primary800: "#0A2E2F", // Dark Surface
  primary900: "#061E1F", // Dark Background / Camera canvas

  // Alias de Primary
  primary: "#0F3D3E",
  primaryHover: "#1B5657",
  primaryPressed: "#061E1F",
  primaryDark: "#061E1F",
  primaryCard: "#FFFFFF",
  primaryCardBorder: "#E5E7EB",

  // ==========================================
  // 2. ESCALA ACCENT (Menta / Verde Esmeralda)
  // Base 500 (#2FBF9B) — disponible, activo, confirmado
  // * Nota WCAG: Sobre accent500 nunca usar texto blanco (#FFFFFF); usar text (#1A1D1F).
  // ==========================================
  accent100: "#E4F8F2", // Fondo badges / Focus tint
  accent200: "#BFEFE0",
  accent300: "#92E3CB",
  accent400: "#5FD3B4",
  accent500: "#2FBF9B", // Base Accent
  accent600: "#229C7E",
  accent700: "#197A63", // Enlaces / Texto sobre acento / Accent Dark
  accent800: "#125A49", // Texto de badges en accent100
  accent900: "#0B3B30",

  // Alias de Accent
  accent: "#2FBF9B",
  accentDark: "#197A63",
  accentMuted: "#E4F8F2",
  accentText: "#125A49",

  // ==========================================
  // 3. NEUTROS Y SUPERFICIES (Light & Dark)
  // ==========================================
  background: "#FAFAF9",      // Fondo de pantallas claras
  appOuter: "#EDEDE9",        // Canvas exterior
  surface: "#FFFFFF",         // Tarjetas, modales, contenedores
  surfaceSubtle: "#F4FAF9",
  surfaceSecondary: "#EFF1F3", // Placeholder strip
  border: "#E5E7EB",          // Bordes normales
  borderDark: "#DDDDD8",      // Divisores de sección
  borderLight: "#D1D5DB",     // Tachado / Bordes sutiles
  skeleton: "#F3F4F6",        // Shimmer / Estados de carga

  // Superficies Oscuras (Cámara, Visor 360°, Modo Oscuro)
  darkBg: "#061E1F",          // Fondo oscuro principal
  darkSurface: "#0A2E2F",     // Superficie oscura 800
  darkCard: "#0A2E2F",        // Tarjeta oscura
  darkCardSubtle: "#0E3736",
  darkBorder: "rgba(255, 255, 255, 0.12)",
  darkBorderStrong: "rgba(255, 255, 255, 0.25)",
  darkTextMuted: "#94BFBF",

  // ==========================================
  // 4. TIPOGRAFÍA
  // ==========================================
  text: "#1A1D1F",            // Texto principal oscuro (16,1:1 WCAG AAA)
  textDark: "#1A1D1F",
  textSecondary: "#6B7280",   // Texto secundario / muted (4,6:1 WCAG AA)
  textMuted: "#6B7280",
  textSilver: "#6B7280",
  textPlaceholder: "#9CA3AF", // Placeholder de campos
  textDisabled: "#9CA3AF",    // Textos deshabilitados
  textWhite: "#FFFFFF",       // Texto blanco

  // ==========================================
  // 5. ESTADOS SEMÁNTICOS Y BADGES
  // ==========================================
  // Success / Confirmado / Disponible
  success: "#197A63",
  successBg: "#E4F8F2",
  successBorder: "#BFEFE0",
  successText: "#125A49",
  successAccent: "#2FBF9B",

  // Warning / Alerta / Por vencer / Garantía retenida
  warning: "#D97706",
  warningBg: "#FFF8EC",
  warningBorder: "#F0DDBB",
  warningText: "#8A5B0B",
  warningAccent: "#F2C879",

  // Danger / Error / Destructivo / Vencido / Cancelado
  danger: "#DC2626",
  dangerHover: "#A81B1B",
  dangerPressed: "#A81B1B",
  dangerBg: "#FBE9E9",
  dangerBorder: "#F1DADA",
  dangerText: "#A81B1B",
  dangerDisabledBg: "#F1DADA",
  dangerDisabledText: "#C99B9B",
  dangerFocusRing: "#F19A9A",
  dangerTextDark: "#7A1414",

  // Neutral / Finalizada
  neutralBadgeBg: "#F3F4F6",
  neutralBadgeText: "#4B5563",
  disabledBg: "#E5E7EB",
  disabledText: "#9CA3AF",

  // ==========================================
  // 6. SOMBRAS Y OVERLAYS
  // ==========================================
  shadowSm: "0 1px 2px rgba(15, 61, 62, 0.08)",
  shadowMd: "0 6px 20px rgba(15, 61, 62, 0.10)",
  shadowLg: "0 10px 28px rgba(15, 61, 62, 0.14)",

  overlayDark: "rgba(6, 30, 31, 0.82)",
  overlayDarker: "rgba(6, 30, 31, 0.92)",
  overlayLight: "rgba(255, 255, 255, 0.12)",

  // Focus Rings
  focusRingPrimary: "#2FBF9B",
  focusRingSoft: "#E4F8F2",
  focusRingDanger: "#F19A9A",

  // ==========================================
  // 7. COMPATIBILIDAD CON VISTAS PREVIAS
  // ==========================================
  lightBg: "#FAFAF9",
  lightCard: "#FFFFFF",
  lightCardBorder: "#E5E7EB",
  lightSurface: "#FAFAF9",
};

export default colors;
