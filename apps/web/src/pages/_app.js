import { useEffect } from "react";
import Head from "next/head";
import Script from "next/script";
import { useRouter } from "next/router";
import { API_BASE_URL } from "../lib/api";
import "../styles/globals.css";

const GA_ID = process.env.NEXT_PUBLIC_GA_ID || "G-RR34T24BTE";

// Origen de la API, para el preconnect (acelera el primer fetch del catálogo).
const API_ORIGIN = (() => {
  try {
    return new URL(API_BASE_URL).origin;
  } catch {
    return null;
  }
})();

export default function App({ Component, pageProps }) {
  const router = useRouter();

  // GA4: registrar cada cambio de ruta del lado del cliente (SPA).
  useEffect(() => {
    if (!GA_ID || typeof window === "undefined") return;
    const onRouteChange = (url) => {
      if (typeof window.gtag === "function") {
        window.gtag("config", GA_ID, { page_path: url });
      }
    };
    router.events.on("routeChangeComplete", onRouteChange);
    return () => router.events.off("routeChangeComplete", onRouteChange);
  }, [router.events]);

  return (
    <>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=5, viewport-fit=cover" />
        {API_ORIGIN && <link rel="preconnect" href={API_ORIGIN} crossOrigin="anonymous" />}
        {API_ORIGIN && <link rel="dns-prefetch" href={API_ORIGIN} />}
      </Head>

      {/* Google Analytics 4 */}
      {GA_ID && (
        <>
          <Script
            strategy="afterInteractive"
            src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
          />
          <Script
            id="google-analytics"
            strategy="afterInteractive"
            dangerouslySetInnerHTML={{
              __html: `
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                gtag('js', new Date());
                gtag('config', '${GA_ID}', { page_path: window.location.pathname });
              `,
            }}
          />
        </>
      )}

      <Component {...pageProps} />
    </>
  );
}
