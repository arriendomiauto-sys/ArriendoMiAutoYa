import React from "react";
import Head from "next/head";
import Link from "next/link";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import { Button } from "../components/ui/button";
import { Car, Search, ArrowRight, ShieldCheck } from "lucide-react";

export default function Custom404() {
  return (
    <>
      <Head>
        <title>404 - Página no encontrada | ArriendoMiAutoYa</title>
        <meta name="robots" content="noindex, follow" />
        <meta
          name="description"
          content="La página que estás buscando no existe. Encuentra autos verificados en Los Ángeles, Biobío en ArriendoMiAutoYa."
        />
      </Head>

      <Navbar />

      <main className="min-h-[80vh] bg-[#061E1F] text-white flex items-center justify-center pt-28 pb-20 relative overflow-hidden">
        {/* Ambient mint glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[350px] bg-[#2FBF9B]/10 rounded-full filter blur-[120px] pointer-events-none" />

        <div className="container max-w-2xl mx-auto px-4 sm:px-6 text-center relative z-10 space-y-8">
          {/* Big Badge */}
          <div className="inline-flex items-center gap-2 rounded-full border border-[#2FBF9B]/30 bg-[#2FBF9B]/10 px-4 py-1.5 text-xs font-black text-[#2FBF9B]">
            <span>ERROR 404</span>
          </div>

          <div className="space-y-3">
            <h1 className="text-4xl sm:text-6xl font-black tracking-tight text-white">
              Ruta fuera del <span className="text-[#2FBF9B]">camino</span>
            </h1>
            <p className="text-sm sm:text-base text-slate-300 max-w-md mx-auto leading-relaxed">
              La página a la que intentas acceder no existe, fue movida o el enlace está desactualizado.
            </p>
          </div>

          {/* Action Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 max-w-lg mx-auto text-left">
            <Link
              href="/#catalogo"
              className="rounded-2xl bg-[#0E3736] border border-[#2FBF9B]/20 p-4 hover:border-[#2FBF9B]/50 transition-all group shadow-lg"
            >
              <Car className="h-5 w-5 text-[#2FBF9B] mb-2 group-hover:scale-110 transition-transform" />
              <h3 className="text-xs font-bold text-white">Catálogo</h3>
              <p className="text-[11px] text-slate-400 mt-0.5">Ver autos disponibles</p>
            </Link>

            <Link
              href="/cotizador"
              className="rounded-2xl bg-[#0E3736] border border-[#2FBF9B]/20 p-4 hover:border-[#2FBF9B]/50 transition-all group shadow-lg"
            >
              <Search className="h-5 w-5 text-[#2FBF9B] mb-2 group-hover:scale-110 transition-transform" />
              <h3 className="text-xs font-bold text-white">Cotizador</h3>
              <p className="text-[11px] text-slate-400 mt-0.5">Calcular tarifas</p>
            </Link>

            <Link
              href="/garantias"
              className="rounded-2xl bg-[#0E3736] border border-[#2FBF9B]/20 p-4 hover:border-[#2FBF9B]/50 transition-all group shadow-lg"
            >
              <ShieldCheck className="h-5 w-5 text-[#2FBF9B] mb-2 group-hover:scale-110 transition-transform" />
              <h3 className="text-xs font-bold text-white">Garantías</h3>
              <p className="text-[11px] text-slate-400 mt-0.5">Seguro 15 UF y fotos</p>
            </Link>
          </div>

          {/* Primary CTA */}
          <div className="pt-2">
            <Link href="/">
              <Button className="rounded-2xl px-8 py-6 text-xs font-black bg-[#2FBF9B] text-[#061E1F] hover:bg-[#28A787] shadow-xl shadow-[#2FBF9B]/25 gap-2 transition-all hover:scale-105">
                <span>Volver al Inicio</span>
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </main>

      <Footer />
    </>
  );
}
