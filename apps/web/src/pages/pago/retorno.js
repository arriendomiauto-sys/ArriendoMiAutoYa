import React, { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import Seo from "../../components/Seo";
import Navbar from "../../components/Navbar";
import Footer from "../../components/Footer";
import { CheckCircle2, Clock, XCircle, ArrowRight } from "lucide-react";

export default function PagoRetorno() {
  const router = useRouter();
  const [deepLink, setDeepLink] = useState("");
  const { status, collection_status, payment_id, collection_id } = router.query;

  const estadoReal = status || collection_status || "approved";
  const idTransaccion = payment_id || collection_id;
  const esExitoso = estadoReal === "approved";
  const esPendiente = estadoReal === "pending" || estadoReal === "in_process";

  useEffect(() => {
    if (typeof window === "undefined") return;
    const search = window.location.search;
    const targetLink = `arriendatuauto://pago-retorno${search}`;
    setDeepLink(targetLink);

    // Redirigir automáticamente a la aplicación móvil
    const timer = setTimeout(() => {
      window.location.href = targetLink;
    }, 600);

    return () => clearTimeout(timer);
  }, [router.query]);

  return (
    <>
      <Seo
        title={esExitoso ? "Pago Confirmado - ArriendoMiAutoYa" : "Estado del Pago - ArriendoMiAutoYa"}
        description="Estado de tu pago y confirmación de reserva en ArriendoMiAutoYa."
        path="/pago/retorno"
        noindex
      />

      <Navbar />

      <main className="min-h-[80vh] bg-white text-brand-ink flex items-center justify-center pt-28 pb-20 relative overflow-hidden">
        {/* Glow de fondo */}
        <div
          className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[350px] rounded-full filter blur-[120px] pointer-events-none ${
            esExitoso
              ? "bg-brand-tealTint"
              : esPendiente
              ? "bg-amber-500/15"
              : "bg-red-500/15"
          }`}
        />

        <div className="container max-w-lg mx-auto px-4 sm:px-6 text-center relative z-10 space-y-6">
          <div className="flex justify-center">
            {esExitoso ? (
              <div className="w-20 h-20 rounded-full bg-brand-tealTint border border-brand-line flex items-center justify-center text-brand-tealInk animate-pulse">
                <CheckCircle2 className="w-10 h-10" />
              </div>
            ) : esPendiente ? (
              <div className="w-20 h-20 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
                <Clock className="w-10 h-10" />
              </div>
            ) : (
              <div className="w-20 h-20 rounded-full bg-red-500/20 border border-red-500/40 flex items-center justify-center text-red-400">
                <XCircle className="w-10 h-10" />
              </div>
            )}
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-brand-ink">
              {esExitoso
                ? "¡Garantía y Reserva Confirmadas!"
                : esPendiente
                ? "Pago en Proceso de Confirmación"
                : "No se pudo procesar el pago"}
            </h1>
            <p className="text-sm text-[#63645f] max-w-sm mx-auto leading-relaxed">
              {esExitoso
                ? "Tu pago fue aprobado en Mercado Pago. Redirigiendo a la app móvil..."
                : esPendiente
                ? "Estamos esperando la confirmación de tu banco. Te notificaremos al acreditarse."
                : "La transacción fue rechazada o cancelada. Puedes reintentar desde la app."}
            </p>
          </div>

          {idTransaccion && (
            <div className="inline-block rounded-lg bg-brand-soft border border-brand-line px-4 py-2 text-xs text-[#63645f]">
              N.° de Operación: <span className="font-mono text-brand-ink font-bold">{idTransaccion}</span>
            </div>
          )}

          <div className="pt-4 space-y-3 max-w-xs mx-auto">
            {deepLink && (
              <a
                href={deepLink}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-brand-teal text-[#04231b] font-bold py-3 px-6 hover:bg-[#12b78d] transition-colors shadow-lg shadow-brand-teal/20 text-sm"
              >
                <span>Volver a la App</span>
                <ArrowRight className="w-4 h-4" />
              </a>
            )}

            <Link
              href="/"
              className="w-full inline-flex items-center justify-center rounded-xl bg-brand-soft border border-brand-line text-brand-ink font-medium py-2.5 px-6 hover:bg-brand-soft transition-colors text-xs"
            >
              Ir al inicio
            </Link>
          </div>
        </div>
      </main>

      <Footer />
    </>
  );
}
