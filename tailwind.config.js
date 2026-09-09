/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class", '[data-theme="dark"]'],
  content: [
    "./src/pages/**/*.{js,jsx}",
    "./src/components/**/*.{js,jsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Tokens del sistema (definidos en src/styles/globals.css)
        ink: "var(--ink)",
        "ink-2": "var(--ink-2)",
        muted: "var(--muted)",
        bg: "var(--bg)",
        surface: "var(--surface)",
        "surface-2": "var(--surface-2)",
        line: "var(--line)",
        "line-strong": "var(--line-strong)",
        pino: "var(--pino)",
        mint: "var(--mint)",
        "mint-600": "var(--mint-600)",
        "mint-ink": "var(--mint-ink)",
        "mint-tint": "var(--mint-tint)",
        ok: "var(--ok)",
        warn: "var(--warn)",
        danger: "var(--danger)",
        info: "var(--info)",
        // compat con clases antiguas
        brand: {
          teal: "#0F3D3E",
          tealDark: "#0B2E2F",
          mint: "#2FBF9B",
          mintHover: "#1E9E7F",
        },
      },
      fontFamily: {
        sans: ['"Hanken Grotesk"', "system-ui", "sans-serif"],
        mono: ['"IBM Plex Mono"', "ui-monospace", "monospace"],
      },
    },
  },
  plugins: [],
};
