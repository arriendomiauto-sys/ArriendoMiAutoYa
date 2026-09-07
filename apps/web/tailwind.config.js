/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        brand: {
          /* Paleta clara (rediseño 2026): blanco base + detalles oscuros + teal de marca */
          ink: "#141414",
          ink2: "#1f1f1d",
          soft: "#f5f5f2",
          line: "#e6e6e1",
          dash: "#d7d7d1",
          teal: "#14a07c",
          tealInk: "#0b6b52",
          tealTint: "#e8f5f0",
          tealBright: "#3ed9b4",
          amber: "#c08a1e",
          /* legacy (subpáginas aún en tema oscuro) */
          tealDark: "#061E1F",
          tealCard: "#0E3736",
          mint: "#2FBF9B",
          mintHover: "#28A787",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      fontFamily: {
        primary: ["var(--font-primary)", "Space Grotesk", "sans-serif"],
        display: ["var(--font-primary)", "Space Grotesk", "sans-serif"],
        body: ["var(--font-body)", "Plus Jakarta Sans", "sans-serif"],
      },
      boxShadow: {
        soft: "0 1px 2px rgba(20,20,20,.04), 0 26px 60px -24px rgba(20,20,20,.16)",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
