import React, { useState } from "react";
import Head from "next/head";
import Navbar from "../../components/Navbar";
import Footer from "../../components/Footer";
import { Button } from "../../components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "../../components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "../../components/ui/avatar";
import { Alert, AlertTitle, AlertDescription } from "../../components/ui/alert";
import {
  Building2,
  Car,
  Headphones,
  ShieldAlert,
  CheckCircle2,
  MapPin,
  Clock,
  Radio,
  AlertTriangle,
  FileCheck,
} from "lucide-react";

export default function ManagerPortal() {
  const [tickets, setTickets] = useState([
    {
      id: "ticket-1",
      usuario: "María José Silva",
      rut: "19.234.567-7",
      asunto: "Consulta sobre punto de encuentro en Plaza de Armas",
      descripcion: "Hola, quisiera confirmar si el dueño puede entregar el auto frente a la Municipalidad de Los Ángeles.",
      estado: "abierto",
      escalado: false,
      fecha: "Hoy 10:30",
    },
    {
      id: "ticket-2",
      usuario: "Carlos Mendoza (Dueño)",
      rut: "15.892.341-6",
      asunto: "Solicitud de inspección por retorno con barro",
      descripcion: "El cliente entregó el auto con barro exterior; solicito validar el cargo de limpieza estándar de $15.000 CLP.",
      estado: "abierto",
      escalado: false,
      fecha: "Hoy 09:15",
    },
  ]);

  const [flota, setFlota] = useState([
    {
      id: "auto-1",
      modelo: "Toyota RAV4 Limited 4x4",
      patente: "BBCL-10",
      dueno: "Carlos Mendoza",
      rutDueno: "15.892.341-6",
      estado: "activo",
      tarifa: 42000,
      ubicacion: "Plaza de Armas",
      combustible: "Gasolina 95",
    },
    {
      id: "auto-2",
      modelo: "Hyundai Tucson GL 2.0",
      patente: "CRTX-45",
      dueno: "Carlos Mendoza",
      rutDueno: "15.892.341-6",
      estado: "activo",
      tarifa: 35000,
      ubicacion: "Av. Alemania",
      combustible: "Gasolina 95",
    },
    {
      id: "auto-3",
      modelo: "Suzuki Jimny AllGrip 4x4",
      patente: "JKLM-56",
      dueno: "Pedro Alarcón",
      rutDueno: "18.456.789-K",
      estado: "activo",
      tarifa: 48000,
      ubicacion: "Av. Gabriela Mistral",
      combustible: "Gasolina 93",
    },
  ]);

  const handleEscalarDisputa = (ticketId) => {
    setTickets((prev) =>
      prev.map((t) =>
        t.id === ticketId
          ? { ...t, escalado: true, estado: "escalado_a_disputa" }
          : t
      )
    );
    alert("Ticket escalado exitosamente a Disputa Formal para resolución del Administrador General.");
  };

  const handleCerrarTicket = (ticketId) => {
    setTickets((prev) =>
      prev.map((t) => (t.id === ticketId ? { ...t, estado: "resuelto" } : t))
    );
  };

  return (
    <>
      <Head>
        <title>Panel Sucursal Los Ángeles - ArriendaTuAuto</title>
      </Head>

      <Navbar />

      <main className="min-h-screen py-10 bg-[#111827]">
        <div className="container max-w-7xl px-4 sm:px-6 space-y-8">
          
          {/* Header Section */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border/60 pb-6">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-md border border-[#A8E637]/40 bg-[#0F223D] px-2.5 py-0.5 text-xs font-bold text-[#A8E637]">
                  <Building2 className="h-3.5 w-3.5" />
                  ROL: MANAGER SUCURSAL
                </span>
                <span className="inline-flex items-center gap-1 rounded-md border border-border bg-[#1F2937] px-2.5 py-0.5 text-xs font-semibold text-slate-300">
                  <Radio className="h-3 w-3 animate-pulse text-[#A8E637]" />
                  Radio 30 km Activo
                </span>
              </div>
              <h1 className="text-3xl font-black tracking-tight text-white sm:text-4xl">
                Sucursal Los Ángeles Centro
              </h1>
              <p className="text-sm text-slate-400">
                Supervisión operativa de flota local, entregas presenciales y soporte directo (Región del Biobío)
              </p>
            </div>

            {/* Manager Avatar Profile */}
            <Card className="border-border bg-[#0F223D]/80 p-3.5 shadow-sm">
              <div className="flex items-center gap-3">
                <Avatar className="h-11 w-11 border border-[#A8E637]/40 bg-[#111827] text-[#A8E637]">
                  <AvatarFallback className="font-bold bg-[#111827] text-[#A8E637]">
                    RM
                  </AvatarFallback>
                </Avatar>
                <div>
                  <div className="font-bold text-sm text-white">Rodrigo Manager</div>
                  <div className="text-xs text-slate-400">RUT: 14.333.222-5</div>
                  <div className="text-[11px] text-[#A8E637] font-semibold mt-0.5">● Sucursal Biobío Online</div>
                </div>
              </div>
            </Card>
          </div>

          {/* Operational KPI Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="border-border/80 bg-[#0F223D]/70">
              <CardHeader className="pb-2">
                <CardDescription className="text-xs font-semibold uppercase tracking-wider flex items-center justify-between text-slate-300">
                  <span>Flota en Cobertura</span>
                  <Car className="h-4 w-4 text-[#A8E637]" />
                </CardDescription>
                <CardTitle className="text-2xl font-black text-white">
                  3 Autos
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-xs text-slate-400">100% operativos en Los Ángeles</p>
              </CardContent>
            </Card>

            <Card className="border-border/80 bg-[#0F223D]/70">
              <CardHeader className="pb-2">
                <CardDescription className="text-xs font-semibold uppercase tracking-wider flex items-center justify-between text-slate-300">
                  <span>Reservas en Curso</span>
                  <Clock className="h-4 w-4 text-[#A8E637]" />
                </CardDescription>
                <CardTitle className="text-2xl font-black text-[#A8E637]">
                  1 Activa
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-xs text-slate-400">Plaza de Armas • RAV4 Limited</p>
              </CardContent>
            </Card>

            <Card className="border-border/80 bg-[#0F223D]/70">
              <CardHeader className="pb-2">
                <CardDescription className="text-xs font-semibold uppercase tracking-wider flex items-center justify-between text-slate-300">
                  <span>Tickets de Soporte</span>
                  <Headphones className="h-4 w-4 text-[#A8E637]" />
                </CardDescription>
                <CardTitle className="text-2xl font-black text-amber-400">
                  {tickets.filter((t) => t.estado === "abierto").length} Pendientes
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-xs text-slate-400">Atención local y mediación</p>
              </CardContent>
            </Card>

            <Card className="border-border/80 bg-[#0F223D]/70">
              <CardHeader className="pb-2">
                <CardDescription className="text-xs font-semibold uppercase tracking-wider flex items-center justify-between text-slate-300">
                  <span>Radio de Cobertura</span>
                  <MapPin className="h-4 w-4 text-sky-400" />
                </CardDescription>
                <CardTitle className="text-2xl font-black text-sky-400">
                  30 km
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-xs text-slate-400">Comuna de Los Ángeles, Chile</p>
              </CardContent>
            </Card>
          </div>

          {/* Main 2-Column Grid: Flota & Soporte */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            
            {/* Col 1: Flota Registrada (7 Cols) */}
            <div className="lg:col-span-7">
              <Card className="border-border/80 bg-[#0F223D]/80 shadow-md">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-lg font-bold flex items-center gap-2 text-white">
                        <Car className="h-5 w-5 text-[#A8E637]" />
                        Flota Registrada en Sucursal
                      </CardTitle>
                      <CardDescription className="text-slate-300">
                        Vehículos verificados bajo jurisdicción de Los Ángeles
                      </CardDescription>
                    </div>
                    <span className="inline-flex items-center rounded-md border border-[#A8E637]/40 bg-[#111827] px-2.5 py-0.5 text-xs font-bold text-[#A8E637]">
                      {flota.length} Activos
                    </span>
                  </div>
                </CardHeader>

                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-border/60 hover:bg-transparent">
                        <TableHead className="w-[180px] text-slate-300">Vehículo</TableHead>
                        <TableHead className="text-slate-300">Patente</TableHead>
                        <TableHead className="text-slate-300">Propietario</TableHead>
                        <TableHead className="text-slate-300">Tarifa/Día</TableHead>
                        <TableHead className="text-right text-slate-300">Estado</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {flota.map((auto) => (
                        <TableRow key={auto.id} className="border-border/50 hover:bg-[#111827]/50">
                          <TableCell className="font-semibold text-white">
                            <div>{auto.modelo}</div>
                            <div className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                              <MapPin className="h-3 w-3 text-[#A8E637]" />
                              {auto.ubicacion}
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="font-mono text-xs font-bold bg-[#111827] text-white px-2 py-0.5 rounded border border-border">
                              {auto.patente}
                            </span>
                          </TableCell>
                          <TableCell>
                            <div className="text-xs text-white font-medium">{auto.dueno}</div>
                            <div className="text-[10px] text-slate-400">{auto.rutDueno}</div>
                          </TableCell>
                          <TableCell className="text-xs font-bold text-white">
                            ${auto.tarifa?.toLocaleString("es-CL")}{" "}
                            <span className="text-[10px] text-slate-400 font-normal">CLP</span>
                          </TableCell>
                          <TableCell className="text-right">
                            <span className="inline-flex items-center rounded-md border border-[#A8E637]/30 bg-[#111827] px-2 py-0.5 text-[11px] font-bold text-[#A8E637]">
                              Operativo
                            </span>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>

                <CardFooter className="border-t border-border/50 py-3 bg-[#111827]/40 flex justify-between items-center text-xs text-slate-400">
                  <span>Revisión técnica y póliza al día en todos los vehículos</span>
                  <span className="font-bold text-[#A8E637]">Los Ángeles, CL</span>
                </CardFooter>
              </Card>
            </div>

            {/* Col 2: Bandeja de Soporte y Mediación (5 Cols) */}
            <div className="lg:col-span-5 space-y-4">
              <Card className="border-border/80 bg-[#0F223D]/80 shadow-md">
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-lg font-bold flex items-center gap-2 text-white">
                        <Headphones className="h-5 w-5 text-amber-400" />
                        Bandeja de Soporte Local
                      </CardTitle>
                      <CardDescription className="text-slate-300">
                        Atención inmediata de consultas y reclamos de la sucursal
                      </CardDescription>
                    </div>
                    <span className="inline-flex items-center rounded-md border border-amber-500/40 bg-[#111827] px-2.5 py-0.5 text-xs font-bold text-amber-400">
                      {tickets.length} Tickets
                    </span>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">
                  {tickets.map((t) => (
                    <Card key={t.id} className="border-border/60 bg-[#111827]/70">
                      <CardHeader className="p-4 pb-2">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <CardTitle className="text-sm font-bold text-white">
                              {t.asunto}
                            </CardTitle>
                            <div className="text-xs text-slate-400 mt-0.5">
                              👤 {t.usuario} • {t.fecha}
                            </div>
                          </div>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold shrink-0 border ${
                              t.estado === "abierto"
                                ? "bg-amber-950/40 text-amber-400 border-amber-500/30"
                                : t.estado === "resuelto"
                                ? "bg-[#0F223D] text-[#A8E637] border-[#A8E637]/30"
                                : "bg-red-950/40 text-red-400 border-red-500/30"
                            }`}
                          >
                            {t.estado}
                          </span>
                        </div>
                      </CardHeader>

                      <CardContent className="p-4 pt-1 pb-3">
                        <p className="text-xs text-slate-300 leading-relaxed">
                          {t.descripcion}
                        </p>
                      </CardContent>

                      <CardFooter className="p-4 pt-0 flex justify-between items-center gap-2 border-t border-border/40 mt-1 pt-3">
                        {t.estado === "abierto" && (
                          <>
                            <Button
                              size="sm"
                              variant="secondary"
                              className="text-xs h-7 gap-1 bg-[#0F223D] text-white hover:bg-[#1E3A5F]"
                              onClick={() => handleCerrarTicket(t.id)}
                            >
                              <CheckCircle2 className="h-3 w-3 text-[#A8E637]" />
                              Resolver
                            </Button>

                            <Button
                              size="sm"
                              variant="destructive"
                              className="text-xs h-7 gap-1"
                              onClick={() => handleEscalarDisputa(t.id)}
                            >
                              <AlertTriangle className="h-3 w-3" />
                              Escalar a Disputa
                            </Button>
                          </>
                        )}

                        {t.escalado && (
                          <span className="text-xs text-red-400 font-bold flex items-center gap-1">
                            <ShieldAlert className="h-3.5 w-3.5" />
                            Caso transferido a Admin Global
                          </span>
                        )}

                        {t.estado === "resuelto" && (
                          <span className="text-xs text-[#A8E637] font-bold flex items-center gap-1">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Caso cerrado por Manager
                          </span>
                        )}
                      </CardFooter>
                    </Card>
                  ))}
                </CardContent>
              </Card>

              {/* Informative Alert regarding Branch Scope (RF-27) */}
              <Alert variant="info" className="bg-[#0F223D]/80 border-[#A8E637]/30 text-slate-200">
                <FileCheck className="h-4 w-4 text-[#A8E637]" />
                <AlertTitle className="text-xs font-bold text-white">Protocolo de Sucursal Los Ángeles</AlertTitle>
                <AlertDescription className="text-xs leading-relaxed text-slate-300 mt-1">
                  Los managers resuelven dudas operativas y coordinan entregas. En caso de siniestros o disputas de retención de garantía, el caso se eleva automáticamente a la mesa de arbitraje de Administración General.
                </AlertDescription>
              </Alert>
            </div>

          </div>

        </div>
      </main>

      <Footer />
    </>
  );
}
