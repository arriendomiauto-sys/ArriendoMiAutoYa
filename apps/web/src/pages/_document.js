import { Html, Head, Main, NextScript } from "next/document";

const SITE_URL = "https://arriendomiautoya.cl";

export default function Document() {
  const autoRentalLd = {
    "@context": "https://schema.org",
    "@type": "AutoRental",
    "@id": `${SITE_URL}/#business`,
    name: "ArriendoMiAutoYa Chile — Arriendo de Autos y Financiamiento Automotriz",
    description:
      "Plataforma oficial de arriendo de autos entre personas en Chile. Arrienda autos desde $19.000/día o financia la cuota de tu auto ganando hasta $800.000/mes. Seguro con deducible 15 UF y verificación digital en 60 segundos.",
    url: SITE_URL,
    logo: `${SITE_URL}/logo.png`,
    image: `${SITE_URL}/hero-car.jpg`,
    telephone: "+56912345678",
    priceRange: "$19.000 - $65.000 CLP",
    currenciesAccepted: "CLP",
    paymentAccepted: "Tarjeta de crédito, Redcompra, Transferencia bancaria",
    address: {
      "@type": "PostalAddress",
      addressCountry: "CL",
    },
    areaServed: {
      "@type": "Country",
      name: "Chile",
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
        <meta name="theme-color" content="#ffffff" />

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
          href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />

        {/* Meta Keywords & Geo */}
        <meta
          name="keywords"
          content="arriendo de autos chile, rent a car santiago, financia tu auto, pagar cuota auto arriendo, rent a car economico, arriendo autos particulares, financiamiento automotriz, arriendo auto por dia, ganar dinero con mi auto chile, arriendomiautoya"
        />
        <meta name="geo.region" content="CL" />
        <meta name="geo.placename" content="Santiago, Chile" />

        {/* Open Graph / Twitter — valores globales (los específicos van por página vía <Seo/>) */}
        <meta property="og:site_name" content="ArriendoMiAutoYa Chile" />
        <meta property="og:locale" content="es_CL" />
        <meta
          property="og:image:alt"
          content="ArriendoMiAutoYa - Arriendo de autos entre personas"
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
      <body className="bg-white text-[#17181a] antialiased">
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
