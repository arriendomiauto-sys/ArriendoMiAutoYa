import React, { useState, useEffect } from "react";
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import { Button } from "../components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "../components/ui/dialog";
import {
  ShieldCheck,
  MapPin,
  Gauge,
  Lock,
  Users,
  Search,
  Check,
  ArrowUpRight,
  Camera,
  FileText,
  Star,
  ChevronDown,
  Smartphone,
  QrCode,
} from "lucide-react";

/* ──────────────── DATOS FALLBACK ──────────────── */
const AUTOS_FALLBACK = [
  {
    id: "auto-1", marca: "Toyota", modelo: "RAV4 Limited", anio: 2023, categoria: "suv",
    tarifa_dia: 42000, ubicacion_base: "Plaza de Armas", transmision: "Automática",
    combustible: "Gasolina", capacidad: "5 Pasajeros", rating: 4.9, viajes: 28,
    badge: "VERIFICADO",
    foto: "/cars/toyota-rav4.jpg",
  },
  {
    id: "auto-2", marca: "Hyundai", modelo: "Tucson GL", anio: 2022, categoria: "suv",
    tarifa_dia: 35000, ubicacion_base: "Av. Alemania", transmision: "Automática",
    combustible: "Gasolina", capacidad: "5 Pasajeros", rating: 4.8, viajes: 19,
    badge: "MÁS PEDIDO",
    foto: "/cars/hyundai-tucson.jpg",
  },
  {
    id: "auto-3", marca: "Suzuki", modelo: "Jimny AllGrip", anio: 2024, categoria: "4x4",
    tarifa_dia: 48000, ubicacion_base: "Av. Gabriela Mistral", transmision: "Manual",
    combustible: "Gasolina", capacidad: "4 Pasajeros", rating: 5.0, viajes: 34,
    badge: "NUEVO",
    foto: "/cars/suzuki-jimny.jpg",
  },
  {
    id: "auto-4", marca: "Chevrolet", modelo: "Onix Turbo", anio: 2023, categoria: "economico",
    tarifa_dia: 28000, ubicacion_base: "Terminal Rodoviario", transmision: "Manual",
    combustible: "Gasolina", capacidad: "5 Pasajeros", rating: 4.7, viajes: 15,
    badge: "VERIFICADO",
    foto: "/cars/chevrolet-onix.jpg",
  },
  {
    id: "auto-5", marca: "Ford", modelo: "Ranger XLT 4x4", anio: 2023, categoria: "4x4",
    tarifa_dia: 55000, ubicacion_base: "Camino a Antuco", transmision: "Automática",
    combustible: "Diésel", capacidad: "5 Pasajeros", rating: 4.9, viajes: 42,
    badge: "TOP RATE",
    foto: "/cars/ford-ranger.jpg",
  },
  {
    id: "auto-6", marca: "Kia", modelo: "Soluto LX 1.4", anio: 2022, categoria: "economico",
    tarifa_dia: 26000, ubicacion_base: "Mall Plaza", transmision: "Manual",
    combustible: "Gasolina", capacidad: "5 Pasajeros", rating: 4.6, viajes: 22,
    badge: "VERIFICADO",
    foto: "/cars/kia-soluto.jpg",
  },
];

/* ──────────────── COMPONENTE PRINCIPAL ──────────────── */
export default function Home() {
  const router = useRouter();
  const [autos, setAutos] = useState(AUTOS_FALLBACK);
  const [filteredAutos, setFilteredAutos] = useState(AUTOS_FALLBACK);
  const [modalAuto, setModalAuto] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState("todos");
  const [searchQuery, setSearchQuery] = useState("");
  const [openFaq, setOpenFaq] = useState(null);

  // Owner interactive simulator
  const [diasAlMes, setDiasAlMes] = useState(10);
  const tarifaEstimada = 38000;
  const ingresoNeto = Math.round(diasAlMes * tarifaEstimada * 0.8);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("http://localhost:8000/api/v1/autos");
        if (res.ok) { const d = await res.json(); setAutos(d); setFilteredAutos(d); }
      } catch { /* use fallback */ }
    })();
  }, []);

  useEffect(() => {
    let r = [...autos];
    if (selectedCategory !== "todos") r = r.filter((a) => a.categoria === selectedCategory);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      r = r.filter((a) =>
        a.marca.toLowerCase().includes(q) || a.modelo.toLowerCase().includes(q) || a.ubicacion_base.toLowerCase().includes(q)
      );
    }
    setFilteredAutos(r);
  }, [selectedCategory, searchQuery, autos]);

  const categories = [
    { id: "todos", label: "Todos" },
    { id: "suv", label: "SUVs" },
    { id: "4x4", label: "4x4" },
    { id: "economico", label: "Económicos" },
  ];

  const faqs = [
    { q: "¿Cómo funciona el seguro y el deducible de 15 UF?", a: "Cada arriendo incluye seguro con deducible de 15 UF compartido (50/50) entre arrendatario y dueño. Ante un siniestro cubierto, cada parte asume la mitad del deducible y la aseguradora el resto." },
    { q: "¿Qué es el Hold de Garantía de $800.000?", a: "Es una retención temporal en tu tarjeta, no un cobro. Se libera al devolver el vehículo conforme al checklist de 9 fotos." },
    { q: "¿Qué documentos necesito para arrendar?", a: "Solo tu Cédula de Identidad chilena al día y Licencia de Conducir Clase B. La validación es digital y toma menos de 1 minuto." },
    { q: "¿Cómo es la entrega del vehículo?", a: "Te reúnes con el dueño en el punto pactado en Los Ángeles, revisan juntos el checklist de 9 fotos y escanean el código QR en la app para transferir las llaves." },
  ];

  return (
    <>
      <Head>
        <title>ArriendoMiAutoYa — Arriendo de autos entre personas en Los Ángeles</title>
        <meta name="description" content="Arrienda autos directamente de sus dueños en Los Ángeles, Biobío con ArriendoMiAutoYa. Seguro 15 UF, validación digital en 1 minuto y entrega segura con código QR." />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=5" />
      </Head>

      <Navbar />

      <main className="min-h-screen bg-[#060B16] text-white">

        {/* ═══════════════════════════════════════════════════════════════════
            HERO — Split layout: text left, car image right
        ═══════════════════════════════════════════════════════════════════ */}
        <section className="relative pt-28 sm:pt-36 pb-16 sm:pb-24 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-[#0A1124] via-[#060B16] to-[#060B16]" />

          <div className="container max-w-7xl mx-auto px-4 sm:px-6 relative z-10">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center">

              {/* Left: Copy */}
              <div className="space-y-6 max-w-xl">
                <div className="inline-flex items-center gap-2 rounded-full border border-[#FBBF24]/30 bg-[#FBBF24]/10 px-4 py-1.5 text-xs font-black text-[#FBBF24] tracking-wide">
                  <MapPin className="h-3.5 w-3.5" />
                  ARRIENDO LOCAL EN LOS ÁNGELES, BIOBÍO
                </div>

                <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight leading-[1.08]">
                  TU AUTO IDEAL.{" "}
                  <span className="text-[#FBBF24]">DIRECTO</span>
                  <br />
                  DE SU DUEÑO.
                </h1>

                <p className="text-sm sm:text-base text-slate-300 leading-relaxed max-w-md font-normal">
                  Olvídate de mesones eternos y letras chicas. Arrienda autos impecables listos para rodar, con
                  seguro 15 UF (50/50), validación digital en 60 segundos y entrega protegida con código QR.
                </p>

                {/* Search Bar */}
                <div className="flex flex-col sm:flex-row items-stretch gap-2 bg-[#0D1528] rounded-2xl border border-white/10 p-2 max-w-lg shadow-xl">
                  <div className="flex items-center gap-2 flex-1 px-3">
                    <MapPin className="h-4 w-4 text-[#FBBF24] shrink-0" />
                    <span className="text-xs text-slate-200 font-bold whitespace-nowrap">Los Ángeles, Biobío</span>
                  </div>
                  <div className="flex items-center gap-2 flex-1 border-l border-white/10 px-3">
                    <Search className="h-4 w-4 text-slate-400 shrink-0" />
                    <input
                      type="text"
                      placeholder="4x4, SUV, económico..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="bg-transparent text-xs text-white placeholder:text-slate-500 focus:outline-none w-full py-2"
                    />
                  </div>
                  <a href="#catalogo">
                    <Button className="rounded-xl px-6 py-5 text-xs font-black bg-[#FBBF24] text-[#060B16] hover:bg-[#F59E0B] shadow-lg shadow-[#FBBF24]/20 gap-1.5 whitespace-nowrap w-full sm:w-auto uppercase tracking-wider">
                      <Search className="h-3.5 w-3.5" />
                      BUSCAR
                    </Button>
                  </a>
                </div>
              </div>

              {/* Right: Hero Car Image */}
              <div className="relative hidden lg:block">
                <div className="relative rounded-3xl overflow-hidden shadow-2xl shadow-black/60 border border-white/10">
                  <img
                    src="/hero-bg-BtEUgRp2.jpg"
                    alt="Auto en carretera"
                    className="w-full h-[390px] object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#060B16]/70 via-transparent to-transparent" />
                </div>
                {/* Floating Badge */}
                <div className="absolute -bottom-4 right-8 bg-[#FBBF24] text-[#060B16] rounded-2xl px-5 py-3.5 shadow-2xl shadow-[#FBBF24]/30 border border-[#FBBF24]/50">
                  <div className="text-2xl font-black leading-none">+500</div>
                  <div className="text-[10px] font-black uppercase tracking-wider mt-0.5">Viajes realizados</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════════════
            CÓMO FUNCIONA — 3 Steps with circle numbers
        ═══════════════════════════════════════════════════════════════════ */}
        <section id="como-funciona" className="py-16 sm:py-24 bg-[#0D1528]">
          <div className="container max-w-5xl mx-auto px-4 sm:px-6 space-y-14">
            <div className="text-center space-y-2">
              <h2 className="text-2xl sm:text-4xl font-black text-white">Tu viaje en 3 simples pasos</h2>
              <p className="text-xs sm:text-sm text-slate-400 max-w-md mx-auto">
                La forma más rápida, transparente y confiable de moverte por la Región del Biobío.
              </p>
              <div className="w-16 h-0.5 bg-[#FBBF24] mx-auto mt-4" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-10 text-center">
              {[
                { n: "1", title: "Elige tu vehículo", desc: "Filtra por modelo, 4x4 o SUV verificado en Los Ángeles y reserva los días exactos que necesitas." },
                { n: "2", title: "Validación relámpago", desc: "Sube tu cédula y licencia chilena. Tu contrato digital queda blindado en 60 segundos." },
                { n: "3", title: "Llaves con QR", desc: "Reúnete con el dueño, revisen el checklist de 9 fotos y ¡a disfrutar el camino!" },
              ].map((step) => (
                <div key={step.n} className="flex flex-col items-center space-y-4">
                  <div className="h-16 w-16 rounded-full border-2 border-[#FBBF24] flex items-center justify-center text-2xl font-black text-[#FBBF24] bg-[#FBBF24]/5">
                    {step.n}
                  </div>
                  <h3 className="text-base font-bold text-white">{step.title}</h3>
                  <p className="text-xs text-slate-400 leading-relaxed max-w-[260px]">{step.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════════════
            CATÁLOGO — "Explora la flota" with category pills & 3-col grid
        ═══════════════════════════════════════════════════════════════════ */}
        <section id="catalogo" className="py-16 sm:py-24 bg-[#060B16]">
          <div className="container max-w-7xl mx-auto px-4 sm:px-6 space-y-8">

            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
              <div>
                <h2 className="text-2xl sm:text-4xl font-black text-white">Autos listos para tu viaje</h2>
                <p className="text-sm text-slate-400 mt-1">Vehículos verificados por sus propios dueños en la comuna de Los Ángeles.</p>
              </div>
              <div className="flex gap-2 flex-wrap">
                {categories.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setSelectedCategory(c.id)}
                    className={`px-4 py-2 rounded-full text-xs font-bold transition-all ${
                      selectedCategory === c.id
                        ? "bg-[#FBBF24] text-[#060B16]"
                        : "bg-white/5 text-slate-300 border border-white/10 hover:bg-white/10"
                    }`}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Grid of Cars */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredAutos.map((auto) => (
                <div
                  key={auto.id}
                  className="rounded-2xl border border-white/10 bg-[#0D1528] overflow-hidden group hover:border-[#FBBF24]/40 transition-all flex flex-col"
                >
                  {/* Image */}
                  <div className="relative h-52 overflow-hidden bg-slate-900">
                    <img
                      src={auto.foto || auto.fotos?.[0]}
                      alt={`${auto.marca} ${auto.modelo}`}
                      className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <span className="absolute top-3 right-3 bg-[#060B16]/90 text-white text-[10px] font-bold uppercase px-2.5 py-1 rounded-md border border-white/15 tracking-wide backdrop-blur-sm">
                      {auto.badge || "VERIFICADO"}
                    </span>
                  </div>

                  {/* Body */}
                  <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                    <div>
                      {/* Title + Price */}
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h3 className="text-base font-bold text-white">
                            {auto.marca} {auto.modelo}
                          </h3>
                          <p className="text-xs text-slate-400 mt-0.5">Automática · {auto.anio}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="text-lg font-black text-[#FBBF24]">
                            ${auto.tarifa_dia?.toLocaleString("es-CL")}
                          </span>
                          <span className="block text-[10px] text-slate-400 uppercase">CLP / DÍA</span>
                        </div>
                      </div>

                      {/* Location */}
                      <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-2">
                        <MapPin className="h-3 w-3 text-[#EF4444] shrink-0" />
                        <span>{auto.ubicacion_base}</span>
                      </div>

                      {/* Specs row */}
                      <div className="flex items-center gap-4 text-[11px] text-slate-300 mt-3 pt-3 border-t border-white/5">
                        <span className="flex items-center gap-1">
                          <Gauge className="h-3 w-3 text-[#FBBF24]" />
                          {auto.transmision}
                        </span>
                        <span className="flex items-center gap-1">
                          <Users className="h-3 w-3 text-[#FBBF24]" />
                          {auto.capacidad}
                        </span>
                        <span className="flex items-center gap-1 ml-auto">
                          <Star className="h-3 w-3 text-[#FBBF24] fill-[#FBBF24]" />
                          {auto.rating}
                        </span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 pt-1">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setModalAuto(auto)}
                        className="flex-1 rounded-xl text-xs font-semibold border-white/15 text-white hover:border-white/30"
                      >
                        Ficha
                      </Button>
                      <Link href={`/cotizador?auto=${auto.id}`} className="flex-1">
                        <Button
                          size="sm"
                          className="w-full rounded-xl text-xs font-bold bg-[#FBBF24] text-[#060B16] hover:bg-[#F59E0B]"
                        >
                          Cotizar
                        </Button>
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {filteredAutos.length === 0 && (
              <div className="text-center py-16 space-y-3">
                <p className="text-slate-400 text-sm">No se encontraron vehículos con esos filtros.</p>
                <Button variant="outline" size="sm" onClick={() => { setSearchQuery(""); setSelectedCategory("todos"); }} className="rounded-xl text-xs">
                  Restablecer filtros
                </Button>
              </div>
            )}
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════════════
            GARANTÍAS — 4 cards in a row
        ═══════════════════════════════════════════════════════════════════ */}
        <section className="py-16 sm:py-20 bg-[#0D1528] border-y border-white/5">
          <div className="container max-w-6xl mx-auto px-4 sm:px-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                { icon: <ShieldCheck className="h-6 w-6" />, title: "Seguro 15 UF", desc: "Deducible compartido 50/50 entre dueño y arrendatario." },
                { icon: <Lock className="h-6 w-6" />, title: "Hold $800.000", desc: "Bloqueo temporal en tarjeta, no es un cobro. Se libera al devolver." },
                { icon: <Camera className="h-6 w-6" />, title: "9 fotos obligatorias", desc: "Checklist fotográfico auditado en cada entrega y devolución." },
                { icon: <FileText className="h-6 w-6" />, title: "Contrato digital", desc: "Firmado en línea con cédula y licencia clase B validadas." },
              ].map((item, i) => (
                <Link href="/garantias" key={i} className="rounded-2xl border border-white/10 bg-[#060B16] p-6 hover:border-[#FBBF24]/30 transition-all group">
                  <div className="h-12 w-12 rounded-xl bg-[#FBBF24]/10 border border-[#FBBF24]/20 flex items-center justify-center text-[#FBBF24] group-hover:bg-[#FBBF24]/20 transition-colors mb-4">
                    {item.icon}
                  </div>
                  <h3 className="text-sm font-bold text-white mb-1">{item.title}</h3>
                  <p className="text-xs text-slate-400 leading-relaxed">{item.desc}</p>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════════════
            DUEÑOS — Vibrant Yellow card with dark interactive simulator
        ═══════════════════════════════════════════════════════════════════ */}
        <section id="propietarios" className="py-16 sm:py-24 bg-[#060B16]">
          <div className="container max-w-5xl mx-auto px-4 sm:px-6">
            <div className="rounded-3xl bg-[#FBBF24] text-[#060B16] p-8 sm:p-14 shadow-2xl">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">

                {/* Left copy */}
                <div className="space-y-6">
                  <div className="inline-flex items-center gap-2 rounded-full bg-[#060B16]/10 px-3.5 py-1 text-[11px] font-black uppercase tracking-wider text-[#060B16]">
                    Rentabiliza tu vehículo
                  </div>
                  <h2 className="text-3xl sm:text-5xl font-black tracking-tight text-[#060B16] leading-none">
                    Pon tu auto a trabajar por ti y dile adiós a las cuotas.
                  </h2>
                  <div className="space-y-3.5 pt-2">
                    {[
                      "Tú tienes el control: fija tus días disponibles y tu precio",
                      "El 100% de los cobros por lavado van a tu bolsillo",
                      "Depósito bancario directo y puntual en tu cuenta",
                      "Tu auto siempre protegido con seguro comercial",
                    ].map((t, i) => (
                      <div key={i} className="flex items-center gap-3 text-sm font-bold text-[#060B16]">
                        <div className="h-5 w-5 rounded-full bg-[#060B16]/10 flex items-center justify-center shrink-0">
                          <Check className="h-3.5 w-3.5 text-[#060B16]" />
                        </div>
                        <span>{t}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Right interactive simulator card */}
                <div className="rounded-2xl bg-[#0A1124] border border-white/10 p-6 sm:p-8 text-center space-y-5 text-white shadow-2xl">
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                      Ingreso mensual estimado
                    </p>
                    <div className="text-4xl sm:text-5xl font-black text-[#FBBF24] mt-1">
                      ${ingresoNeto.toLocaleString("es-CL")}
                    </div>
                  </div>

                  <div className="space-y-2 pt-2 border-t border-white/10">
                    <div className="flex items-center justify-between text-[11px] font-bold text-slate-300 uppercase tracking-wider">
                      <span>Días disponibles / mes</span>
                      <span className="text-[#FBBF24] text-xs font-black">{diasAlMes} DÍAS</span>
                    </div>
                    <input
                      type="range"
                      min="1"
                      max="30"
                      value={diasAlMes}
                      onChange={(e) => setDiasAlMes(Number(e.target.value))}
                      className="w-full accent-[#FBBF24] cursor-pointer h-2 bg-white/10 rounded-lg appearance-none"
                    />
                  </div>

                  <Link href="/simulador-duenos">
                    <Button className="w-full rounded-xl py-6 text-xs font-black bg-[#FBBF24] text-[#060B16] hover:bg-[#F59E0B] shadow-lg shadow-[#FBBF24]/20 uppercase tracking-wider">
                      Publicar mi auto
                    </Button>
                  </Link>

                  <p className="text-[9px] text-slate-400 uppercase tracking-tight leading-tight">
                    *Estimado con tarifa promedio de $38.000 CLP diarios menos comisión, en la comuna de Los Ángeles.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════════════
            FAQ — "Dudas Comunes" accordion
        ═══════════════════════════════════════════════════════════════════ */}
        <section className="py-16 sm:py-20 bg-[#0D1528]">
          <div className="container max-w-3xl mx-auto px-4 sm:px-6 space-y-8">
            <div className="text-center space-y-2">
              <h2 className="text-2xl sm:text-3xl font-black text-white">Dudas Comunes</h2>
              <p className="text-xs text-slate-400">Todo lo que necesitas saber antes de subirte o publicar tu auto.</p>
            </div>

            <div className="space-y-3">
              {faqs.map((faq, idx) => (
                <div key={idx} className="rounded-2xl border border-white/10 bg-[#060B16] overflow-hidden">
                  <button
                    onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                    className="w-full p-5 text-left flex justify-between items-center gap-4 focus:outline-none"
                  >
                    <span className="font-bold text-white text-sm">{faq.q}</span>
                    <ChevronDown className={`h-4 w-4 text-[#FBBF24] shrink-0 transition-transform ${openFaq === idx ? "rotate-180" : ""}`} />
                  </button>
                  {openFaq === idx && (
                    <div className="px-5 pb-5 text-xs text-slate-300 leading-relaxed border-t border-white/5 pt-3">
                      {faq.a}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════════════
            CTA FINAL — "Lleva tu arriendo en el bolsillo"
        ═══════════════════════════════════════════════════════════════════ */}
        <section id="descargar-app" className="py-16 sm:py-24 bg-[#060B16] relative overflow-hidden">
          <div className="container max-w-6xl mx-auto px-4 sm:px-6">
            <div className="rounded-[2.5rem] bg-[#0A1124] border border-white/10 p-8 sm:p-14 relative overflow-hidden">
              
              {/* Ambient gold glow */}
              <div className="absolute -right-16 -top-16 w-[450px] h-[450px] bg-[#FBBF24]/10 rounded-full filter blur-[120px] pointer-events-none" />

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center relative z-10">
                
                {/* Left: Copy & Buttons */}
                <div className="lg:col-span-7 space-y-6">
                  <div className="inline-flex items-center gap-2 rounded-full border border-[#FBBF24]/30 bg-[#FBBF24]/10 px-4 py-1.5 text-xs font-black text-[#FBBF24] tracking-wide">
                    <Smartphone className="h-3.5 w-3.5" />
                    <span>EXPERIENCIA 100% DIGITAL</span>
                  </div>

                  <h2 className="text-3xl sm:text-5xl lg:text-6xl font-black text-white leading-[1.08] tracking-tight">
                    Lleva tu arriendo<br />
                    <span className="text-[#FBBF24]">en el bolsillo.</span>
                  </h2>

                  <p className="text-sm sm:text-base text-slate-300 leading-relaxed max-w-lg">
                    Reserva un 4x4 para el volcán Antuco o un auto económico para moverte por la ciudad. Recibe
                    notificaciones instantáneas, escanea el QR de entrega y audita el checklist de 9 fotos en segundos.
                  </p>

                  {/* Store download buttons */}
                  <div className="flex flex-wrap gap-4 pt-2">
                    <button className="flex items-center gap-3 bg-[#060B16] border border-white/15 hover:border-white/30 rounded-2xl px-5 py-3.5 text-left transition-all group shadow-lg">
                      <svg className="h-7 w-7 text-white fill-current" viewBox="0 0 24 24">
                        <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 6.37c.64-.78 1.08-1.86.96-2.95-1 .04-2.13.67-2.79 1.45-.58.68-1.1 1.77-.96 2.83 1.12.09 2.19-.58 2.79-1.33z" />
                      </svg>
                      <div>
                        <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Próximamente en</div>
                        <div className="text-sm font-black text-white">App Store</div>
                      </div>
                    </button>

                    <button className="flex items-center gap-3 bg-[#FBBF24] hover:bg-[#F59E0B] text-[#060B16] rounded-2xl px-5 py-3.5 text-left transition-all shadow-lg shadow-[#FBBF24]/20 group">
                      <svg className="h-7 w-7 fill-[#060B16]" viewBox="0 0 24 24">
                        <path d="M3.609 1.814L13.792 12 3.61 22.186a1.99 1.99 0 0 1-.22-.924V2.738c0-.34.08-.654.22-.924zm11.306 11.31l2.424 2.424-11.45 6.61 9.026-9.034zm0-2.248L5.889 1.842l11.45 6.61-2.424 2.424zm1.124 1.124l3.197 1.846c.92.531.92 1.397 0 1.928l-3.197 1.846-2.247-2.247 2.247-2.247z" />
                      </svg>
                      <div>
                        <div className="text-[9px] font-bold text-[#060B16]/80 uppercase tracking-widest">Próximamente en</div>
                        <div className="text-sm font-black text-[#060B16]">Google Play</div>
                      </div>
                    </button>
                  </div>
                </div>

                {/* Right: Phone Mockup */}
                <div className="lg:col-span-5 flex justify-center">
                  <div className="relative w-full max-w-[320px] rounded-[2.5rem] border-4 border-[#1E293B] bg-[#060B16] p-4 shadow-2xl shadow-black/90">
                    
                    {/* Phone Header */}
                    <div className="flex items-center justify-between px-2 pt-1 pb-4 border-b border-white/5">
                      <span className="text-[11px] font-black tracking-wider text-white">ARRIENDOMIAUTOYA</span>
                      <div className="h-3.5 w-3.5 rounded-full bg-[#1E293B]" />
                    </div>

                    {/* Card 1: Próxima Reserva */}
                    <div className="rounded-2xl bg-[#0A1124] border border-white/10 p-3.5 space-y-1 mt-3">
                      <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400 block">Próxima Reserva</span>
                      <h4 className="text-sm font-bold text-white">Toyota RAV4 Limited</h4>
                      <p className="text-[11px] text-slate-400">Hoy, 10:00 · Plaza de Armas</p>
                    </div>

                    {/* Card 2: Código de Entrega QR */}
                    <div className="rounded-2xl bg-[#FBBF24] text-[#060B16] p-4 my-3 space-y-2 text-center">
                      <span className="text-[9px] font-black uppercase tracking-widest block text-[#060B16]">Código de Entrega</span>
                      <div className="flex justify-center py-1">
                        <div className="bg-[#060B16]/5 p-2 rounded-xl">
                          <svg className="h-16 w-16 text-[#060B16]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <rect x="3" y="3" width="7" height="7" rx="1.5" fill="currentColor" />
                            <rect x="14" y="3" width="7" height="7" rx="1.5" fill="currentColor" />
                            <rect x="3" y="14" width="7" height="7" rx="1.5" fill="currentColor" />
                            <rect x="14" y="14" width="3" height="3" fill="currentColor" />
                            <rect x="18" y="14" width="3" height="3" fill="currentColor" />
                            <rect x="14" y="18" width="3" height="3" fill="currentColor" />
                            <rect x="18" y="18" width="3" height="3" fill="currentColor" />
                          </svg>
                        </div>
                      </div>
                    </div>

                    {/* Card 3: Checklist de Fotos */}
                    <div className="rounded-2xl bg-[#0A1124] border border-white/10 p-3.5 space-y-2">
                      <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400 block">Checklist de Fotos</span>
                      <div className="grid grid-cols-3 gap-2">
                        {[...Array(6)].map((_, i) => (
                          <div key={i} className="h-11 rounded-xl bg-[#060B16] border border-white/5" />
                        ))}
                      </div>
                    </div>

                    {/* Floating Rating Badge */}
                    <div className="absolute -bottom-4 -right-4 bg-[#0A1124] border border-white/15 rounded-2xl px-4 py-2.5 shadow-2xl text-center space-y-0.5 z-20">
                      <div className="text-base font-black text-white leading-none">4.9</div>
                      <div className="text-[#FBBF24] text-xs font-bold leading-none py-0.5">
                        ★★★★★
                      </div>
                      <div className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">En App Store</div>
                    </div>
                  </div>
                </div>

              </div>
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════════════
            BOTÓN FLOTANTE WHATSAPP DE SOPORTE LOCAL
        ═══════════════════════════════════════════════════════════════════ */}
        <div className="fixed bottom-6 right-6 z-40">
          <a
            href="https://wa.me/56912345678?text=Hola,%20tengo%20una%20consulta%20sobre%20el%20arriendo%20en%20ArriendoMiAutoYa%20Los%20Angeles"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2.5 bg-[#25D366] hover:bg-[#20bd5a] text-[#060B16] font-black text-xs px-4 py-3 rounded-full shadow-2xl shadow-black/50 transition-all hover:scale-105 border border-white/20 group"
          >
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-white" />
            </span>
            <span className="hidden sm:inline text-white">¿Dudas? Chatea con nosotros</span>
            <span className="sm:hidden text-white font-bold">WhatsApp</span>
          </a>
        </div>

      </main>

      {/* ═══════════════════════════════════════════════════════════════════
          MODAL FICHA TÉCNICA
      ═══════════════════════════════════════════════════════════════════ */}
      {modalAuto && (
        <Dialog open={!!modalAuto} onOpenChange={() => setModalAuto(null)}>
          <DialogContent className="max-w-lg bg-[#0D1528] border border-white/15 text-white rounded-3xl p-6">
            <DialogHeader>
              <DialogTitle className="text-xl font-black">
                {modalAuto.marca} {modalAuto.modelo} ({modalAuto.anio})
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-300 flex items-center gap-1.5 mt-1">
                <MapPin className="h-3.5 w-3.5 text-[#EF4444]" /> {modalAuto.ubicacion_base}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 my-2">
              <div className="h-48 rounded-2xl overflow-hidden border border-white/10">
                <img src={modalAuto.foto || modalAuto.fotos?.[0]} alt={modalAuto.modelo} className="h-full w-full object-cover" />
              </div>

              <div className="grid grid-cols-3 gap-2 text-xs">
                {[
                  { label: "Transmisión", value: modalAuto.transmision },
                  { label: "Combustible", value: modalAuto.combustible },
                  { label: "Capacidad", value: modalAuto.capacidad },
                ].map((s) => (
                  <div key={s.label} className="bg-[#060B16] p-3 rounded-xl border border-white/10 text-center">
                    <span className="text-slate-400 block text-[10px]">{s.label}</span>
                    <span className="font-bold text-white">{s.value}</span>
                  </div>
                ))}
              </div>

              <div className="rounded-2xl bg-[#060B16] p-4 border border-white/10 space-y-1.5 text-xs text-slate-300">
                <div className="font-bold text-[#FBBF24] flex items-center gap-1.5 mb-1">
                  <ShieldCheck className="h-4 w-4" /> Incluido en cada arriendo:
                </div>
                <p>• Seguro con deducible 15 UF (50/50)</p>
                <p>• Checklist fotográfico de 9 ángulos</p>
                <p>• 250 km diarios libres</p>
                <p>• Hold de garantía $800.000 liberado al retorno</p>
              </div>
            </div>

            <DialogFooter className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2 border-t border-white/10">
              <div>
                <div className="text-[10px] text-slate-400 uppercase">Tarifa diaria</div>
                <div className="text-lg font-black text-[#FBBF24]">
                  ${modalAuto.tarifa_dia?.toLocaleString("es-CL")} CLP
                </div>
              </div>
              <div className="flex gap-2 w-full sm:w-auto">
                <Link href={`/cotizador?auto=${modalAuto.id}`} className="flex-1 sm:flex-none">
                  <Button onClick={() => setModalAuto(null)} variant="outline" className="w-full rounded-xl px-4 text-xs font-semibold border-white/15 text-white">
                    Cotizar Días
                  </Button>
                </Link>
                <a href="#descargar-app" onClick={() => setModalAuto(null)} className="flex-1 sm:flex-none">
                  <Button className="w-full rounded-xl px-5 text-xs font-bold bg-[#FBBF24] text-[#060B16] hover:bg-[#F59E0B]">
                    Arrendar
                  </Button>
                </a>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      <Footer />
    </>
  );
}
