import React, { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import Seo from "../../components/Seo";
import Navbar from "../../components/Navbar";
import Footer from "../../components/Footer";
import { CheckCircle2, Clock, XCircle, ArrowRight } from "lucide-react";

/**
 * Página de retorno de la verificación de identidad (Didit).
 *
 * Es el `callback` de la sesión hosted: cuando el usuario termina de
 * fotografiar su cédula y hacer la selfie, Didit lo trae acá. No decide
 * nada — el veredicto real (aprobado / en revisión / rechazado) le llega al
 * backend por webhook firmado y la app lo refleja al volver. Esta página
 * solo confirma que se envió y devuelve a la app por deep link, igual que
 * /pago/retorno.
 */
export default function VerificacionRetorno() {
  const router = useRouter();
  const [deepLink, setDeepLink] = useState("");

  // Didit suele adjuntar ?status=<Approved|Declined|In Review|...> y
  // ?session_id=. Se usa solo para el copy; nunca como prueba de aprobación.
  const status = String(router.query.status || "").toLowerCase();
  const esRechazado = status.includes("declin");
  const esRevision = status.includes("review");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const search = window.location.search;
    // El backend agrega ?app=owner|renter al callback (ver
    // didit.callback_url_para) para saber a qué app volver: son dos apps
    // con esquemas distintos desde el split owner/renter. Sin el parámetro
    // (o con un valor no reconocido) se asume arrendatario, como antes.
    const app = String(router.query.app || "").toLowerCase();
    const scheme = app === "owner" ? "arriendatuautoduenos" : "arriendatuauto";
    const targetLink = `${scheme}://kyc-retorno${search}`;
    setDeepLink(targetLink);

    const timer = setTimeout(() => {
      window.location.href = targetLink;
    }, 600);

    return () => clearTimeout(timer);
  }, [router.query]);

  const titulo = esRechazado
    ? "No pudimos verificar tu identidad"
    : esRevision
    ? "Verificación en revisión"
    : "¡Verificación enviada!";

  const detalle = esRechazado
    ? "La verificación no pasó. Puedes reintentarla desde la app; si el problema sigue, escríbenos a soporte."
    : esRevision
    ? "Un ejecutivo está revisando tus datos. Te avisamos en la app apenas quede lista tu cuenta."
    : "Recibimos tu cédula y tu selfie. Estamos confirmando tu identidad y la app se actualiza sola en unos segundos.";

  return (
    <>
      <Seo
        title={`${titulo} - ArriendoMiAutoYa`}
        description="Estado de tu verificación de identidad en ArriendoMiAutoYa."
        path="/verificacion/retorno"
        noindex
      />

      <Navbar />

      <main className="min-h-[80vh] bg-white text-brand-ink flex items-center justify-center pt-28 pb-20 relative overflow-hidden">
        <div
          className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[350px] rounded-full filter blur-[120px] pointer-events-none ${
            esRechazado
              ? "bg-red-500/15"
              : esRevision
              ? "bg-amber-500/15"
              : "bg-brand-tealTint"
          }`}
        />

        <div className="container max-w-lg mx-auto px-4 sm:px-6 text-center relative z-10 space-y-6">
          <div className="flex justify-center">
            {esRechazado ? (
              <div className="w-20 h-20 rounded-full bg-red-500/20 border border-red-500/40 flex items-center justify-center text-red-400">
                <XCircle className="w-10 h-10" />
              </div>
            ) : esRevision ? (
              <div className="w-20 h-20 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
                <Clock className="w-10 h-10" />
              </div>
            ) : (
              <div className="w-20 h-20 rounded-full bg-brand-tealTint border border-brand-line flex items-center justify-center text-brand-tealInk animate-pulse">
                <CheckCircle2 className="w-10 h-10" />
              </div>
            )}
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-brand-ink">
              {titulo}
            </h1>
            <p className="text-sm text-[#63645f] max-w-sm mx-auto leading-relaxed">
              {detalle} Redirigiendo a la app móvil...
            </p>
          </div>

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
