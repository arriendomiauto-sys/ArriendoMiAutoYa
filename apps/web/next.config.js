/** @type {import('next').NextConfig} */

// Cabeceras de seguridad para todas las respuestas. Sin CSP estricta (rompería
// GA + Google Maps + estilos inline de Tailwind); sí las de bajo riesgo y alto
// valor. `Permissions-Policy` habilita la geolocalización propia del sitio
// (mapa "autos cerca de mí") y bloquea el resto.
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-DNS-Prefetch-Control", value: "on" },
  {
    key: "Permissions-Policy",
    value: "geolocation=(self), camera=(), microphone=(), payment=(), usb=()",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
];

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  compress: true,
  productionBrowserSourceMaps: false,
  env: {
    NEXT_GOOGLE_MAPS_API_KEY: process.env.NEXT_GOOGLE_MAPS_API_KEY,
    NEXT_PUBLIC_GOOGLE_MAPS_API_KEY:
      process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || process.env.NEXT_GOOGLE_MAPS_API_KEY,
  },
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "*.supabase.co" },
    ],
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // El sitemap y los assets estáticos se pueden cachear agresivamente.
      {
        source: "/(cars|.*\\.(?:png|jpg|jpeg|webp|avif|svg|ico|woff2))",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
    ];
  },
  webpack: (config, { dev }) => {
    if (dev) {
      config.watchOptions = {
        ignored: /node_modules|\.git|\.next|[A-Za-z]:[/\\](?:pagefile\.sys|swapfile\.sys|dumpstack\.log\.tmp|System Volume Information)/,
        aggregateTimeout: 300,
      };
    }
    return config;
  },
};

module.exports = nextConfig;
