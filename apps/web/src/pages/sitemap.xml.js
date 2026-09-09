import { SITE_URL } from "../lib/seo";
import { obtenerAutos, autoHref } from "../lib/autos";

/**
 * Sitemap XML dinámico: páginas fijas + una URL por auto publicado.
 * Si la API no responde, se emite igual el sitemap con las páginas fijas.
 */
const PAGES = [
  { path: "/", changefreq: "daily", priority: "1.0" },
  { path: "/cotizador", changefreq: "weekly", priority: "0.9" },
  { path: "/simulador-duenos", changefreq: "weekly", priority: "0.8" },
  { path: "/garantias", changefreq: "monthly", priority: "0.7" },
  { path: "/terminos", changefreq: "yearly", priority: "0.3" },
  { path: "/privacidad", changefreq: "yearly", priority: "0.3" },
];

const esc = (s) =>
  String(s).replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" }[c]));

function xml(entradas) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entradas
  .map(
    (e) => `  <url>
    <loc>${esc(SITE_URL + e.path)}</loc>
    <lastmod>${e.lastmod}</lastmod>
    <changefreq>${e.changefreq}</changefreq>
    <priority>${e.priority}</priority>
  </url>`
  )
  .join("\n")}
</urlset>`;
}

export async function getServerSideProps({ res }) {
  const lastmod = new Date().toISOString().split("T")[0];
  const entradas = PAGES.map((p) => ({ ...p, lastmod }));

  try {
    const autos = await obtenerAutos({ timeoutMs: 6000, reintentos: 0 });
    for (const a of autos) {
      entradas.push({ path: autoHref(a), lastmod, changefreq: "weekly", priority: "0.6" });
    }
  } catch {
    /* solo páginas fijas */
  }

  res.setHeader("Content-Type", "text/xml");
  res.setHeader("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=86400");
  res.write(xml(entradas));
  res.end();
  return { props: {} };
}

export default function SiteMap() {
  return null;
}
