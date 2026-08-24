import React, { useState } from "react";
import Head from "next/head";
import Link from "next/link";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import { Button } from "../components/ui/button";
import { Separator } from "../components/ui/separator";
import {
  TrendingUp,
  ShieldCheck,
  DollarSign,
  Car,
  Check,
  Smartphone,
  Sparkles,
  ArrowRight,
  HelpCircle,
  Clock,
  Shield,
  FileCheck2,
} from "lucide-react";

export default function SimuladorDuenosPage() {
  const [diasArriendo, setDiasArriendo] = useState(12);
  const [tarifaDiaria, setTarifaDiaria] = useState(40000);
  const [lavadosEstimados, setLavadosEstimados] = useState(2);

  // Math calculations
  const comisionPlataformaPct = 20; // 20%
  const ingresoBrutoArriendo = diasArriendo * tarifaDiaria;
  const comisionMonto = Math.round(ingresoBrutoArriendo * (comisionPlataformaPct / 100));
  const ingresoNetoArriendo = ingresoBrutoArriendo - comisionMonto;
  const ingresoLavados = lavadosEstimados * 15000; // 100% to owner
  const ingresoTotalNeto = ingresoNetoArriendo + ingresoLavados;
  const ingresoAnualProyectado = ingresoTotalNeto * 12;

  return (
    <>
      <Head>
        <title>Simulador de Ingresos para Dueños de Autos - ArriendoMiAutoYa</title>
        <meta
          name="description"
          content="Calcula cuánto dinero puedes ganar al mes arrendando tu auto en Los Ángeles. Simulación en tiempo real con comisiones transparentes y seguro protegido."
        />
      </Head>

      <Navbar />

      <main className="min-h-screen bg-[#061E1F] text-white pt-32 pb-24 relative overflow-hidden">
        {/* Ambient glow */}
        <div className="absolute top-20 right-1/4 w-[500px] h-[400px] bg-[#2FBF9B]/10 rounded-full filter blur-[100px] pointer-events-none" />

        <div className="container max-w-5xl mx-auto px-4 sm:px-6 relative z-10 space-y-10">
          
          {/* Header */}
          <div className="text-center max-w-2xl mx-auto space-y-3">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[#2FBF9B]/30 bg-[#2FBF9B]/10 px-3.5 py-1 text-xs font-bold text-[#2FBF9B]">
              <TrendingUp className="h-3.5 w-3.5" />
              SIMULADOR DE RENTABILIDAD
            </span>
            <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-white">
              ¿Cuánto puedes ganar con tu auto?
            </h1>
            <p className="text-sm sm:text-base text-slate-300">
              Ajusta los días al mes y tu tarifa estimada para calcular tus ingresos netos en Los Ángeles.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            
            {/* Left: Interactive Controls */}
            <div className="lg:col-span-7 space-y-6">
              
              <div className="rounded-3xl border border-[#2FBF9B]/20 bg-[#0E3736] p-6 sm:p-7 space-y-6 shadow-xl">
                
                {/* Control 1: Days rented */}
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <label className="text-sm font-bold text-white">
                      Días arrendados al mes:
                    </label>
                    <span className="text-base font-black text-[#2FBF9B] bg-[#061E1F] px-3.5 py-1 rounded-xl border border-[#2FBF9B]/30">
                      {diasArriendo} días
                    </span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="28"
                    step="1"
                    value={diasArriendo}
                    onChange={(e) => setDiasArriendo(Number(e.target.value))}
                    className="w-full h-2.5 bg-[#061E1F] rounded-lg appearance-none cursor-pointer accent-[#2FBF9B]"
                  />
                  <div className="flex justify-between text-[11px] text-slate-400 font-medium">
                    <span>1 día</span>
                    <span>14 días (medio mes)</span>
                    <span>28 días</span>
                  </div>
                </div>

                {/* Control 2: Daily Rate */}
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <label className="text-sm font-bold text-white">
                      Tarifa diaria fijada por ti:
                    </label>
                    <span className="text-base font-black text-[#2FBF9B] bg-[#061E1F] px-3.5 py-1 rounded-xl border border-[#2FBF9B]/30">
                      ${tarifaDiaria.toLocaleString("es-CL")} CLP
                    </span>
                  </div>
                  <input
                    type="range"
                    min="20000"
                    max="80000"
                    step="2000"
                    value={tarifaDiaria}
                    onChange={(e) => setTarifaDiaria(Number(e.target.value))}
                    className="w-full h-2.5 bg-[#061E1F] rounded-lg appearance-none cursor-pointer accent-[#2FBF9B]"
                  />
                  <div className="flex justify-between text-[11px] text-slate-400 font-medium">
                    <span>$20.000 (Económico)</span>
                    <span>$45.000 (SUV)</span>
                    <span>$80.000 (4x4)</span>
                  </div>
                </div>

                {/* Control 3: Optional Cleaning fees */}
                <div className="space-y-3 pt-2 border-t border-white/10">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-semibold text-slate-300">
                      Compensaciones estimadas por lavado ($15.000 c/u):
                    </label>
                    <span className="text-xs font-bold text-white bg-[#061E1F] px-2.5 py-1 rounded-lg border border-white/10">
                      {lavadosEstimados} lavados
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="5"
                    step="1"
                    value={lavadosEstimados}
                    onChange={(e) => setLavadosEstimados(Number(e.target.value))}
                    className="w-full h-2 bg-[#061E1F] rounded-lg appearance-none cursor-pointer accent-[#2FBF9B]"
                  />
                </div>

              </div>

              {/* Guarantees Box */}
              <div className="rounded-3xl border border-[#2FBF9B]/20 bg-[#0E3736] p-6 space-y-3">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-[#2FBF9B]" />
                  Garantías incluidas para tu tranquilidad:
                </h3>
                <ul className="space-y-2 text-xs text-slate-300">
                  <li className="flex items-start gap-2">
                    <Check className="h-3.5 w-3.5 text-[#2FBF9B] shrink-0 mt-0.5" />
                    <span><strong>Seguro deducible 15 UF (50/50):</strong> En siniestros cubiertos, la plataforma asume el 50% del deducible.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="h-3.5 w-3.5 text-[#2FBF9B] shrink-0 mt-0.5" />
                    <span><strong>Hold de garantía $800.000:</strong> Pre-autorización bancaria antes de entregar las llaves.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="h-3.5 w-3.5 text-[#2FBF9B] shrink-0 mt-0.5" />
                    <span><strong>Checklist de 9 fotos:</strong> Registro inmutable para respaldar estado de pintura, combustible y tapiz.</span>
                  </li>
                </ul>
              </div>

            </div>

            {/* Right: Net Earnings Result */}
            <div className="lg:col-span-5">
              <div className="rounded-3xl border border-[#2FBF9B]/20 bg-[#0E3736] p-6 sm:p-8 space-y-6 shadow-2xl sticky top-28">
                
                <div className="text-center space-y-2 pb-4 border-b border-white/10">
                  <span className="text-xs font-semibold text-[#92E3CB]">Ingreso Neto Mensual Estimado</span>
                  <div className="text-4xl sm:text-5xl font-black text-[#2FBF9B]">
                    ${ingresoTotalNeto.toLocaleString("es-CL")}
                  </div>
                  <span className="text-xs text-slate-400">CLP / mes en tu cuenta bancaria</span>
                </div>

                <div className="space-y-2.5 text-xs">
                  <div className="flex justify-between text-slate-300">
                    <span>Arriendo bruto ({diasArriendo}d × ${tarifaDiaria.toLocaleString("es-CL")}):</span>
                    <span className="font-semibold text-white">${ingresoBrutoArriendo.toLocaleString("es-CL")} CLP</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Comisión plataforma ({comisionPlataformaPct}%):</span>
                    <span className="text-rose-400">-${comisionMonto.toLocaleString("es-CL")} CLP</span>
                  </div>
                  {ingresoLavados > 0 && (
                    <div className="flex justify-between text-slate-300">
                      <span>Compensación lavado (100% dueño):</span>
                      <span className="font-semibold text-[#2FBF9B]">+${ingresoLavados.toLocaleString("es-CL")} CLP</span>
                    </div>
                  )}

                  <Separator className="my-2 bg-white/10" />

                  <div className="flex justify-between items-center text-xs pt-1">
                    <span className="text-slate-400">Proyección a 12 meses:</span>
                    <span className="font-bold text-[#2FBF9B] text-sm">${ingresoAnualProyectado.toLocaleString("es-CL")} CLP / año</span>
                  </div>
                </div>

                <Link href="/#descargar-app">
                  <Button className="w-full rounded-2xl py-6 font-bold bg-[#2FBF9B] text-[#061E1F] hover:bg-[#28A787] shadow-xl shadow-[#2FBF9B]/25 gap-2 transition-all hover:scale-105">
                    <Car className="h-4 w-4" />
                    <span>Publicar mi Auto en la App</span>
                  </Button>
                </Link>

              </div>
            </div>

          </div>

        </div>
      </main>

      <Footer />
    </>
  );
}
