import React, { useEffect, useState } from "react";
import Head from "next/head";

const APP_SCHEME = "arriendatuauto";

/**
 * Página de retorno de Webpay Plus para el flujo de pago de la app móvil.
 *
 * Transbank hace un POST a esta URL con `token_ws` en el cuerpo
 * (application/x-www-form-urlencoded). Acá se lee ese token y se reenvía a
 * la app por deep link (`arriendatuauto://pago-retorno?token_ws=...`), que
 * es lo que `WebBrowser.openAuthSessionAsync` está esperando para cerrar el
 * navegador embebido y devolverle el control a PaymentMethodsScreen.
 *
 * La app llama a POST /pagos/webpay/confirmar con ese token — este flujo
 * solo transporta el token, no confirma nada.
 */
export async function getServerSideProps({ req, query }) {
  let token = query.token_ws || query.TBK_TOKEN || null;

  if (!token && req.method === "POST") {
    try {
      const body = await new Promise((resolve, reject) => {
        let data = "";
        req.on("data", (chunk) => {
          data += chunk;
          if (data.length > 1e6) reject(new Error("payload demasiado grande"));
        });
        req.on("end", () => resolve(data));
        req.on("error", reject);
      });
      const params = new URLSearchParams(body);
      token = params.get("token_ws") || params.get("TBK_TOKEN") || null;
    } catch {
      token = null;
    }
  }

  // Webpay manda TBK_TOKEN (sin token_ws) cuando el usuario aborta el pago.
  const abortado = !query.token_ws && (query.TBK_TOKEN || query.TBK_ORDEN_COMPRA);

  return { props: { token: token || null, abortado: Boolean(abortado) } };
}

export default function PagoRetorno({ token, abortado }) {
  const [manual, setManual] = useState(false);
  const deepLink = token
    ? `${APP_SCHEME}://pago-retorno?token_ws=${encodeURIComponent(token)}`
    : `${APP_SCHEME}://pago-retorno${abortado ? "?estado=abortado" : ""}`;

  useEffect(() => {
    const t = setTimeout(() => {
      window.location.href = deepLink;
    }, 300);
    const fallback = setTimeout(() => setManual(true), 2500);
    return () => {
      clearTimeout(t);
      clearTimeout(fallback);
    };
  }, [deepLink]);

  return (
    <>
      <Head>
        <title>Volviendo a la app…</title>
        <meta name="robots" content="noindex" />
      </Head>
      <main
        style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 16,
          padding: 24,
          fontFamily: "system-ui, -apple-system, sans-serif",
          background: "#FAFAF9",
          color: "#1A1D1F",
          textAlign: "center",
        }}
      >
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: 28,
            background: "#E6F0F0",
            display: "grid",
            placeItems: "center",
            fontSize: 26,
          }}
        >
          🔑
        </div>
        <h1 style={{ fontSize: 20, margin: 0 }}>
          {abortado ? "Pago no completado" : "Pago recibido"}
        </h1>
        <p style={{ color: "#6B7280", maxWidth: 320, lineHeight: 1.5, margin: 0 }}>
          Te estamos devolviendo a Arrienda Tu Auto para confirmar tu reserva.
        </p>
        {manual && (
          <a
            href={deepLink}
            style={{
              marginTop: 8,
              background: "#0F3D3E",
              color: "#fff",
              padding: "12px 20px",
              borderRadius: 12,
              textDecoration: "none",
              fontWeight: 600,
            }}
          >
            Volver a la app
          </a>
        )}
      </main>
    </>
  );
}
