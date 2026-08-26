import React, { useState } from "react";
import Head from "next/head";
import Link from "next/link";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import { Button } from "../components/ui/button";
import {
  ShieldCheck,
  Lock,
  Camera,
  Zap,
  Check,
  X,
  Smartphone,
  Shield,
  FileCheck2,
  HelpCircle,
  Car,
} from "lucide-react";

export default function GarantiasPage() {
  const [photoView, setPhotoView] = useState("antes"); // 'antes' | 'despues'

  const photosList = [
    { id: 1, label: "1. Frontal y Patente", antes: "https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?w=600", despues: "https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?w=600" },
    { id: 2, label: "2. Trasera y Luces", antes: "https://images.unsplash.com/photo-1549399542-7e3f8b79c341?w=600", despues: "https://images.unsplash.com/photo-1549399542-7e3f8b79c341?w=600" },
    { id: 3, label: "3. Costado Izquierdo", antes: "https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?w=600", despues: "https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?w=600" },
    { id: 4, label: "4. Costado Derecho", antes: "https://images.unsplash.com/photo-1552519507-da3b142c6e3d?w=600", despues: "https://images.unsplash.com/photo-1552519507-da3b142c6e3d?w=600" },
    { id: 5, label: "5. Tablero (Kilometraje)", antes: "https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=600", despues: "https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=600" },
    { id: 6, label: "6. Nivel de Combustible", antes: "https://images.unsplash.com/photo-1617814076367-b759c7d7e738?w=600", despues: "https://images.unsplash.com/photo-1617814076367-b759c7d7e738?w=600" },
    { id: 7, label: "7. Asientos Delanteros", antes: "https://images.unsplash.com/photo-1583121274602-3e2820c69888?w=600", despues: "https://images.unsplash.com/photo-1583121274602-3e2820c69888?w=600" },
    { id: 8, label: "8. Asientos Traseros", antes: "https://images.unsplash.com/photo-1590362891991-f776e747a588?w=600", despues: "https://images.unsplash.com/photo-1590362891991-f776e747a588?w=600" },
    { id: 9, label: "9. Rueda de Repuesto / Maleta", antes: "https://images.unsplash.com/photo-1551830820-330a71b99659?w=600", despues: "https://images.unsplash.com/photo-1551830820-330a71b99659?w=600" },
  ];

  return (
    <>
      <Head>
        <title>Centro de Garantías y Seguro 15 UF - ArriendoMiAutoYa</title>
        <meta
          name="description"
          content="Conoce en detalle el seguro con deducible 15 UF (50/50), la garantía protegida de $800.000 y el checklist inmutable de 9 fotos."
        />
      </Head>

      <Navbar />

      <main className="min-h-screen bg-[#061E1F] text-white pt-32 pb-24 relative overflow-hidden">
        {/* Ambient light */}
        <div className="absolute top-20 left-1/3 w-[500px] h-[400px] bg-[#2FBF9B]/10 rounded-full filter blur-[100px] pointer-events-none" />

        <div className="container max-w-5xl mx-auto px-4 sm:px-6 relative z-10 space-y-16">
          
          {/* Header */}
          <div className="text-center max-w-2xl mx-auto space-y-3">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[#2FBF9B]/30 bg-[#2FBF9B]/10 px-3.5 py-1 text-xs font-bold text-[#2FBF9B]">
              <ShieldCheck className="h-3.5 w-3.5" />
              SEGURIDAD & COBERTURAS
            </span>
            <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-white">
              Garantías y Protocolos de Seguridad
            </h1>
            <p className="text-sm sm:text-base text-slate-300">
              Protocolos auditados para que tanto dueños como arrendatarios operen con la mayor transparencia posible en cada viaje.
            </p>
          </div>

          {/* 3 Pillars Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="rounded-3xl border border-[#2FBF9B]/20 bg-[#0E3736] p-6 space-y-3 shadow-xl">
              <div className="h-10 w-10 rounded-xl bg-[#2FBF9B]/10 border border-[#2FBF9B]/20 flex items-center justify-center text-[#2FBF9B]">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-bold text-white">Deducible 15 UF (50/50)</h3>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                Modelo de reparto acordado para cuando la póliza de seguro comercial de flota esté vigente: 15 UF de deducible dividido 50% plataforma / 50% dueño. Ver Términos, cláusula 3, para el estado actual de la cobertura.
              </p>
            </div>

            <div className="rounded-3xl border border-[#2FBF9B]/20 bg-[#0E3736] p-6 space-y-3 shadow-xl">
              <div className="h-10 w-10 rounded-xl bg-[#2FBF9B]/10 border border-[#2FBF9B]/20 flex items-center justify-center text-[#2FBF9B]">
                <Lock className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-bold text-white">Hold de $800.000 CLP</h3>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                Pre-autorización bancaria de seguridad (no es cobro directo). Se libera de inmediato tras entregar el vehículo conforme al checklist inicial.
              </p>
            </div>

            <div className="rounded-3xl border border-[#2FBF9B]/20 bg-[#0E3736] p-6 space-y-3 shadow-xl">
              <div className="h-10 w-10 rounded-xl bg-[#2FBF9B]/10 border border-[#2FBF9B]/20 flex items-center justify-center text-[#2FBF9B]">
                <Camera className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-bold text-white">Checklist de 9 Fotos</h3>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                Registro inmutable antes y después de cada arriendo para respaldar carrocería, tapiz, kilometraje y nivel de estanque.
              </p>
            </div>
          </div>

          {/* Interactive Checklist Visualizer Demo */}
          <div className="rounded-3xl border border-[#2FBF9B]/20 bg-[#0E3736] p-6 sm:p-8 space-y-6 shadow-2xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <Camera className="h-5 w-5 text-[#2FBF9B]" />
                  Demo de Checklist: Los 9 Ángulos Obligatorios
                </h2>
                <p className="text-xs text-slate-300">
                  La app móvil exige registrar cada uno de estos 9 ángulos en la entrega y en la devolución.
                </p>
              </div>

              <div className="inline-flex rounded-xl bg-[#061E1F] p-1 border border-white/10 text-xs font-bold">
                <button
                  onClick={() => setPhotoView("antes")}
                  className={`px-4 py-2 rounded-lg transition-all ${
                    photoView === "antes"
                      ? "bg-[#2FBF9B] text-[#061E1F]"
                      : "text-slate-300 hover:text-white"
                  }`}
                >
                  Check-in (Entrega)
                </button>
                <button
                  onClick={() => setPhotoView("despues")}
                  className={`px-4 py-2 rounded-lg transition-all ${
                    photoView === "despues"
                      ? "bg-[#2FBF9B] text-[#061E1F]"
                      : "text-slate-300 hover:text-white"
                  }`}
                >
                  Check-out (Devolución)
                </button>
              </div>
            </div>

            {/* 9 Photos Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {photosList.map((item) => (
                <div key={item.id} className="rounded-2xl border border-white/10 bg-[#061E1F] overflow-hidden">
                  <div className="h-36 w-full relative">
                    <img
                      src={photoView === "antes" ? item.antes : item.despues}
                      alt={item.label}
                      className="h-full w-full object-cover"
                    />
                    <span className="absolute bottom-2 left-2 bg-[#061E1F]/90 text-[10px] font-bold text-[#2FBF9B] px-2 py-0.5 rounded-md border border-[#2FBF9B]/30">
                      {photoView === "antes" ? "Inicial" : "Final"}
                    </span>
                  </div>
                  <div className="p-3 text-xs font-bold text-white">
                    {item.label}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Comparison Matrix */}
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-white text-center">
              Comparativa de Transparencia
            </h2>
            <div className="rounded-3xl border border-[#2FBF9B]/20 bg-[#0E3736] overflow-hidden shadow-2xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs sm:text-sm min-w-[560px]">
                  <thead>
                    <tr className="border-b border-white/10 bg-[#061E1F]">
                      <th className="p-4 sm:p-5 font-bold text-slate-300">Aspecto</th>
                      <th className="p-4 sm:p-5 font-bold text-[#2FBF9B] border-x border-white/10">ArriendoMiAutoYa</th>
                      <th className="p-4 sm:p-5 font-bold text-slate-400">Rent-a-Car Tradicional</th>
                      <th className="p-4 sm:p-5 font-bold text-slate-400">Arriendo Informal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 text-slate-300">
                    <tr>
                      <td className="p-4 font-semibold text-white">Tiempo de entrega</td>
                      <td className="p-4 font-bold text-[#2FBF9B] border-x border-white/5">15 min con QR offline</td>
                      <td className="p-4 text-slate-400">Trámites y esperas en counter</td>
                      <td className="p-4 text-rose-400">Sin hora clara ni contrato</td>
                    </tr>
                    <tr>
                      <td className="p-4 font-semibold text-white">Deducible del Seguro*</td>
                      <td className="p-4 font-bold text-[#2FBF9B] border-x border-white/5">15 UF compartida (50/50)</td>
                      <td className="p-4 text-slate-400">Deducibles elevados a costo del cliente</td>
                      <td className="p-4 text-rose-400">Sin seguro comercial</td>
                    </tr>
                    <tr>
                      <td className="p-4 font-semibold text-white">Hold de Garantía</td>
                      <td className="p-4 font-bold text-[#2FBF9B] border-x border-white/5">$800.000 liberado al retorno</td>
                      <td className="p-4 text-slate-400">Garantías elevadas con desbloqueo diferido</td>
                      <td className="p-4 text-rose-400">Efectivo retenido sin respaldo</td>
                    </tr>
                    <tr>
                      <td className="p-4 font-semibold text-white">Checklist de Estado</td>
                      <td className="p-4 font-bold text-[#2FBF9B] border-x border-white/5">9 fotos inmutables</td>
                      <td className="p-4 text-slate-400">Marcación subjetiva en papel</td>
                      <td className="p-4 text-rose-400">Sin registro fotográfico</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p className="px-4 sm:px-5 py-3 text-[11px] text-slate-400 border-t border-white/10">
                * Deducible aplicable una vez vigente la póliza de seguro comercial de flota de la plataforma. Ver Términos y Condiciones, cláusula 3, para el estado actual de la cobertura.
              </p>
            </div>
          </div>

        </div>
      </main>

      <Footer />
    </>
  );
}
