/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,jsx}",
    "./src/components/**/*.{js,jsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          teal: "#0F3D3E",
          tealDark: "#061E1F",
          mint: "#2FBF9B",
          mintHover: "#28A787",
        },
      },
    },
  },
  plugins: [],
};
