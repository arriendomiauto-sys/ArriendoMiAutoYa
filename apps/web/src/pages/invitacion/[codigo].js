import React, { useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import Seo from "../../components/Seo";
import Navbar from "../../components/Navbar";
import Footer from "../../components/Footer";
import { Gift, Copy, Check, ArrowRight } from "lucide-react";

/**
 * Landing de invitación: a donde llega quien recibe el link que un usuario
 * comparte desde el panel "Invita y gana" de la app (ver
 * PromoterPanelScreen.js / GET /usuarios/me/programa-referidos en el
 * backend). Todavía no hay registro por web — el CTA lleva a la sección de
 * descarga de la app en la home, igual que el resto del sitio.
 */
export default function InvitacionPage() {
  const router = useRouter();
  const codigo = String(router.query.codigo || "").toUpperCase();
  const [copiado, setCopiado] = useState(false);

  const copiarCodigo = async () => {
    if (!codigo || typeof navigator === "undefined") return;
    try {
      await navigator.clipboard.writeText(codigo);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      // Sin permiso de portapapeles: el código igual queda visible para copiar a mano.
    }
  };

  return (
    <>
      <Seo
        title="Te invitaron a ArriendoMiAutoYa"
        description="Usa un código de invitación para registrarte en ArriendoMiAutoYa y obtener un descuento o un extra en tus ganancias."
        path={`/invitacion/${codigo || ""}`}
        noindex
      />

      <Navbar />

      <main className="min-h-[80vh] bg-white text-brand-ink pt-28 pb-20 relative overflow-hidden">
        <div className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[520px] h-[360px] bg-brand-teal/10 rounded-full filter blur-[120px]" />

        <div className="container max-w-lg mx-auto px-4 sm:px-6 text-center relative z-10 space-y-7">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-brand-line bg-brand-tealTint px-3.5 py-1 text-xs font-bold text-brand-tealInk">
            <Gift className="h-3.5 w-3.5" />
            Invitación
          </div>

          <div className="space-y-3">
            <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-brand-ink">
              Arrienda o publica tu auto y gana un descuento
            </h1>
            <p className="text-sm text-[#63645f] max-w-sm mx-auto leading-relaxed">
              Regístrate en ArriendoMiAutoYa con este código: ambos reciben un descuento o un extra
              en las ganancias. El beneficio es más alto ahora y va bajando con el tiempo.
            </p>
          </div>

          <div className="rounded-[1.75rem] bg-brand-ink px-8 py-10 text-white">
            <p className="text-xs uppercase tracking-wider text-white/50 mb-2">Tu código</p>
            <p className="font-display text-4xl sm:text-5xl font-black tracking-[0.2em] text-brand-tealBright">
              {codigo || "—"}
            </p>
            <button
              onClick={copiarCodigo}
              disabled={!codigo}
              className="mt-5 inline-flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2.5 text-sm font-semibold text-white hover:bg-white/15 transition-colors disabled:opacity-40"
            >
              {copiado ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copiado ? "Copiado" : "Copiar código"}
            </button>
          </div>

          <Link
            href="/#descargar-app"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-teal px-6 py-3.5 text-sm font-bold text-[#04231b] hover:bg-[#12b78d] transition-colors shadow-lg shadow-brand-teal/20"
          >
            <span>Descargar la app y usar el código</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </main>

      <Footer />
    </>
  );
}
