import React from "react";
import Link from "next/link";
import { Badge } from "./ui/badge";
import { Separator } from "./ui/separator";
import { ShieldCheck, Sparkles, Lock, MapPin } from "lucide-react";

export default function Footer() {
  return (
    <footer className="mt-20 border-t border-border/80 bg-[#0F223D]/60 text-foreground">
      <div className="container max-w-7xl px-4 py-12 sm:px-6">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-12">
          {/* Col 1: Brand & Bio */}
          <div className="md:col-span-5">
            <div className="flex items-center gap-3 mb-3">
              <img
                src="/logo.png"
                alt="ArriendaTuAuto"
                className="h-9 w-9 rounded-xl object-cover border border-[#A8E637]/40 shadow-sm"
              />
              <span className="text-xl font-black tracking-tight text-white">
                Arrienda<span className="text-[#A8E637]">TuAuto</span>
              </span>
            </div>
            <p className="text-sm text-slate-300 leading-relaxed max-w-sm">
              Plataforma tecnológica de car-sharing entre particulares en Los Ángeles, Región del Biobío, Chile. Seguro con deducible 15 UF 50/50, validación de identidad OCR y garantía protegida.
            </p>
            <div className="mt-4 flex items-center gap-2 text-xs text-[#A8E637] font-semibold">
              <MapPin className="h-3.5 w-3.5 shrink-0" />
              <span>Operación local exclusiva en comuna de Los Ángeles (Radio 30 km)</span>
            </div>
          </div>

          {/* Col 2: Reglas de Seguridad & Garantías */}
          <div className="md:col-span-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
              Garantías de la Plataforma
            </h4>
            <div className="flex flex-col gap-2.5">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-md border border-[#A8E637]/30 bg-[#111827] px-2.5 py-1 text-xs font-semibold text-[#A8E637]">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Deducible 15 UF (50% Empresa / 50% Dueño)
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-md border border-[#A8E637]/30 bg-[#111827] px-2.5 py-1 text-xs font-semibold text-white">
                  <Lock className="h-3.5 w-3.5 text-[#A8E637]" />
                  Hold Garantía Enrolamiento $800.000 CLP
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-md border border-border bg-[#111827] px-2.5 py-1 text-xs font-semibold text-slate-300">
                  <Sparkles className="h-3.5 w-3.5 text-[#A8E637]" />
                  Inspección 9 Fotos Antes / Después
                </span>
              </div>
            </div>
          </div>

          {/* Col 3: Enlaces Rápidos */}
          <div className="md:col-span-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
              Navegación & Soporte
            </h4>
            <ul className="space-y-2 text-sm text-slate-300">
              <li>
                <Link href="/" className="hover:text-[#A8E637] transition-colors">
                  Catálogo de Vehículos
                </Link>
              </li>
              <li>
                <Link href="/manager" className="hover:text-[#A8E637] transition-colors">
                  Panel Sucursal Los Ángeles
                </Link>
              </li>
              <li>
                <Link href="/admin" className="hover:text-[#A8E637] transition-colors">
                  Panel Administrador General
                </Link>
              </li>
              <li>
                <a href="#descargar-app" className="hover:text-[#A8E637] transition-colors">
                  Descarga App Móvil (Expo/React Native)
                </a>
              </li>
            </ul>
          </div>
        </div>

        <Separator className="my-8 bg-border/60" />

        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-400">
          <p>© 2026 ArriendaTuAuto Chile SpA. Todos los derechos reservados.</p>
          <div className="flex gap-6">
            <span className="hover:text-white cursor-pointer">Términos y Condiciones</span>
            <span className="hover:text-white cursor-pointer">Política de Privacidad</span>
            <span className="hover:text-white cursor-pointer">Contrato de Arriendo Tipo</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
