import { Html, Head, Main, NextScript } from "next/document";

const SITE_URL = "https://arriendomiautoya.cl";

export default function Document() {
  const autoRentalLd = {
    "@context": "https://schema.org",
    "@type": "AutoRental",
    "@id": `${SITE_URL}/#business`,
    name: "ArriendoMiAutoYa",
    description:
      "Plataforma de arriendo de autos entre personas (P2P) en Los Ángeles, Región del Biobío. Seguro 15 UF (50/50), traspaso seguro con código QR y validación digital.",
    url: SITE_URL,
    logo: `${SITE_URL}/logo.png`,
    image: `${SITE_URL}/hero-car.jpg`,
    telephone: "+56912345678",
    priceRange: "$26.000 - $55.000 CLP",
    address: {
      "@type": "PostalAddress",
      addressLocality: "Los Ángeles",
      addressRegion: "Región del Biobío",
      addressCountry: "CL",
    },
    geo: {
      "@type": "GeoCoordinates",
      latitude: -37.4697,
      longitude: -72.3537,
    },
    areaServed: {
      "@type": "City",
      name: "Los Ángeles, Biobío",
    },
    openingHoursSpecification: {
      "@type": "OpeningHoursSpecification",
      dayOfWeek: [
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
        "Sunday",
      ],
      opens: "08:00",
      closes: "22:00",
    },
  };

  const organizationLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${SITE_URL}/#organization`,
    name: "ArriendoMiAutoYa",
    url: SITE_URL,
    logo: `${SITE_URL}/logo.png`,
    sameAs: [],
  };

  const websiteLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${SITE_URL}/#website`,
    name: "ArriendoMiAutoYa",
    url: SITE_URL,
    inLanguage: "es-CL",
    publisher: { "@id": `${SITE_URL}/#organization` },
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${SITE_URL}/?q={search_term_string}#catalogo`,
      },
      "query-input": "required name=search_term_string",
    },
  };

  return (
    <Html lang="es-CL">
      <Head>
        <meta charSet="utf-8" />
        <meta name="theme-color" content="#060B16" />

        {/* Favicon & App Icons */}
        <link rel="icon" href="/favicon.png" type="image/png" />
        <link rel="shortcut icon" href="/favicon.ico" />
        <link rel="apple-touch-icon" href="/logo.png" />

        {/* Sitemap */}
        <link
          rel="sitemap"
          type="application/xml"
          title="Sitemap"
          href="/sitemap.xml"
        />

        {/* Fonts */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />

        {/* Open Graph / Twitter — valores globales (los específicos van por página vía <Seo/>) */}
        <meta property="og:site_name" content="ArriendoMiAutoYa Chile" />
        <meta property="og:locale" content="es_CL" />
        <meta
          property="og:image:alt"
          content="ArriendoMiAutoYa - Car-Sharing en Los Ángeles, Biobío"
        />
        <meta name="twitter:card" content="summary_large_image" />

        {/* Datos estructurados globales */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(autoRentalLd) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationLd) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteLd) }}
        />
      </Head>
      <body className="bg-[#060B16] text-white antialiased">
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
