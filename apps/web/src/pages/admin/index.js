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
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "../../components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "../../components/ui/dialog";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "../../components/ui/avatar";
import { Alert, AlertTitle, AlertDescription } from "../../components/ui/alert";
import {
  DollarSign,
  Scale,
  FileCheck2,
  Settings,
  ShieldCheck,
  Download,
  Search,
  CheckCircle2,
  XCircle,
  Camera,
  AlertTriangle,
  Lock,
} from "lucide-react";

export default function AdminPortal() {
  const [activeTab, setActiveTab] = useState("financiero");

  // Configuración de Plataforma (RF-33)
  const [configPlataforma, setConfigPlataforma] = useState({
    valor_uf_clp: 38000,
    comision_plataforma_pct: 20,
    hold_enrolamiento_clp: 800000,
    cargo_limpieza_estandar_clp: 15000,
    cargo_limpieza_profunda_clp: 35000,
    cargo_combustible_cuarto_clp: 15000,
    cargo_km_extra_clp: 120,
    km_diarios_incluidos: 250,
    periodo_gracia_minutos: 30,
  });
  const [configSaved, setConfigSaved] = useState(false);

  // Datos financieros
  const [finanzas, setFinanzas] = useState({
    total_holds_capturados_clp: 926000,
    total_cobros_finales_clp: 126000,
    total_liquidaciones_pendientes_clp: 100800,
    total_liquidaciones_pagadas_clp: 0,
    cantidad_transacciones: 4,
  });

  // Disputas con Lightbox de Fotos Antes y Después
  const [disputas, setDisputas] = useState([
    {
      id: "disp-1",
      reservaId: "res-001",
      cliente: "María José Silva (19.234.567-7)",
      dueno: "Carlos Mendoza (15.892.341-6)",
      auto: "Toyota RAV4 Limited (BBCL-10)",
      tipo: "cargo_limpieza_disputado",
      montoDisputa: 15000,
      motivo: "Cliente cuestiona cobro de lavado estándar tras retornar el vehículo con barro en carrocería.",
      fotoAntes: "https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?w=800",
      fotoDespues: "https://images.unsplash.com/photo-1549399542-7e3f8b79c341?w=800",
      estado: "abierta",
      fecha: "15 Ago 2026",
    },
  ]);

  const [lightboxDisputa, setLightboxDisputa] = useState(null);

  // Cola de Revisión Manual de Documentos OCR (Score < 80%) (RF-31)
  const [documentosPendientes, setDocumentosPendientes] = useState([
    {
      id: "usr-pendiente-1",
      nombre: "Pedro Alarcón Gómez",
      rut: "18.456.789-K",
      email: "pedro.alarcon@gmail.com",
      telefono: "+56977665544",
      confianza_ocr: 0.74,
      motivo_revision: "Reflejo de luz sobre la fecha de vencimiento del carnet. Requiere validación visual.",
      carnet_url: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400",
      estado_documentos: "requiere_revision_manual",
    },
  ]);

  const handleGuardarConfig = (e) => {
    e.preventDefault();
    setConfigSaved(true);
    setTimeout(() => setConfigSaved(false), 3000);
    alert("Configuración de plataforma (RF-33) actualizada exitosamente en la base de datos.");
  };

  const handleResolverDisputa = (disputaId, resolucion) => {
    setDisputas((prev) =>
      prev.map((d) =>
        d.id === disputaId ? { ...d, estado: "resuelta", resolucion } : d
      )
    );
    setLightboxDisputa(null);
    alert(`Disputa resuelta exitosamente: ${resolucion}`);
  };

  const handleAprobarDocumento = (userId) => {
    setDocumentosPendientes((prev) => prev.filter((d) => d.id !== userId));
    alert("Documentos del usuario aprobados con éxito por Admin (RF-31). Se activó el rol 'cliente' y la garantía de $800.000 CLP.");
  };

  const handleRechazarDocumento = (userId) => {
    setDocumentosPendientes((prev) => prev.filter((d) => d.id !== userId));
    alert("Documentos rechazados por Admin (RF-31). Se notificó al usuario para que suba una foto más nítida.");
  };

  const handleExportCSV = () => {
    const csvContent =
      "data:text/csv;charset=utf-8,ID_Transaccion,Tipo,Monto_CLP,Estado,Fecha\n" +
      "TBK-ENROL-800K,hold_enrolamiento,800000,capturado,2026-08-15\n" +
      "TBK-RES-126K,hold_reserva,126000,capturado,2026-08-15\n" +
      "TBK-COBRO-126K,cobro_final,126000,capturado,2026-08-15\n" +
      "TBK-LIQ-100K,liquidacion_dueno,100800,pendiente,2026-08-15\n";
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "reporte_financiero_rentacar_chile.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <>
      <Head>
        <title>Panel Administrador General - ArriendaTuAuto</title>
      </Head>

      <Navbar />

      <main className="min-h-screen py-10 bg-[#111827]">
        <div className="container max-w-7xl px-4 sm:px-6 space-y-8">
          
          {/* Header Section */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border/60 pb-6">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-md border border-[#A8E637]/40 bg-[#0F223D] px-2.5 py-0.5 text-xs font-bold text-[#A8E637]">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  ROL: ADMINISTRADOR GLOBAL
                </span>
                <span className="inline-flex items-center gap-1 rounded-md border border-border bg-[#1F2937] px-2.5 py-0.5 text-xs font-semibold text-slate-300">
                  Plataforma Centralizada
                </span>
              </div>
              <h1 className="text-3xl font-black tracking-tight text-white sm:text-4xl">
                Centro de Control & Finanzas
              </h1>
              <p className="text-sm text-slate-400">
                Supervisión financiera, resolución de arbitrajes, auditoría OCR (RF-31) y parámetros dinámicos (RF-33)
              </p>
            </div>

            {/* Admin Avatar Profile */}
            <Card className="border-border bg-[#0F223D]/80 p-3.5 shadow-sm">
              <div className="flex items-center gap-3">
                <Avatar className="h-11 w-11 border border-[#A8E637]/40 bg-[#111827] text-[#A8E637]">
                  <AvatarFallback className="font-bold bg-[#111827] text-[#A8E637]">
                    AG
                  </AvatarFallback>
                </Avatar>
                <div>
                  <div className="font-bold text-sm text-white">Administrador General</div>
                  <div className="text-xs text-slate-400">RUT: 11.222.333-9</div>
                  <div className="text-[11px] text-[#A8E637] font-semibold mt-0.5">● Superadmin Level 1</div>
                </div>
              </div>
            </Card>
          </div>

          {/* Module Tabs (shadcn Tabs) */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="grid w-full grid-cols-2 lg:grid-cols-4 h-auto p-1 bg-[#0F223D]/80 border border-border">
              <TabsTrigger
                value="financiero"
                className="gap-2 py-2.5 text-xs sm:text-sm font-semibold data-[state=active]:bg-[#A8E637] data-[state=active]:text-[#111827] text-slate-300"
              >
                <DollarSign className="h-4 w-4" />
                Financiero & Holds
              </TabsTrigger>
              <TabsTrigger
                value="disputas"
                className="gap-2 py-2.5 text-xs sm:text-sm font-semibold data-[state=active]:bg-[#A8E637] data-[state=active]:text-[#111827] text-slate-300"
              >
                <Scale className="h-4 w-4" />
                Disputas & Lightbox ({disputas.filter((d) => d.estado === "abierta").length})
              </TabsTrigger>
              <TabsTrigger
                value="documentos"
                className="gap-2 py-2.5 text-xs sm:text-sm font-semibold data-[state=active]:bg-[#A8E637] data-[state=active]:text-[#111827] text-slate-300"
              >
                <FileCheck2 className="h-4 w-4" />
                Revisión OCR ({documentosPendientes.length})
              </TabsTrigger>
              <TabsTrigger
                value="configuracion"
                className="gap-2 py-2.5 text-xs sm:text-sm font-semibold data-[state=active]:bg-[#A8E637] data-[state=active]:text-[#111827] text-slate-300"
              >
                <Settings className="h-4 w-4" />
                Parámetros (RF-33)
              </TabsTrigger>
            </TabsList>

            {/* TAB 1: FINANCIERO & HOLDS */}
            <TabsContent value="financiero" className="space-y-6">
              {/* Financial KPIs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="border-border/80 bg-[#0F223D]/70">
                  <CardHeader className="pb-2">
                    <CardDescription className="text-xs font-semibold uppercase tracking-wider flex items-center justify-between text-slate-300">
                      <span>Holds Capturados</span>
                      <Lock className="h-4 w-4 text-[#A8E637]" />
                    </CardDescription>
                    <CardTitle className="text-2xl font-black text-white">
                      ${finanzas.total_holds_capturados_clp?.toLocaleString("es-CL")} CLP
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <p className="text-xs text-slate-400">$800.000 garantía + $126.000 reserva</p>
                  </CardContent>
                </Card>

                <Card className="border-border/80 bg-[#0F223D]/70">
                  <CardHeader className="pb-2">
                    <CardDescription className="text-xs font-semibold uppercase tracking-wider flex items-center justify-between text-slate-300">
                      <span>Cobros Facturados</span>
                      <CheckCircle2 className="h-4 w-4 text-[#A8E637]" />
                    </CardDescription>
                    <CardTitle className="text-2xl font-black text-[#A8E637]">
                      ${finanzas.total_cobros_finales_clp?.toLocaleString("es-CL")} CLP
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <p className="text-xs text-slate-400">Transacciones liquidadas con éxito</p>
                  </CardContent>
                </Card>

                <Card className="border-border/80 bg-[#0F223D]/70">
                  <CardHeader className="pb-2">
                    <CardDescription className="text-xs font-semibold uppercase tracking-wider flex items-center justify-between text-slate-300">
                      <span>Liquidación Dueños</span>
                      <DollarSign className="h-4 w-4 text-sky-400" />
                    </CardDescription>
                    <CardTitle className="text-2xl font-black text-sky-400">
                      ${finanzas.total_liquidaciones_pendientes_clp?.toLocaleString("es-CL")} CLP
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <p className="text-xs text-slate-400">80% base arriendo + 100% compensaciones</p>
                  </CardContent>
                </Card>

                <Card className="border-border/80 bg-[#0F223D]/70">
                  <CardHeader className="pb-2">
                    <CardDescription className="text-xs font-semibold uppercase tracking-wider flex items-center justify-between text-slate-300">
                      <span>Deducible Seguro</span>
                      <ShieldCheck className="h-4 w-4 text-amber-400" />
                    </CardDescription>
                    <CardTitle className="text-2xl font-black text-amber-400">
                      15 UF (50/50)
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <p className="text-xs text-slate-400">Empresa ($285K) / Dueño ($285K)</p>
                  </CardContent>
                </Card>
              </div>

              {/* Transactions Table Card */}
              <Card className="border-border/80 bg-[#0F223D]/80 shadow-md">
                <CardHeader>
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                      <CardTitle className="text-lg font-bold flex items-center gap-2 text-white">
                        <DollarSign className="h-5 w-5 text-[#A8E637]" />
                        Libro Mayor de Transacciones y Retenciones
                      </CardTitle>
                      <CardDescription className="text-slate-300">
                        Registro auditable de holds Transbank, liberaciones y pagos a dueños
                      </CardDescription>
                    </div>

                    <Button
                      onClick={handleExportCSV}
                      variant="outline"
                      size="sm"
                      className="gap-1.5 self-start sm:self-auto bg-[#111827] text-white border-border hover:bg-[#1F2937]"
                    >
                      <Download className="h-4 w-4 text-[#A8E637]" />
                      Exportar CSV Contable
                    </Button>
                  </div>
                </CardHeader>

                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-border/60 hover:bg-transparent">
                        <TableHead className="text-slate-300">Referencia Bancaria</TableHead>
                        <TableHead className="text-slate-300">Tipo de Transacción</TableHead>
                        <TableHead className="text-slate-300">Monto (CLP)</TableHead>
                        <TableHead className="text-slate-300">Regla de Asignación</TableHead>
                        <TableHead className="text-right text-slate-300">Estado</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <TableRow className="border-border/50 hover:bg-[#111827]/50">
                        <TableCell className="font-mono text-xs font-bold text-white">
                          TBK-ENROL-800K
                        </TableCell>
                        <TableCell className="text-slate-200">Hold de Garantía Enrolamiento</TableCell>
                        <TableCell className="font-bold text-[#A8E637]">$800.000 CLP</TableCell>
                        <TableCell className="text-xs text-slate-400">
                          Retención de seguridad bancaria por usuario
                        </TableCell>
                        <TableCell className="text-right">
                          <span className="inline-flex items-center rounded-md border border-[#A8E637]/30 bg-[#111827] px-2.5 py-0.5 text-xs font-bold text-[#A8E637]">
                            Capturado
                          </span>
                        </TableCell>
                      </TableRow>

                      <TableRow className="border-border/50 hover:bg-[#111827]/50">
                        <TableCell className="font-mono text-xs font-bold text-white">
                          TBK-RES-126K
                        </TableCell>
                        <TableCell className="text-slate-200">Hold de Reserva (3 días)</TableCell>
                        <TableCell className="font-bold text-white">$126.000 CLP</TableCell>
                        <TableCell className="text-xs text-slate-400">
                          Toyota RAV4 Limited ($42.000/día)
                        </TableCell>
                        <TableCell className="text-right">
                          <span className="inline-flex items-center rounded-md border border-[#A8E637]/30 bg-[#111827] px-2.5 py-0.5 text-xs font-bold text-[#A8E637]">
                            Capturado
                          </span>
                        </TableCell>
                      </TableRow>

                      <TableRow className="border-border/50 hover:bg-[#111827]/50">
                        <TableCell className="font-mono text-xs font-bold text-white">
                          TBK-LIQ-DUENO-01
                        </TableCell>
                        <TableCell className="text-slate-200">Liquidación Arrendador</TableCell>
                        <TableCell className="font-bold text-sky-400">$100.800 CLP</TableCell>
                        <TableCell className="text-xs text-slate-400">
                          80% arriendo neto ($100.800) transferido a Carlos Mendoza
                        </TableCell>
                        <TableCell className="text-right">
                          <span className="inline-flex items-center rounded-md border border-amber-500/30 bg-[#111827] px-2.5 py-0.5 text-xs font-bold text-amber-400">
                            Pendiente Pago
                          </span>
                        </TableCell>
                      </TableRow>

                      <TableRow className="border-border/50 hover:bg-[#111827]/50">
                        <TableCell className="font-mono text-xs font-bold text-white">
                          TBK-CLEAN-15K
                        </TableCell>
                        <TableCell className="text-slate-200">Compensación de Limpieza</TableCell>
                        <TableCell className="font-bold text-[#A8E637]">$15.000 CLP</TableCell>
                        <TableCell className="text-xs text-slate-400">
                          100% abonado al dueño (Lavado estándar exterior)
                        </TableCell>
                        <TableCell className="text-right">
                          <span className="inline-flex items-center rounded-md border border-[#A8E637]/30 bg-[#111827] px-2.5 py-0.5 text-xs font-bold text-[#A8E637]">
                            Abonado
                          </span>
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            {/* TAB 2: DISPUTAS & LIGHTBOX */}
            <TabsContent value="disputas" className="space-y-6">
              <Card className="border-border/80 bg-[#0F223D]/80 shadow-md">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-lg font-bold flex items-center gap-2 text-white">
                        <Scale className="h-5 w-5 text-[#A8E637]" />
                        Disputas Formales de Arriendo
                      </CardTitle>
                      <CardDescription className="text-slate-300">
                        Contraste fotográfico y arbitraje de cargos de limpieza, combustible y siniestros
                      </CardDescription>
                    </div>
                    <span className="inline-flex items-center rounded-md border border-red-500/30 bg-[#111827] px-2.5 py-0.5 text-xs font-bold text-red-400">
                      {disputas.length} Casos
                    </span>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">
                  {disputas.map((disp) => (
                    <Card key={disp.id} className="border-border/60 bg-[#111827]/70">
                      <CardHeader className="p-5 pb-3">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                          <div>
                            <CardTitle className="text-base font-bold text-white">
                              {disp.auto} • Caso #{disp.id}
                            </CardTitle>
                            <div className="text-xs text-slate-400 mt-1">
                              Cliente: <span className="text-white font-semibold">{disp.cliente}</span> ↔ Dueño: <span className="text-white font-semibold">{disp.dueno}</span>
                            </div>
                          </div>

                          <span
                            className={`px-2.5 py-0.5 rounded-md text-xs font-bold uppercase self-start sm:self-auto border ${
                              disp.estado === "abierta"
                                ? "bg-red-950/40 text-red-400 border-red-500/30"
                                : "bg-[#0F223D] text-[#A8E637] border-[#A8E637]/30"
                            }`}
                          >
                            {disp.estado}
                          </span>
                        </div>
                      </CardHeader>

                      <CardContent className="p-5 pt-0 pb-3 space-y-2">
                        <p className="text-xs text-slate-300 leading-relaxed">
                          <strong className="text-white">Motivo reportado:</strong> {disp.motivo} (Monto en disputa: ${disp.montoDisputa?.toLocaleString("es-CL")} CLP)
                        </p>

                        {disp.resolucion && (
                          <Alert variant="success" className="py-2 mt-2 bg-[#0F223D] border-[#A8E637]/30 text-slate-200">
                            <CheckCircle2 className="h-4 w-4 text-[#A8E637]" />
                            <AlertDescription className="text-xs">
                              <strong>Resolución aplicada:</strong> {disp.resolucion}
                            </AlertDescription>
                          </Alert>
                        )}
                      </CardContent>

                      <CardFooter className="p-5 pt-3 border-t border-border/40 flex justify-between items-center">
                        <span className="text-xs text-slate-400 flex items-center gap-1.5">
                          <Camera className="h-3.5 w-3.5 text-[#A8E637]" />
                          Evidencias fotográficas del checklist disponibles
                        </span>

                        <Button
                          size="sm"
                          onClick={() => setLightboxDisputa(disp)}
                          className="gap-1.5 text-xs bg-[#A8E637] text-[#111827] font-bold hover:bg-[#93D129] shadow-sm"
                        >
                          <Search className="h-3.5 w-3.5" />
                          Abrir Lightbox Antes vs Después
                        </Button>
                      </CardFooter>
                    </Card>
                  ))}
                </CardContent>
              </Card>
            </TabsContent>

            {/* TAB 3: REVISIÓN MANUAL OCR (RF-31) */}
            <TabsContent value="documentos" className="space-y-6">
              <Card className="border-border/80 bg-[#0F223D]/80 shadow-md">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-lg font-bold flex items-center gap-2 text-white">
                        <FileCheck2 className="h-5 w-5 text-amber-400" />
                        Cola de Revisión Manual de Documentos (RF-31)
                      </CardTitle>
                      <CardDescription className="text-slate-300">
                        Usuarios con score OCR &lt; 80% o advertencias de legibilidad que requieren validación humana
                      </CardDescription>
                    </div>
                    <span className="inline-flex items-center rounded-md border border-amber-500/30 bg-[#111827] px-2.5 py-0.5 text-xs font-bold text-amber-400">
                      {documentosPendientes.length} Pendientes
                    </span>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">
                  {documentosPendientes.length === 0 ? (
                    <div className="p-12 text-center text-sm text-slate-400 border border-dashed border-border rounded-lg">
                      ✓ No hay documentos pendientes de revisión manual en este momento.
                    </div>
                  ) : (
                    documentosPendientes.map((doc) => (
                      <Card key={doc.id} className="border-border/60 bg-[#111827]/70">
                        <CardContent className="p-5">
                          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
                            <div className="md:col-span-3 flex justify-center">
                              <img
                                src={doc.carnet_url}
                                alt={doc.nombre}
                                className="h-28 w-44 rounded-lg object-cover border-2 border-border shadow-md"
                              />
                            </div>

                            <div className="md:col-span-9 space-y-3">
                              <div className="flex flex-wrap items-center gap-2">
                                <h4 className="text-base font-bold text-white">{doc.nombre}</h4>
                                <span className="font-mono text-xs font-bold bg-[#0F223D] text-white px-2 py-0.5 rounded border border-border">
                                  RUT: {doc.rut}
                                </span>
                                <span className="font-semibold text-xs bg-amber-950/40 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded">
                                  Score OCR: {(doc.confianza_ocr * 100).toFixed(0)}%
                                </span>
                              </div>

                              <Alert variant="warning" className="py-2 bg-[#0F223D] border-amber-500/30 text-amber-300">
                                <AlertTriangle className="h-4 w-4 text-amber-400" />
                                <AlertDescription className="text-xs">
                                  {doc.motivo_revision}
                                </AlertDescription>
                              </Alert>

                              <div className="text-xs text-slate-400">
                                Email: <span className="text-white font-medium">{doc.email}</span> • Teléfono: <span className="text-white font-medium">{doc.telefono}</span>
                              </div>

                              <div className="flex flex-wrap justify-end gap-3 pt-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="text-red-400 border-red-900/50 hover:bg-red-950/30 gap-1 text-xs bg-[#111827]"
                                  onClick={() => handleRechazarDocumento(doc.id)}
                                >
                                  <XCircle className="h-3.5 w-3.5" />
                                  Rechazar y Solicitar Nueva Foto
                                </Button>

                                <Button
                                  size="sm"
                                  className="gap-1 text-xs bg-[#A8E637] text-[#111827] font-bold hover:bg-[#93D129]"
                                  onClick={() => handleAprobarDocumento(doc.id)}
                                >
                                  <CheckCircle2 className="h-3.5 w-3.5" />
                                  Aprobar Manualmente & Activar Rol Cliente
                                </Button>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* TAB 4: CONFIGURACIÓN DINÁMICA DE PLATAFORMA (RF-33) */}
            <TabsContent value="configuracion" className="space-y-6">
              <Card className="border-border/80 bg-[#0F223D]/80 shadow-md">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-lg font-bold flex items-center gap-2 text-white">
                        <Settings className="h-5 w-5 text-[#A8E637]" />
                        Parámetros Financieros & Operativos de Plataforma (RF-33)
                      </CardTitle>
                      <CardDescription className="text-slate-300">
                        Edita valores de negocio en tiempo real sin reiniciar el backend ni hardcodear valores
                      </CardDescription>
                    </div>
                    {configSaved && (
                      <span className="inline-flex items-center rounded-md border border-[#A8E637]/40 bg-[#0F223D] px-2.5 py-0.5 text-xs font-bold text-[#A8E637]">
                        ✓ Guardado en Base de Datos
                      </span>
                    )}
                  </div>
                </CardHeader>

                <CardContent>
                  <form onSubmit={handleGuardarConfig} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      
                      {/* UF Value */}
                      <div className="space-y-2">
                        <Label htmlFor="valor_uf" className="text-xs font-semibold text-slate-200">
                          Valor UF de Referencia ($ CLP)
                        </Label>
                        <Input
                          id="valor_uf"
                          type="number"
                          value={configPlataforma.valor_uf_clp}
                          onChange={(e) =>
                            setConfigPlataforma({
                              ...configPlataforma,
                              valor_uf_clp: parseFloat(e.target.value),
                            })
                          }
                          className="font-mono text-sm bg-[#111827] text-white border-border"
                        />
                        <p className="text-[11px] text-slate-400">
                          Deducible 15 UF = ${(15 * configPlataforma.valor_uf_clp).toLocaleString("es-CL")} CLP (50/50)
                        </p>
                      </div>

                      {/* Commission % */}
                      <div className="space-y-2">
                        <Label htmlFor="comision" className="text-xs font-semibold text-slate-200">
                          Comisión Plataforma (%)
                        </Label>
                        <Input
                          id="comision"
                          type="number"
                          value={configPlataforma.comision_plataforma_pct}
                          onChange={(e) =>
                            setConfigPlataforma({
                              ...configPlataforma,
                              comision_plataforma_pct: parseFloat(e.target.value),
                            })
                          }
                          className="font-mono text-sm bg-[#111827] text-white border-border"
                        />
                        <p className="text-[11px] text-slate-400">
                          Dueño recibe el {100 - configPlataforma.comision_plataforma_pct}% del arriendo base
                        </p>
                      </div>

                      {/* Enrollment Hold */}
                      <div className="space-y-2">
                        <Label htmlFor="hold_enrol" className="text-xs font-semibold text-slate-200">
                          Hold Garantía de Enrolamiento ($ CLP)
                        </Label>
                        <Input
                          id="hold_enrol"
                          type="number"
                          value={configPlataforma.hold_enrolamiento_clp}
                          onChange={(e) =>
                            setConfigPlataforma({
                              ...configPlataforma,
                              hold_enrolamiento_clp: parseInt(e.target.value),
                            })
                          }
                          className="font-mono text-sm bg-[#111827] text-white border-border"
                        />
                        <p className="text-[11px] text-slate-400">
                          Pre-autorización bancaria de seguridad
                        </p>
                      </div>

                      {/* Standard Cleaning Fee */}
                      <div className="space-y-2">
                        <Label htmlFor="clean_std" className="text-xs font-semibold text-slate-200">
                          Multa Limpieza Estándar ($ CLP)
                        </Label>
                        <Input
                          id="clean_std"
                          type="number"
                          value={configPlataforma.cargo_limpieza_estandar_clp}
                          onChange={(e) =>
                            setConfigPlataforma({
                              ...configPlataforma,
                              cargo_limpieza_estandar_clp: parseInt(e.target.value),
                            })
                          }
                          className="font-mono text-sm bg-[#111827] text-white border-border"
                        />
                        <p className="text-[11px] text-slate-400">
                          100% transferido al dueño para lavado exterior
                        </p>
                      </div>

                      {/* Deep Cleaning Fee */}
                      <div className="space-y-2">
                        <Label htmlFor="clean_deep" className="text-xs font-semibold text-slate-200">
                          Multa Limpieza Profunda / Tapiz ($ CLP)
                        </Label>
                        <Input
                          id="clean_deep"
                          type="number"
                          value={configPlataforma.cargo_limpieza_profunda_clp}
                          onChange={(e) =>
                            setConfigPlataforma({
                              ...configPlataforma,
                              cargo_limpieza_profunda_clp: parseInt(e.target.value),
                            })
                          }
                          className="font-mono text-sm bg-[#111827] text-white border-border"
                        />
                        <p className="text-[11px] text-slate-400">
                          100% transferido al dueño para limpieza integral
                        </p>
                      </div>

                      {/* Fuel 1/4 Fee */}
                      <div className="space-y-2">
                        <Label htmlFor="fuel_quarter" className="text-xs font-semibold text-slate-200">
                          Cargo 1/4 Combustible Faltante ($ CLP)
                        </Label>
                        <Input
                          id="fuel_quarter"
                          type="number"
                          value={configPlataforma.cargo_combustible_cuarto_clp}
                          onChange={(e) =>
                            setConfigPlataforma({
                              ...configPlataforma,
                              cargo_combustible_cuarto_clp: parseInt(e.target.value),
                            })
                          }
                          className="font-mono text-sm bg-[#111827] text-white border-border"
                        />
                        <p className="text-[11px] text-slate-400">
                          Abonado íntegramente al dueño
                        </p>
                      </div>

                      {/* Extra KM Fee */}
                      <div className="space-y-2">
                        <Label htmlFor="extra_km" className="text-xs font-semibold text-slate-200">
                          Cargo por KM Excedente ($ CLP/km)
                        </Label>
                        <Input
                          id="extra_km"
                          type="number"
                          value={configPlataforma.cargo_km_extra_clp}
                          onChange={(e) =>
                            setConfigPlataforma({
                              ...configPlataforma,
                              cargo_km_extra_clp: parseInt(e.target.value),
                            })
                          }
                          className="font-mono text-sm bg-[#111827] text-white border-border"
                        />
                        <p className="text-[11px] text-slate-400">
                          Cobro automático al superar el límite pactado
                        </p>
                      </div>

                      {/* Daily KM Included */}
                      <div className="space-y-2">
                        <Label htmlFor="km_included" className="text-xs font-semibold text-slate-200">
                          Kilómetros Diarios Incluidos
                        </Label>
                        <Input
                          id="km_included"
                          type="number"
                          value={configPlataforma.km_diarios_incluidos}
                          onChange={(e) =>
                            setConfigPlataforma({
                              ...configPlataforma,
                              km_diarios_incluidos: parseInt(e.target.value),
                            })
                          }
                          className="font-mono text-sm bg-[#111827] text-white border-border"
                        />
                        <p className="text-[11px] text-slate-400">
                          Kilometraje libre permitido por día
                        </p>
                      </div>

                      {/* Grace Period Minutes */}
                      <div className="space-y-2">
                        <Label htmlFor="grace_period" className="text-xs font-semibold text-slate-200">
                          Período de Gracia Devolución (minutos)
                        </Label>
                        <Input
                          id="grace_period"
                          type="number"
                          value={configPlataforma.periodo_gracia_minutos}
                          onChange={(e) =>
                            setConfigPlataforma({
                              ...configPlataforma,
                              periodo_gracia_minutos: parseInt(e.target.value),
                            })
                          }
                          className="font-mono text-sm bg-[#111827] text-white border-border"
                        />
                        <p className="text-[11px] text-slate-400">
                          Tolerancia antes de aplicar recargos por atraso
                        </p>
                      </div>

                    </div>

                    <div className="flex justify-end pt-4 border-t border-border/50">
                      <Button
                        type="submit"
                        size="lg"
                        className="gap-2 bg-[#A8E637] text-[#111827] font-bold hover:bg-[#93D129] shadow-lg shadow-[#A8E637]/20"
                      >
                        <Settings className="h-4 w-4" />
                        Guardar Parámetros de Plataforma (Admin)
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          {/* LIGHTBOX DIALOG DE FOTOS ANTES Y DESPUÉS (shadcn Dialog) */}
          {lightboxDisputa && (
            <Dialog open={!!lightboxDisputa} onOpenChange={(open) => !open && setLightboxDisputa(null)}>
              <DialogContent className="max-w-4xl bg-[#0F223D] border-border text-white">
                <DialogHeader>
                  <DialogTitle className="text-xl font-bold flex items-center gap-2 text-white">
                    <Camera className="h-5 w-5 text-[#A8E637]" />
                    Contraste Fotográfico de Entrega vs Devolución
                  </DialogTitle>
                  <DialogDescription className="text-slate-300">
                    {lightboxDisputa.auto} • Motivo: {lightboxDisputa.motivo}
                  </DialogDescription>
                </DialogHeader>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 my-2">
                  {/* Photo Before */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="inline-flex items-center rounded-md border border-[#A8E637]/40 bg-[#111827] px-2.5 py-0.5 text-xs font-bold text-[#A8E637]">
                        1. Estado Inicial (Antes de Entregar)
                      </span>
                      <span className="text-xs text-slate-400">Vehículo limpio</span>
                    </div>
                    <img
                      src={lightboxDisputa.fotoAntes}
                      alt="Foto Antes"
                      className="h-64 w-full rounded-lg object-cover border border-border"
                    />
                  </div>

                  {/* Photo After */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="inline-flex items-center rounded-md border border-red-500/40 bg-[#111827] px-2.5 py-0.5 text-xs font-bold text-red-400">
                        2. Estado Final (Devolución)
                      </span>
                      <span className="text-xs text-slate-400">Retorno con barro</span>
                    </div>
                    <img
                      src={lightboxDisputa.fotoDespues}
                      alt="Foto Después"
                      className="h-64 w-full rounded-lg object-cover border border-border"
                    />
                  </div>
                </div>

                <DialogFooter className="flex flex-col sm:flex-row sm:justify-between items-center gap-3 pt-3 border-t border-border/50">
                  <div className="text-xs text-slate-300 text-left w-full sm:w-auto">
                    Monto en disputa: <span className="font-bold text-[#A8E637]">${lightboxDisputa.montoDisputa?.toLocaleString("es-CL")} CLP</span>
                  </div>

                  <div className="flex gap-2 w-full sm:w-auto justify-end">
                    <Button
                      variant="outline"
                      size="sm"
                      className="bg-[#111827] text-white border-border hover:bg-[#1F2937]"
                      onClick={() =>
                        handleResolverDisputa(
                          lightboxDisputa.id,
                          "Cargo desestimado por Admin. Se libera retención al cliente."
                        )
                      }
                    >
                      Desestimar Cargo
                    </Button>

                    <Button
                      size="sm"
                      className="gap-1 bg-[#A8E637] text-[#111827] font-bold hover:bg-[#93D129] shadow-sm"
                      onClick={() =>
                        handleResolverDisputa(
                          lightboxDisputa.id,
                          "Cargo de limpieza ratificado por Admin. Se transfiere $15.000 CLP íntegros al dueño."
                        )
                      }
                    >
                      Ratificar y Abonar al Dueño ✓
                    </Button>
                  </div>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}

        </div>
      </main>

      <Footer />
    </>
  );
}
