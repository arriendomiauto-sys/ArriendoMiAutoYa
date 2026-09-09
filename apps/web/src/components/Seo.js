import Head from "next/head";
import { useRouter } from "next/router";
import {
  SITE_NAME,
  DEFAULT_TITLE,
  DEFAULT_DESCRIPTION,
  DEFAULT_KEYWORDS,
  DEFAULT_OG_IMAGE,
  absoluteUrl,
} from "../lib/seo";

/**
 * Componente SEO reutilizable.
 * Centraliza title, description, canonical, Open Graph, Twitter Card
 * y datos estructurados JSON-LD por página.
 */
export default function Seo({
  title,
  description = DEFAULT_DESCRIPTION,
  keywords = DEFAULT_KEYWORDS,
  path,
  image = DEFAULT_OG_IMAGE,
  noindex = false,
  ogType = "website",
  jsonLd,
}) {
  const router = useRouter();
  const canonicalPath = path ?? router?.asPath ?? "/";
  const canonical = absoluteUrl(canonicalPath);

  // Evita duplicar el nombre de la marca si ya está en el título o si el título es largo
  let fullTitle = DEFAULT_TITLE;
  if (title) {
    const hasBrand = /arriendomiauto/i.test(title);
    fullTitle = hasBrand || title.length > 45 ? title : `${title} | ${SITE_NAME}`;
  }

  const ogImage = image?.startsWith("http") ? image : absoluteUrl(image);
  const blocks = jsonLd ? (Array.isArray(jsonLd) ? jsonLd : [jsonLd]) : [];

  return (
    <Head>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      {keywords && <meta name="keywords" content={keywords} />}
      <link rel="canonical" href={canonical} />
      {noindex ? (
        <meta name="robots" content="noindex, nofollow" />
      ) : (
        <meta
          name="robots"
          content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1"
        />
      )}

      {/* Open Graph */}
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={canonical} />
      <meta property="og:type" content={ogType} />
      <meta property="og:image" content={ogImage} />

      {/* Twitter */}
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={ogImage} />

      {blocks.map((block, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(block) }}
        />
      ))}
    </Head>
  );
}
