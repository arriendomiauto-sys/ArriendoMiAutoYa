const path = require("path");

// fast-glob exige separadores "/" incluso en Windows; path.join produce "\\"
// en ese SO, lo que hace que el glob no matchee ningún archivo.
const toPosix = (p) => p.split(path.sep).join("/");

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    toPosix(path.join(__dirname, "apps/**/*.{js,jsx,ts,tsx}")),
    toPosix(path.join(__dirname, "packages/**/*.{js,jsx,ts,tsx}")),
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#0F3D3E",
          100: "#E6F0F0",
          200: "#C2DBDB",
          300: "#94BFBF",
          400: "#5E9A9B",
          500: "#2E7375",
          600: "#1B5657",
          700: "#0F3D3E",
          800: "#0A2E2F",
          900: "#061E1F",
        },
        accent: {
          DEFAULT: "#2FBF9B",
          100: "#E4F8F2",
          200: "#BFEFE0",
          300: "#92E3CB",
          400: "#5FD3B4",
          500: "#2FBF9B",
          600: "#229C7E",
          700: "#197A63",
          800: "#125A49",
          900: "#0B3B30",
        },
        background: "#FAFAF9",
        appOuter: "#EDEDE9",
        surface: {
          DEFAULT: "#FFFFFF",
          subtle: "#F4FAF9",
          secondary: "#EFF1F3",
        },
        danger: "#DC2626",
        textDark: "#1A1D1F",
        textMuted: "#6B7280",
        textSecondary: "#6B7280",
        darkBg: "#061E1F",
        darkSurface: "#0A2E2F",
        border: {
          DEFAULT: "#E5E7EB",
          dark: "#DDDDD8",
          light: "#D1D5DB",
        },
        borderDark: "#DDDDD8",
        borderLight: "#D1D5DB",
        warning: {
          DEFAULT: "#D97706",
          bg: "#FFF8EC",
          border: "#F0DDBB",
          text: "#8A5B0B",
        },
        success: {
          DEFAULT: "#197A63",
          bg: "#E4F8F2",
          border: "#BFEFE0",
          text: "#125A49",
        },
        info: {
          DEFAULT: "#2563EB",
          bg: "#EFF6FF",
          border: "#BFDBFE",
          text: "#1D4ED8",
        },
      },
    },
  },
  plugins: [],
};
