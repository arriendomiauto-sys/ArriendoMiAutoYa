import React, { useState, useEffect } from "react";
import Head from "next/head";
import Link from "next/link";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import { Button } from "../components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Separator } from "../components/ui/separator";
import { Alert, AlertTitle, AlertDescription } from "../components/ui/alert";
import {
  Car,
  ShieldCheck,
  Sparkles,
  MapPin,
  CheckCircle2,
  Calendar,
  DollarSign,
  Smartphone,
  Fuel,
  Camera,
  Gauge,
  Lock,
} from "lucide-react";

export default function Home() {
  const [autos, setAutos] = useState([]);
  const [selectedAuto, setSelectedAuto] = useState(null);
  const [dias, setDias] = useState(3);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAutos();
  }, []);

  const fetchAutos = async () => {
    try {
      const res = await fetch("http://localhost:8000/api/v1/autos");
      if (res.ok) {
        const data = await res.json();
        setAutos(data);
        if (data.length > 0) setSelectedAuto(data[0]);
      } else {
        throw new Error("Local fallback");
      }
    } catch {
      const fallback = [
        {
          id: "auto-1",
          marca: "Toyota",
          modelo: "RAV4 Limited 4x4",
          anio: 2023,
          patente: "BBCL-10",
          tarifa_dia: 42000,
          ubicacion_base: "Plaza de Armas, Los Ángeles",
          transmision: "Automática",
          combustible: "Gasolina 95",
          capacidad: "5 Pasajeros",
          fotos: ["https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?w=800"]
        },
        {
          id: "auto-2",
          marca: "Hyundai",
          modelo: "Tucson GL 2.0",
          anio: 2022,
          patente: "CRTX-45",
          tarifa_dia: 35000,
          ubicacion_base: "Av. Alemania, Los Ángeles",
          transmision: "Automática",
          combustible: "Gasolina 95",
          capacidad: "5 Pasajeros",
          fotos: ["https://images.unsplash.com/photo-1549399542-7e3f8b79c341?w=800"]
        },
        {
          id: "auto-3",
          marca: "Suzuki",
          modelo: "Jimny AllGrip 4x4",
          anio: 2024,
          patente: "JKLM-56",
          tarifa_dia: 48000,
          ubicacion_base: "Av. Gabriela Mistral, Los Ángeles",
          transmision: "Manual 5 Vel.",
          combustible: "Gasolina 93",
          capacidad: "4 Pasajeros",
          fotos: ["https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?w=800"]
        }
      ];
      setAutos(fallback);
      setSelectedAuto(fallback[0]);
    } finally {
      setLoading(false);
    }
  };

  const calcularTotales = () => {
    if (!selectedAuto) return { subtotal: 0, holdReserva: 0, holdGarantia: 800000, totalPagar: 0 };
    const subtotal = selectedAuto.tarifa_dia * dias;
    const holdGarantia = 800000;
    return {
      subtotal,
      holdReserva: subtotal,
      holdGarantia,
      totalPagar: subtotal
    };
  };

  const totales = calcularTotales();

  return (
    <>
      <Head>
        <title>ArriendaTuAuto - Car-sharing en Los Ángeles, Chile</title>
        <meta
          name="description"
          content="Arrienda autos verificados directamente de sus dueños en Los Ángeles, Biobío. Seguro 15 UF 50/50, checklist 9 fotos y garantía protegida."
        />
      </Head>

      <Navbar />

      <main className="min-h-screen bg-[#111827]">
        {/* HERO SECTION */}
        <section className="relative overflow-hidden border-b border-border/60 py-16 lg:py-24 bg-gradient-to-b from-[#0F223D]/80 via-[#111827] to-[#111827]">
          <div className="container max-w-7xl px-4 sm:px-6">
            <div className="grid grid-cols-1 gap-12 lg:grid-cols-12 lg:items-center">
              
              {/* Left Column: Value Prop */}
              <div className="lg:col-span-7 space-y-6">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-md border border-[#A8E637]/40 bg-[#0F223D] px-3 py-1 text-xs font-bold text-[#A8E637]">
                    <MapPin className="h-3.5 w-3.5" />
                    EXCLUSIVO EN LOS ÁNGELES, BIOBÍO (RADIO 30 KM)
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-md border border-border bg-[#1F2937] px-3 py-1 text-xs font-bold text-white">
                    <ShieldCheck className="h-3.5 w-3.5 text-[#A8E637]" />
                    SEGURO 15 UF 50/50
                  </span>
                </div>

                <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl lg:text-6xl text-white">
                  Arrienda el auto ideal <br />
                  <span className="gradient-text">directo de su dueño</span>
                </h1>

                <p className="text-base text-slate-300 sm:text-lg max-w-2xl leading-relaxed">
                  Sin filas en counter ni papeleos. Validación de identidad en segundos con OCR, entrega presencial protegida mediante código QR offline y checklist fotográfico de 9 ángulos.
                </p>

                {/* Hero Stat Cards */}
                <div className="grid grid-cols-3 gap-3 pt-2">
                  <Card className="border-border bg-[#0F223D]/70 p-4 shadow-sm">
                    <div className="text-2xl font-black text-white">100%</div>
                    <div className="text-xs text-slate-300 font-medium mt-1">Autos Verificados</div>
                  </Card>
                  <Card className="border-border bg-[#0F223D]/70 p-4 shadow-sm">
                    <div className="text-2xl font-black text-[#A8E637]">15 UF</div>
                    <div className="text-xs text-slate-300 font-medium mt-1">Deducible Seguro 50/50</div>
                  </Card>
                  <Card className="border-border bg-[#0F223D]/70 p-4 shadow-sm">
                    <div className="text-2xl font-black text-[#A8E637]">$800K</div>
                    <div className="text-xs text-slate-300 font-medium mt-1">Hold Garantía Protegido</div>
                  </Card>
                </div>

                <div className="pt-2 flex flex-wrap gap-3">
                  <a href="#catalogo">
                    <Button
                      size="lg"
                      className="gap-2 bg-[#A8E637] text-[#111827] font-bold hover:bg-[#93D129] shadow-lg shadow-[#A8E637]/20"
                    >
                      <Car className="h-4 w-4" />
                      Ver Flota Disponible
                    </Button>
                  </a>
                  <a href="#politicas">
                    <Button
                      variant="outline"
                      size="lg"
                      className="gap-2 border-border bg-[#0F223D]/80 text-white hover:bg-[#0F223D] hover:text-[#A8E637]"
                    >
                      <ShieldCheck className="h-4 w-4 text-[#A8E637]" />
                      Cómo Funciona el Seguro
                    </Button>
                  </a>
                </div>
              </div>

              {/* Right Column: Live Price Calculator */}
              <div className="lg:col-span-5">
                <Card className="border-[#A8E637]/30 shadow-2xl shadow-[#A8E637]/10 bg-[#0F223D]/95 backdrop-blur-md">
                  <CardHeader className="pb-4">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-xl font-bold flex items-center gap-2 text-white">
                        <DollarSign className="h-5 w-5 text-[#A8E637]" />
                        Calculadora de Arriendo
                      </CardTitle>
                      <span className="font-mono text-xs font-bold text-[#A8E637] bg-[#111827] px-2.5 py-1 rounded-md border border-[#A8E637]/30">
                        En vivo
                      </span>
                    </div>
                    <CardDescription className="text-slate-300">
                      Cotiza con transparencia los valores y retenciones bancarias
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="space-y-4">
                    {selectedAuto && (
                      <>
                        {/* Selected Car Preview */}
                        <div className="flex items-center gap-3 rounded-lg border border-border bg-[#111827]/80 p-3">
                          <img
                            src={selectedAuto.fotos?.[0] || "https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?w=800"}
                            alt={selectedAuto.modelo}
                            className="h-16 w-24 rounded-md object-cover border border-border"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="font-bold text-white text-sm truncate">
                              {selectedAuto.marca} {selectedAuto.modelo}
                            </div>
                            <div className="text-xs text-[#A8E637] font-bold">
                              ${selectedAuto.tarifa_dia?.toLocaleString("es-CL")} CLP / día
                            </div>
                            <div className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5 truncate">
                              <MapPin className="h-3 w-3 shrink-0 text-[#A8E637]" />
                              {selectedAuto.ubicacion_base}
                            </div>
                          </div>
                        </div>

                        {/* Duration Selector */}
                        <div className="space-y-2">
                          <label className="text-xs font-semibold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                            <Calendar className="h-3.5 w-3.5 text-[#A8E637]" />
                            Duración del Arriendo:
                          </label>
                          <div className="grid grid-cols-6 gap-1.5">
                            {[1, 2, 3, 5, 7, 14].map((d) => (
                              <Button
                                key={d}
                                type="button"
                                size="sm"
                                variant={dias === d ? "default" : "outline"}
                                className={
                                  dias === d
                                    ? "bg-[#A8E637] text-[#111827] font-bold hover:bg-[#93D129] shadow-sm"
                                    : "bg-[#111827] text-slate-300 border-border hover:text-white"
                                }
                                onClick={() => setDias(d)}
                              >
                                {d}d
                              </Button>
                            ))}
                          </div>
                        </div>

                        {/* Price Breakdown */}
                        <div className="rounded-lg border border-border bg-[#111827]/60 p-3.5 space-y-2 text-xs">
                          <div className="flex justify-between text-slate-300">
                            <span>Subtotal Arriendo ({dias} {dias === 1 ? "día" : "días"}):</span>
                            <span className="font-semibold text-white">
                              ${totales.subtotal.toLocaleString("es-CL")} CLP
                            </span>
                          </div>
                          <div className="flex justify-between text-slate-300">
                            <span>Hold de Reserva (pre-autorización):</span>
                            <span>${totales.holdReserva.toLocaleString("es-CL")} CLP</span>
                          </div>
                          <div className="flex justify-between text-slate-300">
                            <span>Hold de Garantía (seguridad cliente):</span>
                            <span className="text-[#A8E637] font-semibold">$800.000 CLP</span>
                          </div>

                          <Separator className="my-2 bg-border/60" />

                          <div className="flex justify-between items-center text-sm font-bold text-white">
                            <span>Total Arriendo a Pagar:</span>
                            <span className="text-lg font-black text-[#A8E637]">
                              ${totales.totalPagar.toLocaleString("es-CL")} CLP
                            </span>
                          </div>
                        </div>

                        <Alert variant="info" className="py-2.5 bg-[#111827]/80 border-[#A8E637]/30 text-slate-200">
                          <CheckCircle2 className="h-4 w-4 text-[#A8E637]" />
                          <AlertDescription className="text-xs">
                            El hold de garantía ($800.000) se libera automáticamente tras la restitución del vehículo sin daños.
                          </AlertDescription>
                        </Alert>
                      </>
                    )}
                  </CardContent>

                  <CardFooter className="pt-0">
                    <Button className="w-full gap-2 text-sm font-bold py-5 bg-[#A8E637] text-[#111827] hover:bg-[#93D129] shadow-lg shadow-[#A8E637]/20">
                      <Smartphone className="h-4 w-4" />
                      Reservar este Vehículo en la App Móvil
                    </Button>
                  </CardFooter>
                </Card>
              </div>

            </div>
          </div>
        </section>

        {/* CATALOG SECTION */}
        <section id="catalogo" className="py-16 bg-[#111827]">
          <div className="container max-w-7xl px-4 sm:px-6">
            <div className="text-center max-w-2xl mx-auto mb-12 space-y-3">
              <span className="inline-flex items-center gap-1 rounded-md border border-[#A8E637]/40 bg-[#0F223D] px-3 py-1 text-xs font-bold text-[#A8E637]">
                FLOTA ACTIVA EN LOS ÁNGELES
              </span>
              <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl text-white">
                Vehículos Disponibles para Arriendo Inmediato
              </h2>
              <p className="text-sm text-slate-400">
                Revisión técnica vigente, seguro de cobertura completa y entrega acordada en puntos céntricos de Los Ángeles.
              </p>
            </div>

            {/* Cars Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {autos.map((auto) => {
                const isSelected = selectedAuto?.id === auto.id;
                return (
                  <Card
                    key={auto.id}
                    className={`overflow-hidden transition-all duration-200 cursor-pointer bg-[#0F223D]/80 ${
                      isSelected
                        ? "border-[#A8E637] shadow-xl shadow-[#A8E637]/15 ring-1 ring-[#A8E637]"
                        : "border-border/80 hover:border-[#A8E637]/50 hover:shadow-lg"
                    }`}
                    onClick={() => setSelectedAuto(auto)}
                  >
                    {/* Image & Badges */}
                    <div className="relative h-48 w-full overflow-hidden bg-muted">
                      <img
                        src={auto.fotos?.[0] || "https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?w=800"}
                        alt={auto.modelo}
                        className="h-full w-full object-cover transition-transform duration-300 hover:scale-105"
                      />
                      <div className="absolute top-3 left-3">
                        <span className="font-mono text-xs font-bold bg-[#111827]/90 text-white px-2.5 py-1 rounded-md border border-border backdrop-blur-md">
                          {auto.patente}
                        </span>
                      </div>
                      <div className="absolute top-3 right-3">
                        <span className="text-[11px] font-bold bg-[#A8E637] text-[#111827] px-2.5 py-0.5 rounded-md">
                          {auto.anio}
                        </span>
                      </div>
                    </div>

                    <CardHeader className="pb-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <CardTitle className="text-lg font-bold text-white">
                            {auto.marca} {auto.modelo}
                          </CardTitle>
                          <CardDescription className="flex items-center gap-1 mt-1 text-xs text-slate-300">
                            <MapPin className="h-3 w-3 text-[#A8E637] shrink-0" />
                            {auto.ubicacion_base}
                          </CardDescription>
                        </div>
                      </div>
                    </CardHeader>

                    <CardContent className="pb-4">
                      {/* Features */}
                      <div className="grid grid-cols-2 gap-2 text-xs text-slate-300 border-y border-border/60 py-2.5 my-1">
                        <div className="flex items-center gap-1.5">
                          <Gauge className="h-3.5 w-3.5 text-[#A8E637]" />
                          <span>{auto.transmision || "Automática"}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Fuel className="h-3.5 w-3.5 text-[#A8E637]" />
                          <span>{auto.combustible || "Gasolina 95"}</span>
                        </div>
                      </div>
                    </CardContent>

                    <CardFooter className="flex items-center justify-between pt-0">
                      <div>
                        <div className="text-xs text-slate-400">Tarifa diaria</div>
                        <div className="text-lg font-extrabold text-white">
                          ${auto.tarifa_dia?.toLocaleString("es-CL")}{" "}
                          <span className="text-xs font-normal text-slate-400">CLP</span>
                        </div>
                      </div>

                      <Button
                        size="sm"
                        variant={isSelected ? "default" : "secondary"}
                        className={
                          isSelected
                            ? "bg-[#A8E637] text-[#111827] font-bold hover:bg-[#93D129] shadow-md shadow-[#A8E637]/20"
                            : "bg-[#111827] text-slate-200 border border-border hover:text-white"
                        }
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedAuto(auto);
                        }}
                      >
                        {isSelected ? "Seleccionado ✓" : "Cotizar"}
                      </Button>
                    </CardFooter>
                  </Card>
                );
              })}
            </div>
          </div>
        </section>

        {/* POLICIES & SAFETY SECTION */}
        <section id="politicas" className="py-16 border-t border-border/50 bg-[#0F223D]/30">
          <div className="container max-w-7xl px-4 sm:px-6">
            <div className="text-center max-w-2xl mx-auto mb-12 space-y-3">
              <span className="inline-flex items-center gap-1 rounded-md border border-[#A8E637]/40 bg-[#0F223D] px-3 py-1 text-xs font-bold text-[#A8E637]">
                CONFIANZA Y TRANSPARENCIA
              </span>
              <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl text-white">
                Estándares de Seguridad para Dueños y Arrendatarios
              </h2>
              <p className="text-sm text-slate-400">
                Reglas claras, contratos digitales auditables y políticas de compensación justas.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card className="border-border/80 bg-[#0F223D]/80">
                <CardHeader>
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#A8E637]/15 text-[#A8E637] mb-2">
                    <Camera className="h-6 w-6" />
                  </div>
                  <CardTitle className="text-lg font-bold text-white">Checklist Fotográfico 9 Ángulos</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-slate-300 leading-relaxed">
                    Tanto al entregar como al recibir el vehículo, se registran 4 fotos exteriores, 3 interiores, 1 de odómetro/combustible y 1 de limpieza para evitar cualquier ambigüedad.
                  </p>
                </CardContent>
              </Card>

              <Card className="border-border/80 bg-[#0F223D]/80">
                <CardHeader>
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#A8E637]/15 text-[#A8E637] mb-2">
                    <Sparkles className="h-6 w-6" />
                  </div>
                  <CardTitle className="text-lg font-bold text-white">100% de Limpieza para el Dueño</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-slate-300 leading-relaxed">
                    Si el auto se entrega sucio, se aplica un cargo de lavado estándar ($15.000) o profundo ($35.000) que se transfiere íntegramente al propietario para costear el servicio.
                  </p>
                </CardContent>
              </Card>

              <Card className="border-border/80 bg-[#0F223D]/80">
                <CardHeader>
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#A8E637]/15 text-[#A8E637] mb-2">
                    <ShieldCheck className="h-6 w-6" />
                  </div>
                  <CardTitle className="text-lg font-bold text-white">Deducible Protegido 15 UF 50/50</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-slate-300 leading-relaxed">
                    En caso de siniestro cubierto por la póliza, el deducible de 15 UF se divide en partes iguales entre la empresa y el dueño, minimizando cualquier riesgo financiero.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* MOBILE APP CTA BANNER */}
        <section id="descargar-app" className="py-16 bg-gradient-to-r from-[#0F223D] via-[#111827] to-[#0F223D] border-t border-border/60">
          <div className="container max-w-7xl px-4 sm:px-6">
            <Card className="border-[#A8E637]/30 bg-[#0F223D]/90 p-8 sm:p-12 shadow-2xl relative overflow-hidden">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-center">
                <div className="md:col-span-8 space-y-4">
                  <span className="inline-flex items-center gap-1 rounded-md border border-[#A8E637]/40 bg-[#111827] px-3 py-1 text-xs font-bold text-[#A8E637]">
                    DISPONIBLE EN REACT NATIVE / EXPO
                  </span>
                  <h3 className="text-2xl sm:text-4xl font-extrabold text-white">
                    Todo el control de tus arriendos en tu bolsillo
                  </h3>
                  <p className="text-sm sm:text-base text-slate-300 max-w-xl leading-relaxed">
                    Enrolamiento en 2 pasos con OCR, escáner QR offline para entregas presenciales en Los Ángeles, contrato en PDF generado al instante y gestión de ganancias para dueños.
                  </p>
                  <div className="pt-2 flex flex-wrap gap-3">
                    <Button
                      size="lg"
                      className="gap-2 bg-[#A8E637] text-[#111827] font-bold hover:bg-[#93D129] shadow-lg shadow-[#A8E637]/30"
                    >
                      <Smartphone className="h-5 w-5" />
                      Instalar App Móvil
                    </Button>
                    <Link href="/manager">
                      <Button
                        variant="outline"
                        size="lg"
                        className="gap-2 border-border bg-[#111827] text-white hover:bg-[#1F2937]"
                      >
                        Acceso a Sucursal Los Ángeles
                      </Button>
                    </Link>
                  </div>
                </div>

                <div className="md:col-span-4 flex justify-center">
                  <div className="rounded-2xl border-2 border-[#A8E637]/30 bg-[#111827]/95 p-6 text-center space-y-3 shadow-xl">
                    <img
                      src="/logo.png"
                      alt="Logo"
                      className="h-16 w-16 mx-auto rounded-xl object-cover border border-[#A8E637]/40 shadow-md"
                    />
                    <div className="text-sm font-bold text-white">Código QR de Entrega</div>
                    <div className="text-xs text-[#A8E637] font-mono bg-[#0F223D] px-3 py-1.5 rounded-md border border-border">
                      HASH: ATA-LA-2026-X89
                    </div>
                    <span className="inline-flex items-center gap-1 rounded-md border border-[#A8E637]/30 bg-[#0F223D] px-2 py-0.5 text-[10px] font-bold text-[#A8E637]">
                      Operativo 100% Offline
                    </span>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}
