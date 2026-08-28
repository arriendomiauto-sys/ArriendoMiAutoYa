import Head from "next/head";
import { useRouter } from "next/router";
import {
  SITE_NAME,
  DEFAULT_TITLE,
  DEFAULT_DESCRIPTION,
  DEFAULT_OG_IMAGE,
  absoluteUrl,
} from "../lib/seo";

/**
 * Componente SEO reutilizable.
 * Centraliza title, description, canonical, Open Graph, Twitter Card
 * y datos estructurados JSON-LD por página.
 *
 * Props:
 *  - title:        título de la pestaña / og:title
 *  - description:  meta description / og:description
 *  - path:         path canónico (por defecto la ruta actual sin query)
 *  - image:        URL (absoluta o relativa) de la imagen para compartir
 *  - noindex:      true para excluir la página de los buscadores
 *  - ogType:       "website" (default) | "article"
 *  - jsonLd:       objeto u array de objetos Schema.org
 */
export default function Seo({
  title,
  description = DEFAULT_DESCRIPTION,
  path,
  image = DEFAULT_OG_IMAGE,
  noindex = false,
  ogType = "website",
  jsonLd,
}) {
  const router = useRouter();
  const canonicalPath = path ?? router?.asPath ?? "/";
  const canonical = absoluteUrl(canonicalPath);
  const fullTitle = title
    ? `${title}${title.includes(SITE_NAME) ? "" : ` | ${SITE_NAME}`}`
    : DEFAULT_TITLE;
  const ogImage = image?.startsWith("http") ? image : absoluteUrl(image);

  const blocks = jsonLd ? (Array.isArray(jsonLd) ? jsonLd : [jsonLd]) : [];

  return (
    <Head>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={canonical} />
      {noindex ? (
        <meta name="robots" content="noindex, nofollow" />
      ) : (
        <meta
          name="robots"
          content="index, follow, max-image-preview:large, max-snippet:-1"
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
