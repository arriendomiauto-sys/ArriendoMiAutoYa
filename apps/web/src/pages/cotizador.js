import React, { useState, useEffect } from "react";
import Seo from "../components/Seo";
import Link from "next/link";
import { useRouter } from "next/router";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import { Button } from "../components/ui/button";
import { Separator } from "../components/ui/separator";
import {
  Car,
  ShieldCheck,
  Calendar,
  DollarSign,
  MapPin,
  Lock,
  Zap,
  Gauge,
  Fuel,
  Users,
  Check,
  Smartphone,
  ArrowRight,
  Info,
  Clock,
  ChevronRight,
  Star,
  CheckCircle2,
} from "lucide-react";

import { API_BASE_URL } from "../lib/api";

export default function CotizadorPage() {
  const router = useRouter();
  const [autos, setAutos] = useState([]);
  const [selectedAuto, setSelectedAuto] = useState(null);
  const [dias, setDias] = useState(3);
  const [fechaInicio, setFechaInicio] = useState("");
  const [fechaFin, setFechaFin] = useState("");

  useEffect(() => {
    // Default dates: tomorrow to +3 days
    const hoy = new Date();
    const manana = new Date(hoy);
    manana.setDate(hoy.getDate() + 1);
    const retorno = new Date(manana);
    retorno.setDate(manana.getDate() + dias);

    setFechaInicio(manana.toISOString().split("T")[0]);
    setFechaFin(retorno.toISOString().split("T")[0]);

    fetchAutos();
  }, []);

  const fetchAutos = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/autos`);
      if (res.ok) {
        const data = await res.json();
        setAutos(data);
        const autoQuery = router.query.auto;
        const matched = autoQuery ? data.find((a) => a.id === autoQuery) : null;
        setSelectedAuto(matched || data[0]);
      } else {
        throw new Error("fallback");
      }
    } catch {
      const fallback = [
        {
          id: "auto-1",
          marca: "Toyota",
          modelo: "RAV4 Limited 4x4",
          anio: 2023,
          categoria: "suv",
          tarifa_dia: 42000,
          ubicacion_base: "Plaza de Armas, Los Ángeles",
          transmision: "Automática",
          combustible: "Gasolina",
          capacidad: "5 Pasajeros",
          rating: 4.95,
          viajes: 28,
          fotos: ["https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?w=1000&auto=format&fit=crop&q=80"],
        },
        {
          id: "auto-2",
          marca: "Hyundai",
          modelo: "Tucson GL 2.0",
          anio: 2022,
          categoria: "suv",
          tarifa_dia: 35000,
          ubicacion_base: "Av. Alemania, Los Ángeles",
          transmision: "Automática",
          combustible: "Gasolina",
          capacidad: "5 Pasajeros",
          rating: 4.88,
          viajes: 19,
          fotos: ["https://images.unsplash.com/photo-1549399542-7e3f8b79c341?w=1000&auto=format&fit=crop&q=80"],
        },
        {
          id: "auto-3",
          marca: "Suzuki",
          modelo: "Jimny AllGrip 4x4",
          anio: 2024,
          categoria: "4x4",
          tarifa_dia: 48000,
          ubicacion_base: "Av. Gabriela Mistral, Los Ángeles",
          transmision: "Manual",
          combustible: "Gasolina",
          capacidad: "4 Pasajeros",
          rating: 5.0,
          viajes: 34,
          fotos: ["https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?w=1000&auto=format&fit=crop&q=80"],
        },
        {
          id: "auto-4",
          marca: "Chevrolet",
          modelo: "Onix Turbo Premier",
          anio: 2023,
          categoria: "economico",
          tarifa_dia: 28000,
          ubicacion_base: "Terminal Rodoviario, Los Ángeles",
          transmision: "Manual",
          combustible: "Gasolina",
          capacidad: "5 Pasajeros",
          rating: 4.85,
          viajes: 15,
          fotos: ["https://images.unsplash.com/photo-1552519507-da3b142c6e3d?w=1000&auto=format&fit=crop&q=80"],
        },
        {
          id: "auto-5",
          marca: "Ford",
          modelo: "Ranger XLT 4x4",
          anio: 2023,
          categoria: "4x4",
          tarifa_dia: 55000,
          ubicacion_base: "Camino a Antuco, Los Ángeles",
          transmision: "Automática",
          combustible: "Diésel",
          capacidad: "5 Pasajeros",
          rating: 4.98,
          viajes: 42,
          fotos: ["https://images.unsplash.com/photo-1551830820-330a71b99659?w=1000&auto=format&fit=crop&q=80"],
        },
        {
          id: "auto-6",
          marca: "Kia",
          modelo: "Soluto LX 1.4",
          anio: 2022,
          categoria: "economico",
          tarifa_dia: 26000,
          ubicacion_base: "Mall Plaza, Los Ángeles",
          transmision: "Manual",
          combustible: "Gasolina",
          capacidad: "5 Pasajeros",
          rating: 4.9,
          viajes: 22,
          fotos: ["https://images.unsplash.com/photo-1590362891991-f776e747a588?w=1000&auto=format&fit=crop&q=80"],
        },
      ];
      setAutos(fallback);
      const autoQuery = router.query.auto;
      const matched = autoQuery ? fallback.find((a) => a.id === autoQuery) : null;
      setSelectedAuto(matched || fallback[0]);
    }
  };

  // Sync when query param changes
  useEffect(() => {
    if (router.query.auto && autos.length > 0) {
      const found = autos.find((a) => a.id === router.query.auto);
      if (found) setSelectedAuto(found);
    }
    if (router.query.dias) {
      const d = parseInt(router.query.dias);
      if (!isNaN(d) && d > 0) setDias(d);
    }
  }, [router.query, autos]);

  const handleDiasChange = (newDias) => {
    setDias(newDias);
    if (fechaInicio) {
      const start = new Date(fechaInicio);
      const end = new Date(start);
      end.setDate(start.getDate() + newDias);
      setFechaFin(end.toISOString().split("T")[0]);
    }
  };

  const handleFechaInicioChange = (val) => {
    setFechaInicio(val);
    if (val && fechaFin) {
      const d1 = new Date(val);
      const d2 = new Date(fechaFin);
      const diff = Math.round((d2 - d1) / (1000 * 60 * 60 * 24));
      if (diff > 0) {
        setDias(diff);
      } else {
        const next = new Date(d1);
        next.setDate(d1.getDate() + dias);
        setFechaFin(next.toISOString().split("T")[0]);
      }
    }
  };

  const handleFechaFinChange = (val) => {
    setFechaFin(val);
    if (fechaInicio && val) {
      const d1 = new Date(fechaInicio);
      const d2 = new Date(val);
      const diff = Math.round((d2 - d1) / (1000 * 60 * 60 * 24));
      if (diff > 0) {
        setDias(diff);
      }
    }
  };

  const calcular = () => {
    if (!selectedAuto) return { subtotal: 0, holdReserva: 0, holdGarantia: 800000, total: 0, ahorro: 0, kmIncluidos: 0 };
    const subtotal = selectedAuto.tarifa_dia * dias;
    const holdGarantia = 800000;
    const ahorro = Math.round(subtotal * 0.35);
    const kmIncluidos = dias * 250;
    return {
      subtotal,
      holdReserva: subtotal,
      holdGarantia,
      total: subtotal,
      ahorro,
      kmIncluidos,
    };
  };

  const totales = calcular();

  return (
    <>
      <Seo
        title="Cotizador Interactivo de Arriendo de Autos"
        description="Calcula en tiempo real el valor total de tu arriendo con seguro 15 UF (50/50), kilometraje libre y hold de garantía en Los Ángeles, Biobío."
        path="/cotizador"
      />

      <Navbar />

      <main className="min-h-screen bg-[#061E1F] text-white pt-32 pb-24 relative overflow-hidden">
        {/* Subtle Ambient light */}
        <div className="absolute top-20 left-1/4 w-[500px] h-[400px] bg-[#2FBF9B]/10 rounded-full filter blur-[100px] pointer-events-none" />

        <div className="container max-w-6xl mx-auto px-4 sm:px-6 relative z-10 space-y-10">
          
          {/* Header */}
          <div className="text-center max-w-2xl mx-auto space-y-3">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[#2FBF9B]/30 bg-[#2FBF9B]/10 px-3.5 py-1 text-xs font-bold text-[#2FBF9B]">
              <DollarSign className="h-3.5 w-3.5" />
              COTIZADOR EN VIVO
            </span>
            <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-white">
              Cotizador de Arriendo
            </h1>
            <p className="text-sm sm:text-base text-slate-300">
              Selecciona cualquier auto de la flota de Los Ángeles y calcula la tarifa exacta según los días que necesites.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            
            {/* Left: Car Picker & Duration Controls */}
            <div className="lg:col-span-7 space-y-6">
              
              {/* Step 1: Vehicle Selector */}
              <div className="rounded-3xl border border-[#2FBF9B]/20 bg-[#0E3736] p-6 space-y-4 shadow-xl">
                <div className="flex justify-between items-center">
                  <h2 className="text-base font-bold text-white flex items-center gap-2">
                    <Car className="h-4 w-4 text-[#2FBF9B]" />
                    1. Selecciona el Vehículo
                  </h2>
                  <span className="text-xs text-slate-300">
                    {autos.length} autos disponibles
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {autos.map((auto) => {
                    const isSelected = selectedAuto?.id === auto.id;
                    return (
                      <button
                        key={auto.id}
                        onClick={() => setSelectedAuto(auto)}
                        className={`rounded-2xl p-3.5 text-left border transition-all flex items-center gap-3 ${
                          isSelected
                            ? "border-[#2FBF9B] bg-[#061E1F] shadow-md shadow-[#2FBF9B]/15 ring-1 ring-[#2FBF9B]"
                            : "border-white/10 bg-[#061E1F]/60 hover:border-[#2FBF9B]/30"
                        }`}
                      >
                        <img
                          src={auto.fotos?.[0]}
                          alt={auto.modelo}
                          className="h-12 w-16 rounded-xl object-cover shrink-0"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-bold text-white truncate">
                            {auto.marca} {auto.modelo}
                          </div>
                          <div className="text-xs font-black text-[#2FBF9B] mt-0.5">
                            ${auto.tarifa_dia?.toLocaleString("es-CL")} CLP / día
                          </div>
                          <div className="text-[10px] text-slate-400 truncate mt-0.5 flex items-center gap-1">
                            <MapPin className="h-3 w-3 text-[#2FBF9B] shrink-0" />
                            <span className="truncate">{auto.ubicacion_base}</span>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Step 2: Duration Selector & Dates */}
              <div className="rounded-3xl border border-[#2FBF9B]/20 bg-[#0E3736] p-6 space-y-4 shadow-xl">
                <div className="flex justify-between items-center">
                  <h2 className="text-base font-bold text-white flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-[#2FBF9B]" />
                    2. Duración del Arriendo
                  </h2>
                  <span className="text-sm font-black text-[#2FBF9B] bg-[#061E1F] px-3 py-1 rounded-lg border border-[#2FBF9B]/30">
                    {dias} {dias === 1 ? "día" : "días"}
                  </span>
                </div>

                <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
                  {[1, 2, 3, 5, 7, 14, 30].map((d) => (
                    <button
                      key={d}
                      onClick={() => handleDiasChange(d)}
                      className={`py-2.5 rounded-xl text-xs font-bold transition-all ${
                        dias === d
                          ? "bg-[#2FBF9B] text-[#061E1F] shadow-md shadow-[#2FBF9B]/20 scale-105"
                          : "bg-[#061E1F] text-slate-300 hover:text-white border border-white/10 hover:border-[#2FBF9B]/30"
                      }`}
                    >
                      {d} {d === 1 ? "día" : "días"}
                    </button>
                  ))}
                </div>

                {/* Simulated Date Inputs */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-semibold text-slate-300 flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5 text-[#2FBF9B]" />
                      Fecha de Retiro:
                    </label>
                    <input
                      type="date"
                      value={fechaInicio}
                      onChange={(e) => handleFechaInicioChange(e.target.value)}
                      className="w-full bg-[#061E1F] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#2FBF9B]"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-semibold text-slate-300 flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5 text-[#2FBF9B]" />
                      Fecha de Devolución:
                    </label>
                    <input
                      type="date"
                      value={fechaFin}
                      onChange={(e) => handleFechaFinChange(e.target.value)}
                      className="w-full bg-[#061E1F] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#2FBF9B]"
                    />
                  </div>
                </div>

                <div className="pt-2 text-xs text-slate-300 flex items-center gap-2">
                  <Info className="h-4 w-4 text-[#92E3CB] shrink-0" />
                  <span>Incluye <strong>{totales.kmIncluidos} km libres</strong> para circular ({dias * 250} km a razón de 250 km/día).</span>
                </div>
              </div>

            </div>

            {/* Right: Real-Time Live Breakdown Card */}
            <div className="lg:col-span-5">
              <div className="rounded-3xl border border-[#2FBF9B]/20 bg-[#0E3736] p-6 sm:p-7 space-y-6 shadow-2xl sticky top-28">
                
                {selectedAuto && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-3 pb-4 border-b border-white/10">
                      <img
                        src={selectedAuto.fotos?.[0]}
                        alt={selectedAuto.modelo}
                        className="h-16 w-24 rounded-xl object-cover border border-white/10 shrink-0"
                      />
                      <div>
                        <h3 className="font-bold text-white text-base">
                          {selectedAuto.marca} {selectedAuto.modelo}
                        </h3>
                        <div className="text-xs text-slate-300 flex items-center gap-1 mt-0.5">
                          <MapPin className="h-3 w-3 text-[#2FBF9B]" />
                          <span>{selectedAuto.ubicacion_base}</span>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3 text-xs">
                      <div className="flex justify-between text-slate-200">
                        <span>Tarifa diaria (${selectedAuto.tarifa_dia?.toLocaleString("es-CL")} × {dias}d):</span>
                        <span className="font-bold text-white">
                          ${totales.subtotal?.toLocaleString("es-CL")} CLP
                        </span>
                      </div>

                      <div className="flex justify-between text-slate-200">
                        <span>Seguro Deducible 15 UF (50/50):</span>
                        <span className="font-bold text-[#2FBF9B]">Incluido sin costo</span>
                      </div>

                      <div className="flex justify-between text-slate-200">
                        <span>Kilometraje libre ({totales.kmIncluidos} km):</span>
                        <span className="font-bold text-[#2FBF9B]">Incluido</span>
                      </div>

                      <div className="flex justify-between text-slate-200">
                        <span>Hold Garantía (pre-autorización):</span>
                        <span className="font-bold text-[#2FBF9B]">$800.000 CLP</span>
                      </div>

                      <Separator className="my-3 bg-white/10" />

                      <div className="flex justify-between items-center text-sm pt-1">
                        <div>
                          <span className="font-bold text-white block">Total Arriendo:</span>
                          <span className="text-[11px] text-[#92E3CB] font-semibold">
                            Ahorras aprox. ${totales.ahorro?.toLocaleString("es-CL")} CLP
                          </span>
                        </div>
                        <span className="text-2xl font-black text-[#2FBF9B]">
                          ${totales.total?.toLocaleString("es-CL")}{" "}
                          <span className="text-xs font-normal text-slate-300">CLP</span>
                        </span>
                      </div>
                    </div>

                    <div className="rounded-2xl bg-[#061E1F] p-3.5 border border-[#2FBF9B]/20 space-y-1 text-[11px] text-slate-300">
                      <div className="flex items-center gap-1.5 font-bold text-white">
                        <Lock className="h-3.5 w-3.5 text-[#2FBF9B]" />
                        Garantía 100% Protegida
                      </div>
                      <p>El hold de $800.000 se libera automáticamente tras entregar el auto conforme al checklist inmutable de 9 fotos.</p>
                    </div>

                    <a href="/#descargar-app">
                      <Button className="w-full rounded-2xl py-6 font-bold bg-[#2FBF9B] text-[#061E1F] hover:bg-[#28A787] shadow-xl shadow-[#2FBF9B]/20 gap-2 transition-all hover:scale-105">
                        <Smartphone className="h-4 w-4" />
                        <span>Confirmar Reserva en la App</span>
                      </Button>
                    </a>
                  </div>
                )}

              </div>
            </div>

          </div>

        </div>
      </main>

      <Footer />
    </>
  );
}
