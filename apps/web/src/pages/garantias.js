import React, { useState } from "react";
import Seo from "../components/Seo";
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
      <Seo
        title="Centro de Garantías y Seguro 15 UF"
        description="Conoce en detalle el seguro con deducible 15 UF (50/50), la garantía protegida de $800.000 y el checklist inmutable de 9 fotos."
        path="/garantias"
      />

      <Navbar />

      <main className="min-h-screen bg-white text-brand-ink pt-32 pb-24 relative overflow-hidden">
        {/* Ambient light */}
        <div className="absolute top-20 left-1/3 w-[500px] h-[400px] bg-brand-teal/10 rounded-full filter blur-[100px] pointer-events-none" />

        <div className="container max-w-5xl mx-auto px-4 sm:px-6 relative z-10 space-y-16">
          
          {/* Header */}
          <div className="text-center max-w-2xl mx-auto space-y-3">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-line bg-brand-tealTint px-3.5 py-1 text-xs font-bold text-brand-tealInk">
              <ShieldCheck className="h-3.5 w-3.5" />
              SEGURIDAD & COBERTURAS
            </span>
            <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-brand-ink">
              Garantías y Protección Total
            </h1>
            <p className="text-sm sm:text-base text-[#63645f]">
              Protocolos auditados para que tanto dueños como arrendatarios disfruten de cada viaje con absoluta tranquilidad.
            </p>
          </div>

          {/* 3 Pillars Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="rounded-3xl border border-brand-line bg-white p-6 space-y-3 shadow-xl">
              <div className="h-10 w-10 rounded-xl bg-brand-tealTint border border-brand-line flex items-center justify-center text-brand-tealInk">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-bold text-brand-ink">Seguro 15 UF (50/50)</h3>
              <p className="text-xs sm:text-sm text-[#63645f] leading-relaxed">
                En cualquier siniestro cubierto por póliza, el deducible fijado en 15 UF se reparte equitativamente: 50% lo asume la plataforma y 50% el dueño.
              </p>
            </div>

            <div className="rounded-3xl border border-brand-line bg-white p-6 space-y-3 shadow-xl">
              <div className="h-10 w-10 rounded-xl bg-brand-tealTint border border-brand-line flex items-center justify-center text-brand-tealInk">
                <Lock className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-bold text-brand-ink">Hold de $800.000 CLP</h3>
              <p className="text-xs sm:text-sm text-[#63645f] leading-relaxed">
                Pre-autorización bancaria de seguridad (no es cobro directo). Se libera de inmediato tras entregar el vehículo conforme al checklist inicial.
              </p>
            </div>

            <div className="rounded-3xl border border-brand-line bg-white p-6 space-y-3 shadow-xl">
              <div className="h-10 w-10 rounded-xl bg-brand-tealTint border border-brand-line flex items-center justify-center text-brand-tealInk">
                <Camera className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-bold text-brand-ink">Checklist de 9 Fotos</h3>
              <p className="text-xs sm:text-sm text-[#63645f] leading-relaxed">
                Registro inmutable antes y después de cada arriendo para respaldar carrocería, tapiz, kilometraje y nivel de estanque.
              </p>
            </div>
          </div>

          {/* Interactive Checklist Visualizer Demo */}
          <div className="rounded-3xl border border-brand-line bg-white p-6 sm:p-8 space-y-6 shadow-2xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-brand-ink flex items-center gap-2">
                  <Camera className="h-5 w-5 text-brand-tealInk" />
                  Demo de Checklist: Los 9 Ángulos Obligatorios
                </h2>
                <p className="text-xs text-[#63645f]">
                  La app móvil exige registrar cada uno de estos 9 ángulos en la entrega y en la devolución.
                </p>
              </div>

              <div className="inline-flex rounded-xl bg-brand-soft p-1 border border-brand-line text-xs font-bold">
                <button
                  onClick={() => setPhotoView("antes")}
                  className={`px-4 py-2 rounded-lg transition-all ${
                    photoView === "antes"
                      ? "bg-brand-teal text-[#04231b]"
                      : "text-[#63645f] hover:text-brand-ink"
                  }`}
                >
                  Check-in (Entrega)
                </button>
                <button
                  onClick={() => setPhotoView("despues")}
                  className={`px-4 py-2 rounded-lg transition-all ${
                    photoView === "despues"
                      ? "bg-brand-teal text-[#04231b]"
                      : "text-[#63645f] hover:text-brand-ink"
                  }`}
                >
                  Check-out (Devolución)
                </button>
              </div>
            </div>

            {/* 9 Photos Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {photosList.map((item) => (
                <div key={item.id} className="rounded-2xl border border-brand-line bg-white overflow-hidden">
                  <div className="h-36 w-full relative">
                    <img
                      src={photoView === "antes" ? item.antes : item.despues}
                      alt={item.label}
                      className="h-full w-full object-cover"
                    />
                    <span className="absolute bottom-2 left-2 bg-white text-[10px] font-bold text-brand-tealInk px-2 py-0.5 rounded-md border border-brand-line">
                      {photoView === "antes" ? "Inicial" : "Final"}
                    </span>
                  </div>
                  <div className="p-3 text-xs font-bold text-brand-ink">
                    {item.label}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Comparison Matrix */}
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-brand-ink text-center">
              Comparativa de Transparencia
            </h2>
            <div className="rounded-3xl border border-brand-line bg-white overflow-hidden shadow-2xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs sm:text-sm min-w-[560px]">
                  <thead>
                    <tr className="border-b border-brand-line bg-brand-soft">
                      <th className="p-4 sm:p-5 font-bold text-[#63645f]">Aspecto</th>
                      <th className="p-4 sm:p-5 font-bold text-brand-tealInk border-x border-brand-line">ArriendoMiAutoYa</th>
                      <th className="p-4 sm:p-5 font-bold text-[#63645f]">Rent-a-Car Tradicional</th>
                      <th className="p-4 sm:p-5 font-bold text-[#63645f]">Arriendo Informal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-brand-line text-[#63645f]">
                    <tr>
                      <td className="p-4 font-semibold text-brand-ink">Tiempo de entrega</td>
                      <td className="p-4 font-bold text-brand-tealInk border-x border-brand-line">15 min con QR offline</td>
                      <td className="p-4 text-[#63645f]">Trámites y esperas en counter</td>
                      <td className="p-4 text-rose-400">Sin hora clara ni contrato</td>
                    </tr>
                    <tr>
                      <td className="p-4 font-semibold text-brand-ink">Deducible del Seguro</td>
                      <td className="p-4 font-bold text-brand-tealInk border-x border-brand-line">15 UF compartida (50/50)</td>
                      <td className="p-4 text-[#63645f]">Deducibles elevados a costo del cliente</td>
                      <td className="p-4 text-rose-400">Sin seguro comercial</td>
                    </tr>
                    <tr>
                      <td className="p-4 font-semibold text-brand-ink">Hold de Garantía</td>
                      <td className="p-4 font-bold text-brand-tealInk border-x border-brand-line">$800.000 liberado al retorno</td>
                      <td className="p-4 text-[#63645f]">Garantías elevadas con desbloqueo diferido</td>
                      <td className="p-4 text-rose-400">Efectivo retenido sin respaldo</td>
                    </tr>
                    <tr>
                      <td className="p-4 font-semibold text-brand-ink">Checklist de Estado</td>
                      <td className="p-4 font-bold text-brand-tealInk border-x border-brand-line">9 fotos inmutables</td>
                      <td className="p-4 text-[#63645f]">Marcación subjetiva en papel</td>
                      <td className="p-4 text-rose-400">Sin registro fotográfico</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>

        </div>
      </main>

      <Footer />
    </>
  );
}
