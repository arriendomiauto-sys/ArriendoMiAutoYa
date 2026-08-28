import React, { useState } from "react";
import Seo from "../../components/Seo";
import Navbar from "../../components/Navbar";
import Footer from "../../components/Footer";
import { Button } from "../../components/ui/button";
import { Avatar, AvatarFallback } from "../../components/ui/avatar";
import {
  Building2,
  Car,
  Clock,
  MapPin,
  CheckCircle2,
  AlertTriangle,
  Radio,
  FileCheck2,
  Headphones,
  UserCheck,
} from "lucide-react";

export default function ManagerPage() {
  const [flota, setFlota] = useState([
    {
      id: "auto-1",
      modelo: "Toyota RAV4 Limited",
      patente: "LH-44-22",
      dueno: "Carlos Mendoza",
      rutDueno: "15.444.333-2",
      ubicacion: "Plaza de Armas",
      estado: "arrendado",
      tarifa: 42000,
    },
    {
      id: "auto-2",
      modelo: "Hyundai Tucson GL",
      patente: "PK-12-99",
      dueno: "Andrea Valenzuela",
      rutDueno: "17.888.111-9",
      ubicacion: "Av. Alemania",
      estado: "disponible",
      tarifa: 35000,
    },
    {
      id: "auto-3",
      modelo: "Suzuki Jimny AllGrip",
      patente: "RT-77-33",
      dueno: "Felipe Soto",
      rutDueno: "18.222.555-K",
      ubicacion: "Av. Gabriela Mistral",
      estado: "disponible",
      tarifa: 48000,
    },
  ]);

  const [tickets, setTickets] = useState([
    {
      id: "TICK-001",
      usuario: "Camila Aravena",
      rut: "19.345.678-2",
      asunto: "Coordinación entrega retrasada por lluvia",
      estado: "abierto",
      descripcion: "El dueño y yo acordamos mover el punto de entrega al Mall Plaza techado.",
    },
    {
      id: "TICK-002",
      usuario: "Jorge Salinas",
      rut: "14.111.999-3",
      asunto: "Duda sobre retención Hold $800.000",
      estado: "resuelto",
      descripcion: "Confirmado desbloqueo automático con banco emisor.",
    },
  ]);

  const handleCerrarTicket = (id) => {
    setTickets((prev) =>
      prev.map((t) => (t.id === id ? { ...t, estado: "resuelto" } : t))
    );
  };

  const handleEscalarDisputa = (id) => {
    setTickets((prev) =>
      prev.map((t) => (t.id === id ? { ...t, estado: "escalado_a_disputa" } : t))
    );
  };

  return (
    <>
      <Seo
        title="Panel de Sucursal Los Ángeles"
        description="Consola de gestión local para sucursal Los Ángeles: monitoreo de flota, coordinación de entregas y soporte en terreno."
        path="/manager"
        noindex
      />

      <Navbar />

      <main className="min-h-screen pt-28 pb-16 bg-[#061E1F] text-white relative overflow-hidden">
        {/* Glow ambient background */}
        <div className="absolute top-10 left-1/4 w-[500px] h-[500px] bg-[#2FBF9B]/10 rounded-full filter blur-[100px] pointer-events-none" />
        <div className="absolute top-1/2 -right-32 w-[600px] h-[600px] bg-[#0F3D3E]/40 rounded-full filter blur-[120px] pointer-events-none" />

        <div className="container max-w-7xl mx-auto px-4 sm:px-6 space-y-8 relative z-10">
          
          {/* Header Section */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-white/10 pb-6">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-[#2FBF9B]/30 bg-[#0E3736] px-3 py-1 text-xs font-bold text-[#2FBF9B]">
                  <Building2 className="h-3.5 w-3.5" />
                  SUCURSAL OPERATIVA
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-slate-300 backdrop-blur-md">
                  <Radio className="h-3 w-3 animate-pulse text-[#2FBF9B]" />
                  Radio 30 km Los Ángeles Activo
                </span>
              </div>
              <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
                Centro de Operaciones Los Ángeles
              </h1>
              <p className="text-sm text-slate-300">
                Monitoreo de flota local, entregas presenciales y mediación rápida de soporte.
              </p>
            </div>

            {/* Manager Avatar Profile */}
            <div className="rounded-2xl border border-[#2FBF9B]/20 bg-[#0E3736] p-3.5 shadow-xl flex items-center gap-3.5 backdrop-blur-md">
              <Avatar className="h-10 w-10 border border-[#2FBF9B]/50 bg-[#061E1F] text-[#2FBF9B]">
                <AvatarFallback className="font-bold bg-[#061E1F] text-[#2FBF9B]">
                  RM
                </AvatarFallback>
              </Avatar>
              <div>
                <div className="font-bold text-sm text-white">Rodrigo Morales</div>
                <div className="text-[11px] text-slate-300">Gerente de Sucursal (RUT 14.333.222-5)</div>
                <div className="text-[11px] text-[#2FBF9B] font-medium flex items-center gap-1 mt-0.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#2FBF9B] animate-pulse" />
                  Turno Activo
                </div>
              </div>
            </div>
          </div>

          {/* Operational KPI Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-3xl border border-[#2FBF9B]/20 bg-[#0E3736] p-5 shadow-lg space-y-2">
              <div className="flex justify-between items-center text-xs font-medium text-slate-300">
                <span>Flota en Cobertura</span>
                <Car className="h-4 w-4 text-[#2FBF9B]" />
              </div>
              <div className="text-3xl font-black text-white">3 Autos</div>
              <p className="text-[11px] text-slate-400">100% operativos en Los Ángeles</p>
            </div>

            <div className="rounded-3xl border border-[#2FBF9B]/20 bg-[#0E3736] p-5 shadow-lg space-y-2">
              <div className="flex justify-between items-center text-xs font-medium text-slate-300">
                <span>Arriendos en Curso</span>
                <Clock className="h-4 w-4 text-[#2FBF9B]" />
              </div>
              <div className="text-3xl font-black text-[#2FBF9B]">1 Activo</div>
              <p className="text-[11px] text-slate-400">Plaza de Armas • RAV4 Limited</p>
            </div>

            <div className="rounded-3xl border border-[#2FBF9B]/20 bg-[#0E3736] p-5 shadow-lg space-y-2">
              <div className="flex justify-between items-center text-xs font-medium text-slate-300">
                <span>Tickets de Mediación</span>
                <Headphones className="h-4 w-4 text-[#2FBF9B]" />
              </div>
              <div className="text-3xl font-black text-[#2FBF9B]">
                {tickets.filter((t) => t.estado === "abierto").length} Pendientes
              </div>
              <p className="text-[11px] text-slate-400">Atención local y soporte de entrega</p>
            </div>

            <div className="rounded-3xl border border-[#2FBF9B]/20 bg-[#0E3736] p-5 shadow-lg space-y-2">
              <div className="flex justify-between items-center text-xs font-medium text-slate-300">
                <span>Radio de Cobertura</span>
                <MapPin className="h-4 w-4 text-[#92E3CB]" />
              </div>
              <div className="text-3xl font-black text-[#92E3CB]">30 km</div>
              <p className="text-[11px] text-slate-400">Comuna de Los Ángeles, Chile</p>
            </div>
          </div>

          {/* Main 2-Column Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            
            {/* Col 1: Flota Registrada */}
            <div className="lg:col-span-7 space-y-4">
              <div className="rounded-3xl border border-[#2FBF9B]/20 bg-[#0E3736] p-6 shadow-xl space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                      <Car className="h-4 w-4 text-[#2FBF9B]" />
                      Flota Supervisada en Los Ángeles
                    </h3>
                    <p className="text-xs text-slate-400">
                      Vehículos verificados con seguro y checklist activo
                    </p>
                  </div>
                  <span className="text-xs font-semibold text-[#2FBF9B] bg-[#061E1F] border border-[#2FBF9B]/30 px-3 py-1 rounded-full">
                    {flota.length} Activos
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-white/10 text-slate-400">
                        <th className="pb-3 font-semibold">Vehículo</th>
                        <th className="pb-3 font-semibold">Patente</th>
                        <th className="pb-3 font-semibold">Dueño</th>
                        <th className="pb-3 font-semibold">Tarifa / Día</th>
                        <th className="pb-3 font-semibold text-right">Estado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 text-slate-300">
                      {flota.map((auto) => (
                        <tr key={auto.id} className="hover:bg-white/5 transition-colors">
                          <td className="py-3.5 font-bold text-white">
                            <div>{auto.modelo}</div>
                            <div className="text-[10px] text-slate-400 flex items-center gap-1 font-normal">
                              <MapPin className="h-3 w-3 text-[#2FBF9B]" />
                              {auto.ubicacion}
                            </div>
                          </td>
                          <td className="py-3.5 font-mono font-bold text-[#2FBF9B]">
                            {auto.patente}
                          </td>
                          <td className="py-3.5">
                            <div>{auto.dueno}</div>
                            <div className="text-[10px] text-slate-400 font-mono">{auto.rutDueno}</div>
                          </td>
                          <td className="py-3.5 font-semibold text-white">
                            ${auto.tarifa?.toLocaleString("es-CL")}
                          </td>
                          <td className="py-3.5 text-right">
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-0.5 text-[10px] font-bold text-emerald-400">
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                              Activo
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Col 2: Tickets de Mediación */}
            <div className="lg:col-span-5 space-y-4">
              <div className="rounded-3xl border border-[#2FBF9B]/20 bg-[#0E3736] p-6 shadow-xl space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                      <Headphones className="h-4 w-4 text-[#2FBF9B]" />
                      Bandeja de Mediación Local
                    </h3>
                    <p className="text-xs text-slate-400">
                      Gestión de entregas y solicitudes de inspección
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  {tickets.map((t) => (
                    <div
                      key={t.id}
                      className={`rounded-2xl border p-4 space-y-3 transition-colors ${
                        t.estado === "escalado_a_disputa"
                          ? "border-purple-500/30 bg-purple-950/20"
                          : t.estado === "resuelto"
                          ? "border-white/5 bg-white/5 opacity-60"
                          : "border-[#2FBF9B]/30 bg-[#061E1F]"
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="font-bold text-white text-xs">{t.asunto}</div>
                          <div className="text-[11px] text-slate-400">{t.usuario} • {t.rut}</div>
                        </div>
                        <span
                          className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
                            t.estado === "escalado_a_disputa"
                              ? "bg-purple-500/20 text-purple-300 border border-purple-500/30"
                              : t.estado === "resuelto"
                              ? "bg-white/10 text-slate-400"
                              : "bg-[#2FBF9B]/20 text-[#92E3CB] border border-[#2FBF9B]/30"
                          }`}
                        >
                          {t.estado === "escalado_a_disputa"
                            ? "Escalado a Admin"
                            : t.estado === "resuelto"
                            ? "Resuelto"
                            : "Pendiente"}
                        </span>
                      </div>

                      <p className="text-xs text-slate-300 bg-[#0E3736] p-3 rounded-xl border border-white/5">
                        "{t.descripcion}"
                      </p>

                      {t.estado === "abierto" && (
                        <div className="flex gap-2 pt-1">
                          <Button
                            size="sm"
                            onClick={() => handleCerrarTicket(t.id)}
                            className="rounded-xl text-xs font-semibold bg-[#2FBF9B] text-[#061E1F] hover:bg-[#28A787] flex-1"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                            Resolver Local
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => handleEscalarDisputa(t.id)}
                            className="rounded-xl text-xs font-semibold bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 border border-rose-500/30 flex-1"
                          >
                            <AlertTriangle className="h-3.5 w-3.5 mr-1" />
                            Escalar a Admin
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

          </div>

        </div>
      </main>

      <Footer />
    </>
  );
}
