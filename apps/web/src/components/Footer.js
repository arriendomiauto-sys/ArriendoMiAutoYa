import React from "react";
import Link from "next/link";
import { Separator } from "./ui/separator";
import { MapPin, ShieldCheck, Camera, FileCheck2 } from "lucide-react";

export default function Footer() {
  return (
    <footer className="relative bg-[#041415] text-foreground pt-16 pb-10 border-t border-[#2FBF9B]/10 overflow-hidden">
      <div className="container max-w-7xl mx-auto px-4 sm:px-6 relative z-10">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-12 pb-12">

          {/* Col 1: Brand */}
          <div className="md:col-span-5 space-y-4">
            <div className="flex items-center gap-3">
              <img
                src="/logo.png"
                alt="ArriendoMiAutoYa"
                className="h-10 w-10 sm:h-11 sm:w-11 rounded-2xl object-cover shadow-lg"
              />
              <span className="text-xl font-black tracking-tight text-white">
                ARRIENDO<span className="text-[#2FBF9B]">MIAUTOYA</span>
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed max-w-sm font-normal">
              Car-sharing verificado entre personas en <strong>Los Ángeles, Región del Biobío</strong>. Deducible 15 UF
              (50/50), traspaso seguro con código QR e inspección fotográfica auditada.
            </p>
            <div className="inline-flex items-center gap-2 rounded-full border border-[#2FBF9B]/20 bg-[#0F3D3E]/40 px-3.5 py-1.5 text-xs text-[#92E3CB]">
              <MapPin className="h-3.5 w-3.5 text-[#2FBF9B] shrink-0" />
              <span>Operación exclusiva comuna de Los Ángeles (radio 30 km)</span>
            </div>
          </div>

          {/* Col 2: Platform */}
          <div className="md:col-span-3 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#92E3CB]">
              Plataforma
            </h4>
            <ul className="space-y-2 text-xs text-slate-300">
              <li>
                <Link href="/#como-funciona" className="hover:text-[#2FBF9B] transition-colors">
                  Cómo funciona
                </Link>
              </li>
              <li>
                <Link href="/#catalogo" className="hover:text-[#2FBF9B] transition-colors">
                  Catálogo y cotizador
                </Link>
              </li>
              <li>
                <Link href="/simulador-duenos" className="hover:text-[#2FBF9B] transition-colors">
                  Simulador de ingresos
                </Link>
              </li>
            </ul>
          </div>

          {/* Col 3: Guarantees */}
          <div className="md:col-span-4 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#92E3CB]">
              Garantías y Seguridad
            </h4>
            <ul className="space-y-2 text-xs text-slate-300">
              <li>
                <Link href="/garantias" className="hover:text-[#2FBF9B] transition-colors flex items-center gap-2">
                  <ShieldCheck className="h-3.5 w-3.5 text-[#2FBF9B]" />
                  Seguro 15 UF (50/50) y hold $800.000
                </Link>
              </li>
              <li>
                <Link href="/garantias" className="hover:text-[#2FBF9B] transition-colors flex items-center gap-2">
                  <Camera className="h-3.5 w-3.5 text-[#2FBF9B]" />
                  Checklist de 9 fotos obligatorias
                </Link>
              </li>
              <li>
                <Link href="/garantias" className="hover:text-[#2FBF9B] transition-colors flex items-center gap-2">
                  <FileCheck2 className="h-3.5 w-3.5 text-[#2FBF9B]" />
                  Contrato digital con licencia validada
                </Link>
              </li>
              <li>
                <Link href="/garantias" className="hover:text-[#2FBF9B] transition-colors">
                  Ver preguntas frecuentes →
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <Separator className="my-6 bg-white/5" />

        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-400">
          <p>© 2026 ARRIENDOMIAUTOYA CHILE SpA. Los Ángeles, Región del Biobío.</p>
          <div className="flex items-center gap-5 text-xs text-slate-400">
            <Link href="/terminos" className="hover:text-[#2FBF9B] transition-colors">
              Términos y Condiciones
            </Link>
            <span className="text-white/20">•</span>
            <Link href="/privacidad" className="hover:text-[#2FBF9B] transition-colors">
              Política de Privacidad
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
