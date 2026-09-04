import React, { useState, useEffect } from "react";
import Seo from "../../components/Seo";
import Navbar from "../../components/Navbar";
import Footer from "../../components/Footer";
import { Button } from "../../components/ui/button";
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
import { Avatar, AvatarFallback } from "../../components/ui/avatar";
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
  Lock,
  Check,
} from "lucide-react";

import { API_BASE_URL } from "../../lib/api";

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
    dias_cobro_posterior_peajes: 60,
    edad_minima_arriendo: 21,
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

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/admin/configuracion`);
        if (res.ok) {
          const d = await res.json();
          setConfigPlataforma(d);
        }
      } catch { /* use default state */ }
    })();
  }, []);

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

  // Cola de Revisión Manual OCR (RF-31)
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

  const handleGuardarConfig = async (e) => {
    e.preventDefault();
    try {
      await fetch(`${API_BASE_URL}/admin/configuracion`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(configPlataforma),
      });
    } catch { /* saved locally */ }
    setConfigSaved(true);
    setTimeout(() => setConfigSaved(false), 3000);
  };

  const handleResolverDisputa = (disputaId, resolucion) => {
    setDisputas((prev) =>
      prev.map((d) =>
        d.id === disputaId ? { ...d, estado: "resuelta", resolucion } : d
      )
    );
    setLightboxDisputa(null);
  };

  const handleAprobarDocumento = (userId) => {
    setDocumentosPendientes((prev) => prev.filter((d) => d.id !== userId));
  };

  const handleRechazarDocumento = (userId) => {
    setDocumentosPendientes((prev) => prev.filter((d) => d.id !== userId));
  };

  const handleExportCSV = () => {
    const csvContent =
      "data:text/csv;charset=utf-8,ID_Transaccion,Tipo,Monto_CLP,Estado,Fecha\n" +
      "MP-ENROL-800K,hold_enrolamiento,800000,capturado,2026-08-15\n" +
      "MP-RES-126K,hold_reserva,126000,capturado,2026-08-15\n" +
      "MP-COBRO-126K,cobro_final,126000,capturado,2026-08-15\n" +
      "MP-LIQ-100K,liquidacion_dueno,100800,pendiente,2026-08-15\n";
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
      <Seo
        title="Panel Administrador General"
        description="Consola interna de administración de ArriendoMiAutoYa."
        path="/admin"
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
                  <ShieldCheck className="h-3.5 w-3.5" />
                  ADMINISTRADOR GLOBAL
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-slate-300 backdrop-blur-md">
                  Plataforma Centralizada
                </span>
              </div>
              <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
                Centro de Control & Finanzas
              </h1>
              <p className="text-sm text-slate-400">
                Supervisión financiera, resolución de arbitrajes, auditoría OCR (RF-31) y parámetros dinámicos (RF-33).
              </p>
            </div>

            {/* Admin Avatar Profile */}
            <div className="rounded-2xl border border-[#2FBF9B]/20 bg-[#0E3736] p-3.5 shadow-xl flex items-center gap-3.5 backdrop-blur-md">
              <Avatar className="h-10 w-10 border border-[#2FBF9B]/50 bg-[#061E1F] text-[#2FBF9B]">
                <AvatarFallback className="font-bold bg-[#061E1F] text-[#2FBF9B]">
                  AG
                </AvatarFallback>
              </Avatar>
              <div>
                <div className="font-bold text-sm text-white">Administrador General</div>
                <div className="text-[11px] text-slate-300">RUT: 11.222.333-9</div>
                <div className="text-[11px] text-[#2FBF9B] font-medium flex items-center gap-1 mt-0.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#2FBF9B] animate-pulse" />
                  Superadmin Level 1
                </div>
              </div>
            </div>
          </div>

          {/* Module Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="grid w-full grid-cols-2 lg:grid-cols-4 h-auto p-1.5 bg-[#0E3736] border border-[#2FBF9B]/20 rounded-2xl">
              <TabsTrigger
                value="financiero"
                className="gap-2 py-3 rounded-xl text-xs sm:text-sm font-semibold data-[state=active]:bg-[#2FBF9B] data-[state=active]:text-[#061E1F] data-[state=active]:font-bold text-slate-300 transition-all"
              >
                <DollarSign className="h-4 w-4" />
                Financiero & Holds
              </TabsTrigger>
              <TabsTrigger
                value="disputas"
                className="gap-2 py-3 rounded-xl text-xs sm:text-sm font-semibold data-[state=active]:bg-[#2FBF9B] data-[state=active]:text-[#061E1F] data-[state=active]:font-bold text-slate-300 transition-all"
              >
                <Scale className="h-4 w-4" />
                Disputas ({disputas.filter((d) => d.estado === "abierta").length})
              </TabsTrigger>
              <TabsTrigger
                value="documentos"
                className="gap-2 py-3 rounded-xl text-xs sm:text-sm font-semibold data-[state=active]:bg-[#2FBF9B] data-[state=active]:text-[#061E1F] data-[state=active]:font-bold text-slate-300 transition-all"
              >
                <FileCheck2 className="h-4 w-4" />
                Revisión OCR ({documentosPendientes.length})
              </TabsTrigger>
              <TabsTrigger
                value="configuracion"
                className="gap-2 py-3 rounded-xl text-xs sm:text-sm font-semibold data-[state=active]:bg-[#2FBF9B] data-[state=active]:text-[#061E1F] data-[state=active]:font-bold text-slate-300 transition-all"
              >
                <Settings className="h-4 w-4" />
                Parámetros (RF-33)
              </TabsTrigger>
            </TabsList>

            {/* TAB 1: FINANCIERO & HOLDS */}
            <TabsContent value="financiero" className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="rounded-3xl border border-[#2FBF9B]/20 bg-[#0E3736] p-5 shadow-lg space-y-2">
                  <div className="flex justify-between items-center text-xs font-medium text-slate-300">
                    <span>Holds Capturados</span>
                    <Lock className="h-4 w-4 text-[#2FBF9B]" />
                  </div>
                  <div className="text-2xl sm:text-3xl font-black text-white">
                    ${finanzas.total_holds_capturados_clp?.toLocaleString("es-CL")} CLP
                  </div>
                  <p className="text-[11px] text-slate-400">$800.000 garantía + $126.000 reserva</p>
                </div>

                <div className="rounded-3xl border border-[#2FBF9B]/20 bg-[#0E3736] p-5 shadow-lg space-y-2">
                  <div className="flex justify-between items-center text-xs font-medium text-slate-300">
                    <span>Cobros Facturados</span>
                    <CheckCircle2 className="h-4 w-4 text-[#2FBF9B]" />
                  </div>
                  <div className="text-2xl sm:text-3xl font-black text-[#2FBF9B]">
                    ${finanzas.total_cobros_finales_clp?.toLocaleString("es-CL")} CLP
                  </div>
                  <p className="text-[11px] text-slate-400">Transacciones liquidadas</p>
                </div>

                <div className="rounded-3xl border border-[#2FBF9B]/20 bg-[#0E3736] p-5 shadow-lg space-y-2">
                  <div className="flex justify-between items-center text-xs font-medium text-slate-300">
                    <span>Liquidación Dueños</span>
                    <DollarSign className="h-4 w-4 text-[#92E3CB]" />
                  </div>
                  <div className="text-2xl sm:text-3xl font-black text-[#92E3CB]">
                    ${finanzas.total_liquidaciones_pendientes_clp?.toLocaleString("es-CL")} CLP
                  </div>
                  <p className="text-[11px] text-slate-400">80% arriendo + 100% compensaciones</p>
                </div>

                <div className="rounded-3xl border border-[#2FBF9B]/20 bg-[#0E3736] p-5 shadow-lg space-y-2">
                  <div className="flex justify-between items-center text-xs font-medium text-slate-300">
                    <span>Deducible Seguro</span>
                    <ShieldCheck className="h-4 w-4 text-amber-400" />
                  </div>
                  <div className="text-2xl sm:text-3xl font-black text-amber-400">
                    15 UF (50/50)
                  </div>
                  <p className="text-[11px] text-slate-400">Empresa ($285K) / Dueño ($285K)</p>
                </div>
              </div>

              {/* Transactions Table Card */}
              <div className="rounded-3xl border border-[#2FBF9B]/20 bg-[#0E3736] p-6 shadow-xl space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                      <DollarSign className="h-4 w-4 text-[#2FBF9B]" />
                      Libro Mayor de Transacciones y Retenciones
                    </h3>
                    <p className="text-xs text-slate-400">
                      Registro auditable de garantías de Mercado Pago, liberaciones y pagos a dueños
                    </p>
                  </div>

                  <Button
                    onClick={handleExportCSV}
                    size="sm"
                    className="gap-2 rounded-xl bg-white/10 text-white hover:bg-white/15 border border-white/10 text-xs font-semibold"
                  >
                    <Download className="h-3.5 w-3.5 text-[#2FBF9B]" />
                    Exportar CSV
                  </Button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-white/10 text-slate-400">
                        <th className="pb-3 font-semibold">Referencia Bancaria</th>
                        <th className="pb-3 font-semibold">Tipo de Transacción</th>
                        <th className="pb-3 font-semibold">Monto (CLP)</th>
                        <th className="pb-3 font-semibold">Regla de Asignación</th>
                        <th className="pb-3 font-semibold text-right">Estado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 text-slate-300">
                      <tr className="hover:bg-white/5 transition-colors">
                        <td className="py-3.5 font-mono font-bold text-white">MP-ENROL-800K</td>
                        <td className="py-3.5">Hold de Garantía Enrolamiento</td>
                        <td className="py-3.5 font-bold text-[#2FBF9B]">$800.000 CLP</td>
                        <td className="py-3.5 text-slate-400">Retención de seguridad bancaria</td>
                        <td className="py-3.5 text-right">
                          <span className="inline-flex items-center rounded-full bg-[#2FBF9B]/15 border border-[#2FBF9B]/30 px-2.5 py-0.5 text-[10px] font-bold text-[#2FBF9B]">
                            Capturado
                          </span>
                        </td>
                      </tr>
                      <tr className="hover:bg-white/5 transition-colors">
                        <td className="py-3.5 font-mono font-bold text-white">MP-RES-126K</td>
                        <td className="py-3.5">Hold de Reserva (3 días)</td>
                        <td className="py-3.5 font-bold text-white">$126.000 CLP</td>
                        <td className="py-3.5 text-slate-400">Toyota RAV4 Limited ($42.000/día)</td>
                        <td className="py-3.5 text-right">
                          <span className="inline-flex items-center rounded-full bg-[#2FBF9B]/15 border border-[#2FBF9B]/30 px-2.5 py-0.5 text-[10px] font-bold text-[#2FBF9B]">
                            Capturado
                          </span>
                        </td>
                      </tr>
                      <tr className="hover:bg-white/5 transition-colors">
                        <td className="py-3.5 font-mono font-bold text-white">MP-LIQ-DUENO-01</td>
                        <td className="py-3.5">Liquidación Arrendador</td>
                        <td className="py-3.5 font-bold text-[#92E3CB]">$100.800 CLP</td>
                        <td className="py-3.5 text-slate-400">80% arriendo neto ($100.800) a Carlos Mendoza</td>
                        <td className="py-3.5 text-right">
                          <span className="inline-flex items-center rounded-full bg-amber-500/15 border border-amber-500/30 px-2.5 py-0.5 text-[10px] font-bold text-amber-400">
                            Pendiente Pago
                          </span>
                        </td>
                      </tr>
                      <tr className="hover:bg-white/5 transition-colors">
                        <td className="py-3.5 font-mono font-bold text-white">MP-FINE-PEAJE-01</td>
                        <td className="py-3.5">Peajes y multas post-arriendo</td>
                        <td className="py-3.5 font-bold text-white">$8.450 CLP</td>
                        <td className="py-3.5 text-slate-400">
                          Boleta Autopista Central del período de arriendo · 100% al dueño (plazo de{" "}
                          {configPlataforma.dias_cobro_posterior_peajes} días)
                        </td>
                        <td className="py-3.5 text-right">
                          <span className="inline-flex items-center rounded-full bg-[#2FBF9B]/15 border border-[#2FBF9B]/30 px-2.5 py-0.5 text-[10px] font-bold text-[#2FBF9B]">
                            Capturado
                          </span>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </TabsContent>

            {/* TAB 2: DISPUTAS & LIGHTBOX */}
            <TabsContent value="disputas" className="space-y-6">
              <div className="rounded-3xl border border-[#2FBF9B]/20 bg-[#0E3736] p-6 shadow-xl space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                      <Scale className="h-4 w-4 text-[#2FBF9B]" />
                      Disputas Formales de Arriendo
                    </h3>
                    <p className="text-xs text-slate-400">
                      Contraste fotográfico y arbitraje de cargos de limpieza, combustible y siniestros
                    </p>
                  </div>
                  <span className="text-xs font-semibold text-rose-400 bg-rose-950/30 border border-rose-500/30 px-3 py-1 rounded-full">
                    {disputas.length} Casos
                  </span>
                </div>

                <div className="space-y-4">
                  {disputas.map((disp) => (
                    <div key={disp.id} className="rounded-2xl border border-white/10 bg-[#061E1F] p-5 space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                        <div>
                          <h4 className="text-base font-bold text-white">{disp.auto} • Caso #{disp.id}</h4>
                          <div className="text-xs text-slate-400 mt-0.5">
                            Cliente: <span className="text-white font-semibold">{disp.cliente}</span> ↔ Dueño: <span className="text-white font-semibold">{disp.dueno}</span>
                          </div>
                        </div>

                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-rose-950/40 text-rose-400 border border-rose-500/30 self-start sm:self-auto">
                          {disp.estado}
                        </span>
                      </div>

                      <p className="text-xs text-slate-300 leading-relaxed bg-[#0E3736] p-3 rounded-xl border border-white/5">
                        <strong className="text-white">Motivo reportado:</strong> {disp.motivo} (Monto en disputa: ${disp.montoDisputa?.toLocaleString("es-CL")} CLP)
                      </p>

                      <div className="pt-2 border-t border-white/10 flex justify-between items-center">
                        <span className="text-xs text-slate-400 flex items-center gap-1.5">
                          <Camera className="h-3.5 w-3.5 text-[#2FBF9B]" />
                          Checklist de 9 fotos disponible
                        </span>

                        <Button
                          size="sm"
                          onClick={() => setLightboxDisputa(disp)}
                          className="rounded-xl text-xs font-semibold bg-[#2FBF9B] text-[#061E1F] hover:bg-[#28A787] gap-1.5 shadow-md shadow-[#2FBF9B]/20"
                        >
                          <Search className="h-3.5 w-3.5" />
                          Abrir Comparador Antes vs Después
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </TabsContent>

            {/* TAB 3: REVISIÓN MANUAL OCR */}
            <TabsContent value="documentos" className="space-y-6">
              <div className="rounded-3xl border border-[#2FBF9B]/20 bg-[#0E3736] p-6 shadow-xl space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                      <FileCheck2 className="h-4 w-4 text-[#2FBF9B]" />
                      Cola de Revisión Manual OCR (RF-31)
                    </h3>
                    <p className="text-xs text-slate-400">
                      Usuarios con score OCR &lt; 80% o alertas de legibilidad que requieren validación humana
                    </p>
                  </div>
                  <span className="text-xs font-semibold text-[#2FBF9B] bg-[#2FBF9B]/10 border border-[#2FBF9B]/30 px-3 py-1 rounded-full">
                    {documentosPendientes.length} Pendientes
                  </span>
                </div>

                <div className="space-y-4">
                  {documentosPendientes.length === 0 ? (
                    <div className="p-12 text-center text-sm text-slate-400 border border-dashed border-white/10 rounded-2xl flex items-center justify-center gap-2">
                      <Check className="h-4 w-4 text-[#2FBF9B]" />
                      No hay documentos pendientes de validación en este momento.
                    </div>
                  ) : (
                    documentosPendientes.map((doc) => (
                      <div key={doc.id} className="rounded-2xl border border-white/10 bg-[#061E1F] p-5">
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
                          <div className="md:col-span-3 flex justify-center">
                            <img
                              src={doc.carnet_url}
                              alt={doc.nombre}
                              className="h-28 w-44 rounded-xl object-cover border border-white/10 shadow-md"
                            />
                          </div>

                          <div className="md:col-span-9 space-y-3">
                            <div className="flex flex-wrap items-center gap-2">
                              <h4 className="text-base font-bold text-white">{doc.nombre}</h4>
                              <span className="font-mono text-xs font-bold bg-[#0E3736] text-white px-2 py-0.5 rounded border border-white/10">
                                RUT: {doc.rut}
                              </span>
                              <span className="font-semibold text-xs bg-[#2FBF9B]/20 text-[#92E3CB] border border-[#2FBF9B]/30 px-2 py-0.5 rounded">
                                Score OCR: {(doc.confianza_ocr * 100).toFixed(0)}%
                              </span>
                            </div>

                            <p className="text-xs text-[#92E3CB] bg-[#0E3736] p-3 rounded-xl border border-[#2FBF9B]/20">
                              {doc.motivo_revision}
                            </p>

                            <div className="flex flex-wrap justify-end gap-3 pt-2">
                              <Button
                                variant="outline"
                                size="sm"
                                className="rounded-xl text-xs font-semibold text-red-400 border-red-500/30 bg-red-950/20 hover:bg-red-950/40"
                                onClick={() => handleRechazarDocumento(doc.id)}
                              >
                                <XCircle className="h-3.5 w-3.5 mr-1" />
                                Rechazar y Solicitar Foto Nítida
                              </Button>

                              <Button
                                size="sm"
                                className="rounded-xl text-xs font-bold bg-[#2FBF9B] text-[#061E1F] hover:bg-[#28A787]"
                                onClick={() => handleAprobarDocumento(doc.id)}
                              >
                                <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                                Aprobar Manualmente & Activar Garantía
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </TabsContent>

            {/* TAB 4: CONFIGURACIÓN DINÁMICA (RF-33) */}
            <TabsContent value="configuracion" className="space-y-6">
              <div className="rounded-3xl border border-[#2FBF9B]/20 bg-[#0E3736] p-6 shadow-xl space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                      <Settings className="h-4 w-4 text-[#2FBF9B]" />
                      Parámetros Financieros & Operativos de Plataforma (RF-33)
                    </h3>
                    <p className="text-xs text-slate-400">
                      Edita valores de negocio en tiempo real sin hardcodear código ni reiniciar servicios
                    </p>
                  </div>
                  {configSaved && (
                    <span className="text-xs font-semibold text-[#2FBF9B] bg-[#2FBF9B]/10 border border-[#2FBF9B]/30 px-3 py-1 rounded-full flex items-center gap-1">
                      <Check className="h-3 w-3" />
                      Guardado con Éxito
                    </span>
                  )}
                </div>

                <form onSubmit={handleGuardarConfig} className="space-y-6 pt-2">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="valor_uf" className="text-xs font-semibold text-slate-300">
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
                        className="font-mono text-sm bg-[#061E1F] text-white border-white/10 rounded-xl"
                      />
                      <p className="text-[11px] text-slate-400">
                        Deducible 15 UF = ${(15 * configPlataforma.valor_uf_clp).toLocaleString("es-CL")} CLP (50/50)
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="comision" className="text-xs font-semibold text-slate-300">
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
                        className="font-mono text-sm bg-[#061E1F] text-white border-white/10 rounded-xl"
                      />
                      <p className="text-[11px] text-slate-400">
                        Dueño recibe el {100 - configPlataforma.comision_plataforma_pct}% del arriendo base
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="hold_enrol" className="text-xs font-semibold text-slate-300">
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
                        className="font-mono text-sm bg-[#061E1F] text-white border-white/10 rounded-xl"
                      />
                      <p className="text-[11px] text-slate-400">
                        Pre-autorización bancaria de seguridad
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="clean_std" className="text-xs font-semibold text-slate-300">
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
                        className="font-mono text-sm bg-[#061E1F] text-white border-white/10 rounded-xl"
                      />
                      <p className="text-[11px] text-slate-400">
                        100% transferido al dueño para lavado
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="clean_deep" className="text-xs font-semibold text-slate-300">
                        Multa Limpieza Profunda ($ CLP)
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
                        className="font-mono text-sm bg-[#061E1F] text-white border-white/10 rounded-xl"
                      />
                      <p className="text-[11px] text-slate-400">
                        100% transferido al dueño para tapiz
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="km_included" className="text-xs font-semibold text-slate-300">
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
                        className="font-mono text-sm bg-[#061E1F] text-white border-white/10 rounded-xl"
                      />
                      <p className="text-[11px] text-slate-400">
                        Kilometraje libre permitido por día
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="dias_peajes" className="text-xs font-semibold text-slate-300">
                        Plazo Cobro de Peajes y Multas (días)
                      </Label>
                      <Input
                        id="dias_peajes"
                        type="number"
                        value={configPlataforma.dias_cobro_posterior_peajes}
                        onChange={(e) =>
                          setConfigPlataforma({
                            ...configPlataforma,
                            dias_cobro_posterior_peajes: parseInt(e.target.value),
                          })
                        }
                        className="font-mono text-sm bg-[#061E1F] text-white border-white/10 rounded-xl"
                      />
                      <p className="text-[11px] text-slate-400">
                        Días tras la devolución para imputar TAG y fotomultas al arrendatario
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="edad_minima" className="text-xs font-semibold text-slate-300">
                        Edad Mínima para Arrendar (años)
                      </Label>
                      <Input
                        id="edad_minima"
                        type="number"
                        value={configPlataforma.edad_minima_arriendo}
                        onChange={(e) =>
                          setConfigPlataforma({
                            ...configPlataforma,
                            edad_minima_arriendo: parseInt(e.target.value),
                          })
                        }
                        className="font-mono text-sm bg-[#061E1F] text-white border-white/10 rounded-xl"
                      />
                      <p className="text-[11px] text-slate-400">
                        Se valida al crear la reserva, junto con la vigencia de la licencia
                      </p>
                    </div>
                  </div>

                  <div className="flex justify-end pt-4 border-t border-white/10">
                    <Button
                      type="submit"
                      size="lg"
                      className="rounded-2xl px-8 py-6 text-sm font-bold bg-[#2FBF9B] text-[#061E1F] hover:bg-[#28A787] shadow-xl shadow-[#2FBF9B]/20"
                    >
                      Guardar Parámetros de Plataforma
                    </Button>
                  </div>
                </form>
              </div>
            </TabsContent>
          </Tabs>

          {/* LIGHTBOX DIALOG */}
          {lightboxDisputa && (
            <Dialog open={!!lightboxDisputa} onOpenChange={(open) => !open && setLightboxDisputa(null)}>
              <DialogContent className="max-w-4xl bg-[#0E3736] border border-[#2FBF9B]/30 text-white rounded-3xl p-6 sm:p-8">
                <DialogHeader>
                  <DialogTitle className="text-xl font-black flex items-center gap-2 text-white">
                    <Camera className="h-5 w-5 text-[#2FBF9B]" />
                    Contraste Fotográfico de Entrega vs Devolución
                  </DialogTitle>
                  <DialogDescription className="text-xs text-slate-300">
                    {lightboxDisputa.auto} • Motivo: {lightboxDisputa.motivo}
                  </DialogDescription>
                </DialogHeader>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 my-3">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-[#2FBF9B] bg-[#061E1F] px-2.5 py-1 rounded-lg border border-[#2FBF9B]/30">
                        1. Estado Inicial (Check-in)
                      </span>
                      <span className="text-slate-400">Vehículo limpio</span>
                    </div>
                    <img
                      src={lightboxDisputa.fotoAntes}
                      alt="Foto Antes"
                      className="h-64 w-full rounded-2xl object-cover border border-white/10"
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-rose-400 bg-rose-950/40 px-2.5 py-1 rounded-lg border border-rose-500/30">
                        2. Estado Final (Check-out)
                      </span>
                      <span className="text-slate-400">Retorno con barro</span>
                    </div>
                    <img
                      src={lightboxDisputa.fotoDespues}
                      alt="Foto Después"
                      className="h-64 w-full rounded-2xl object-cover border border-white/10"
                    />
                  </div>
                </div>

                <DialogFooter className="flex flex-col sm:flex-row sm:justify-between items-center gap-3 pt-3 border-t border-white/10">
                  <div className="text-xs text-slate-300">
                    Monto en disputa: <span className="font-bold text-[#2FBF9B]">${lightboxDisputa.montoDisputa?.toLocaleString("es-CL")} CLP</span>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-xl text-xs font-semibold border-white/15 hover:bg-white/10"
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
                      className="rounded-xl text-xs font-bold bg-[#2FBF9B] text-[#061E1F] hover:bg-[#28A787]"
                      onClick={() =>
                        handleResolverDisputa(
                          lightboxDisputa.id,
                          "Cargo de limpieza ratificado por Admin. Se transfiere $15.000 CLP íntegros al dueño."
                        )
                      }
                    >
                      Ratificar y Abonar al Dueño
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
