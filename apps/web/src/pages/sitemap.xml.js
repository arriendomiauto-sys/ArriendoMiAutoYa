import { SITE_URL } from "../lib/seo";

/**
 * Sitemap XML generado dinámicamente.
 * Solo incluye páginas públicas e indexables (excluye /manager, /staff-login, /404).
 */
const PAGES = [
  { path: "/", changefreq: "daily", priority: "1.0" },
  { path: "/cotizador", changefreq: "weekly", priority: "0.9" },
  { path: "/simulador-duenos", changefreq: "weekly", priority: "0.8" },
  { path: "/garantias", changefreq: "monthly", priority: "0.7" },
  { path: "/terminos", changefreq: "yearly", priority: "0.3" },
  { path: "/privacidad", changefreq: "yearly", priority: "0.3" },
];

function generateSiteMap() {
  const lastmod = new Date().toISOString().split("T")[0];
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${PAGES.map(
  ({ path, changefreq, priority }) => `  <url>
    <loc>${SITE_URL}${path}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`
).join("\n")}
</urlset>`;
}

export async function getServerSideProps({ res }) {
  res.setHeader("Content-Type", "text/xml");
  res.setHeader(
    "Cache-Control",
    "public, s-maxage=86400, stale-while-revalidate"
  );
  res.write(generateSiteMap());
  res.end();
  return { props: {} };
}

export default function SiteMap() {
  return null;
}
