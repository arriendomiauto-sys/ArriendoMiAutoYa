import React, { useState, useEffect } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import Seo from "../../components/Seo";
import Navbar from "../../components/Navbar";
import Footer from "../../components/Footer";
import { Gift, Copy, Check, ArrowRight, ExternalLink, QrCode, Sparkles, ShieldCheck, AlertCircle } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

/**
 * Landing oficial de colaboradores e invitación:
 * - Soporta invitaciones de promotores (admin) y referidos estándar.
 * - Maneja códigos de un solo uso con advertencia si ya fue consumido.
 * - Copia automáticamente el código al portapapeles al pulsar descargar.
 * - Deep Link directo (rentacar://registro?ref=CODIGO) para quien ya tiene la app.
 * - Código QR para escanear desde computadora con el teléfono.
 */
export default function InvitacionPage() {
  const router = useRouter();
  const codigo = String(router.query.codigo || "").toUpperCase();
  const [copiado, setCopiado] = useState(false);
  const [toastDescarga, setToastDescarga] = useState(false);
  const [mostrarQr, setMostrarQr] = useState(false);
  const [infoColaborador, setInfoColaborador] = useState(null);

  useEffect(() => {
    if (!codigo) return;
    fetch(`${API_URL}/usuarios/codigo-referido/${codigo}/validar`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) {
          setInfoColaborador(data);
        }
      })
      .catch(() => {});
  }, [codigo]);

  const copiarCodigo = async (conAvisoDescarga = false) => {
    if (!codigo || typeof navigator === "undefined") return;
    try {
      await navigator.clipboard.writeText(codigo);
      setCopiado(true);
      if (conAvisoDescarga) {
        setToastDescarga(true);
        setTimeout(() => setToastDescarga(false), 4500);
      }
      setTimeout(() => setCopiado(false), 2500);
    } catch {
      // Portapapeles bloqueado: el código permanece visible para lectura manual
    }
  };

  const handleDescargar = async () => {
    await copiarCodigo(true);
    window.location.href = "/#descargar-app";
  };

  const esPromotor = infoColaborador?.tipo === "promotor";
  const yaUsado = infoColaborador?.usado;
  const deepLinkApp = `rentacar://registro?ref=${codigo}`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(
    typeof window !== "undefined" ? window.location.href : `https://arriendomiautoya.cl/invitacion/${codigo}`
  )}`;

  return (
    <>
      <Seo
        title={
          esPromotor
            ? "Invitación de Promotor a ArriendoMiAutoYa"
            : infoColaborador?.nombre_referente
            ? `Invitación de ${infoColaborador.nombre_referente} a ArriendoMiAutoYa`
            : "Te invitaron a ArriendoMiAutoYa"
        }
        description={
          esPromotor
            ? "Has sido invitado como Promotor Oficial en ArriendoMiAutoYa. Regístrate para activar tu rol."
            : "Regístrate con este código y obtén 15% de descuento en tu primer arriendo."
        }
        path={`/invitacion/${codigo || ""}`}
        noindex
      />

      <Navbar />

      <main className="min-h-[85vh] bg-white text-brand-ink pt-28 pb-20 relative overflow-hidden">
        <div className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[580px] h-[400px] bg-brand-teal/10 rounded-full filter blur-[130px]" />

        <div className="container max-w-lg mx-auto px-4 sm:px-6 text-center relative z-10 space-y-7">
          {yaUsado ? (
            /* Banner de Código Ya Usado */
            <div className="rounded-2xl border border-amber-300 bg-amber-50 p-6 text-center text-amber-900 shadow-sm animate-in fade-in">
              <AlertCircle className="w-8 h-8 text-amber-600 mx-auto mb-2" />
              <h2 className="text-lg font-bold">Este código de un solo uso ya fue utilizado</h2>
              <p className="text-xs text-amber-800 mt-1.5 leading-relaxed">
                Cada invitación del programa es de uso único para garantizar la seguridad. Si crees que se trata de un error, solicita un nuevo código a quien te invitó.
              </p>
            </div>
          ) : (
            <>
              {/* Badge Colaborador / Promotor Oficial */}
              <div className="inline-flex items-center gap-2 rounded-full border border-brand-teal/30 bg-brand-tealTint px-4 py-1.5 text-xs font-bold text-brand-tealInk shadow-sm">
                <Sparkles className="h-3.5 w-3.5 text-brand-teal" />
                <span>
                  {esPromotor
                    ? "Invitación Oficial de Promotor"
                    : infoColaborador?.nombre_referente
                    ? `Invitado por ${infoColaborador.nombre_referente}`
                    : "Programa de Colaboradores"}
                </span>
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 ml-1" />
              </div>

              <div className="space-y-3">
                <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-brand-ink">
                  {esPromotor
                    ? "Únete como Promotor Oficial"
                    : "Arrienda tu auto con 15% de descuento"}
                </h1>
                <p className="text-sm text-[#63645f] max-w-sm mx-auto leading-relaxed">
                  {esPromotor
                    ? "El Administrador te ha invitado a formar parte del equipo de Promotores de ArriendoMiAutoYa. Al registrarte con este código único se activará tu rol en ambas apps (owner y renter)."
                    : "Un colaborador oficial te ha invitado a unirte a ArriendoMiAutoYa. Al registrarte con su código único de un solo uso recibes 15% de descuento en tu primer viaje."}
                </p>
              </div>

              {/* Tarjeta de Código */}
              <div className="rounded-[2rem] bg-gradient-to-b from-[#0F3D3E] to-[#0A2728] p-8 text-white shadow-xl shadow-brand-teal/15 border border-brand-teal/20 relative">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-[11px] font-semibold mb-2">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Código de un solo uso</span>
                </div>
                <p className="font-display text-4xl sm:text-5xl font-black tracking-[0.25em] text-[#2DD4BF] my-2 select-all">
                  {codigo || "—"}
                </p>
                <p className="text-xs text-white/70 mt-1">
                  {esPromotor
                    ? "Beneficio: Rol oficial de Promotor y acceso al panel de invitaciones"
                    : "Beneficio: 15% OFF en tu primer arriendo"}
                </p>

                <div className="mt-6 flex flex-wrap items-center justify-center gap-2.5">
                  <button
                    onClick={() => copiarCodigo(false)}
                    disabled={!codigo}
                    className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2 text-xs font-semibold text-white hover:bg-white/20 transition-all active:scale-95"
                  >
                    {copiado ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                    {copiado ? "¡Código Copiado!" : "Copiar código"}
                  </button>

                  <button
                    onClick={() => setMostrarQr((v) => !v)}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-white/10 px-3.5 py-2 text-xs font-semibold text-white hover:bg-white/20 transition-all active:scale-95"
                  >
                    <QrCode className="h-3.5 w-3.5" />
                    <span>{mostrarQr ? "Ocultar QR" : "Ver QR"}</span>
                  </button>
                </div>

                {mostrarQr && (
                  <div className="mt-5 p-4 bg-white rounded-2xl inline-block shadow-lg animate-in fade-in zoom-in duration-200">
                    <img src={qrUrl} alt="Escanear invitación" className="w-40 h-40 mx-auto" />
                    <p className="text-[11px] font-bold text-gray-700 mt-2">Escanea desde tu móvil</p>
                  </div>
                )}
              </div>
            </>
          )}

          {/* Toast / Alerta de copiado automático para la descarga */}
          {toastDescarga && (
            <div className="rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-left flex items-start gap-2.5 shadow-md animate-in fade-in slide-in-from-top-2">
              <Check className="h-5 w-5 text-emerald-600 flex-shrink-0 mt-0.5" />
              <div className="text-xs">
                <p className="font-bold text-emerald-900">¡Código copiado al portapapeles!</p>
                <p className="text-emerald-700 mt-0.5">Al abrir la app instalada, tu código {codigo} se detectará y aplicará automáticamente.</p>
              </div>
            </div>
          )}

          {/* Botones de Acción */}
          <div className="flex flex-col gap-3 max-w-sm mx-auto">
            {/* Si ya tiene la app instalada: abrir directo vía Deep Link */}
            <a
              href={deepLinkApp}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-ink px-6 py-3.5 text-sm font-bold text-white hover:bg-black transition-colors shadow-md"
            >
              <span>Abrir en la App (Ya instalada)</span>
              <ExternalLink className="w-4 h-4 text-emerald-400" />
            </a>

            {/* Botón principal de descarga */}
            <button
              onClick={handleDescargar}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-teal px-6 py-4 text-sm font-black text-[#04231b] hover:bg-[#12b78d] transition-all shadow-lg shadow-brand-teal/25 active:scale-[0.98]"
            >
              <span>Descargar la App y Usar Código</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          {/* Información de cómo funciona el beneficio */}
          <div className="text-xs text-textMuted max-w-md mx-auto space-y-2 pt-2 border-t border-gray-100">
            <p className="font-semibold text-brand-ink">¿Cómo se activa el beneficio?</p>
            <p>
              1. Toca <strong>Descargar la App</strong> (copiaremos tu código automáticamente).<br />
              2. Abre la app en tu teléfono y regístrate.<br />
              3. Verás el código aplicado en tu cuenta con tu descuento activado.
            </p>
          </div>
        </div>
      </main>

      <Footer />
    </>
  );
}
