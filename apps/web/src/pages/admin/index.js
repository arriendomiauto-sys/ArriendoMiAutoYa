import React, { useState, useEffect, useCallback } from "react";
import Head from "next/head";
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
  Search,
  CheckCircle2,
  XCircle,
  Camera,
  Lock,
  Check,
  LogOut,
  Loader2,
} from "lucide-react";

import { fetchApi } from "../../lib/api";
import { useStaffAuth } from "../../lib/useStaffAuth";

export default function AdminPortal() {
  const { loading: authLoading, authorized, staffUser, logout } = useStaffAuth(["admin"]);

  const [activeTab, setActiveTab] = useState("financiero");
  const [loadingData, setLoadingData] = useState(true);

  const [configPlataforma, setConfigPlataforma] = useState(null);
  const [configSaved, setConfigSaved] = useState(false);
  const [finanzas, setFinanzas] = useState(null);
  const [metricas, setMetricas] = useState(null);
  const [disputas, setDisputas] = useState([]);
  const [documentosPendientes, setDocumentosPendientes] = useState([]);
  const [lightboxDisputa, setLightboxDisputa] = useState(null);
  const [resolucionTexto, setResolucionTexto] = useState("");
  const [accionPago, setAccionPago] = useState("sin_cobro");

  const cargarTodo = useCallback(async () => {
    setLoadingData(true);
    try {
      const [config, fin, met, disp, docs] = await Promise.all([
        fetchApi("/admin/configuracion"),
        fetchApi("/admin/panel-financiero"),
        fetchApi("/admin/metricas-globales"),
        fetchApi("/disputas?estado=abierta"),
        fetchApi("/admin/documentos/pendientes"),
      ]);
      setConfigPlataforma(config);
      setFinanzas(fin);
      setMetricas(met);
      setDisputas(disp);
      setDocumentosPendientes(docs);
    } catch (err) {
      console.warn("[AdminPortal] Error cargando datos:", err.message);
    } finally {
      setLoadingData(false);
    }
  }, []);

  useEffect(() => {
    if (authorized) cargarTodo();
  }, [authorized, cargarTodo]);

  const handleGuardarConfig = async (e) => {
    e.preventDefault();
    try {
      const actualizado = await fetchApi("/admin/configuracion", {
        method: "PUT",
        body: JSON.stringify(configPlataforma),
      });
      setConfigPlataforma(actualizado);
      setConfigSaved(true);
      setTimeout(() => setConfigSaved(false), 3000);
    } catch (err) {
      alert(`No se pudo guardar: ${err.message}`);
    }
  };

  const handleResolverDisputa = async () => {
    if (!lightboxDisputa || !resolucionTexto.trim()) return;
    try {
      await fetchApi(`/disputas/${lightboxDisputa.id}/resolver`, {
        method: "POST",
        body: JSON.stringify({ resolucion: resolucionTexto.trim(), accion_pago: accionPago }),
      });
      setLightboxDisputa(null);
      setResolucionTexto("");
      setAccionPago("sin_cobro");
      cargarTodo();
    } catch (err) {
      alert(`No se pudo resolver la disputa: ${err.message}`);
    }
  };

  const handleRevisarDocumento = async (userId, accion) => {
    const notas = accion === "rechazar" ? window.prompt("Motivo del rechazo:") : "Verificado manualmente por Admin.";
    if (accion === "rechazar" && !notas) return;
    try {
      await fetchApi(`/admin/documentos/${userId}/revisar`, {
        method: "POST",
        body: JSON.stringify({ accion, notas }),
      });
      setDocumentosPendientes((prev) => prev.filter((d) => d.id !== userId));
    } catch (err) {
      alert(`No se pudo procesar: ${err.message}`);
    }
  };

  if (authLoading || !authorized) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-[#061E1F]">
        <Loader2 className="h-6 w-6 text-[#2FBF9B] animate-spin" />
      </main>
    );
  }

  return (
    <>
      <Head>
        <title>Panel Administrador General - ArriendoMiAutoYa</title>
      </Head>

      <Navbar />

      <main className="min-h-screen pt-28 pb-16 bg-[#061E1F] text-white relative overflow-hidden">
        <div className="absolute top-10 left-1/4 w-[500px] h-[500px] bg-[#2FBF9B]/10 rounded-full filter blur-[100px] pointer-events-none" />
        <div className="absolute top-1/2 -right-32 w-[600px] h-[600px] bg-[#0F3D3E]/40 rounded-full filter blur-[120px] pointer-events-none" />

        <div className="container max-w-7xl mx-auto px-4 sm:px-6 space-y-8 relative z-10">

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-white/10 pb-6">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-[#2FBF9B]/30 bg-[#0E3736] px-3 py-1 text-xs font-bold text-[#2FBF9B]">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  ADMINISTRADOR GLOBAL
                </span>
                {metricas && (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-slate-300 backdrop-blur-md">
                    {metricas.total_usuarios} usuarios · {metricas.total_autos_activos} autos activos
                  </span>
                )}
              </div>
              <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
                Centro de Control & Finanzas
              </h1>
              <p className="text-sm text-slate-400">
                Supervisión financiera, resolución de arbitrajes, auditoría OCR (RF-31) y parámetros dinámicos (RF-33).
              </p>
            </div>

            <div className="rounded-2xl border border-[#2FBF9B]/20 bg-[#0E3736] p-3.5 shadow-xl flex items-center gap-3.5 backdrop-blur-md">
              <Avatar className="h-10 w-10 border border-[#2FBF9B]/50 bg-[#061E1F] text-[#2FBF9B]">
                <AvatarFallback className="font-bold bg-[#061E1F] text-[#2FBF9B]">
                  {(staffUser?.nombre || staffUser?.email || "AD").slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div>
                <div className="font-bold text-sm text-white">{staffUser?.nombre || staffUser?.email}</div>
                <div className="text-[11px] text-slate-300">{staffUser?.rut ? `RUT: ${staffUser.rut}` : staffUser?.email}</div>
              </div>
              <Button onClick={logout} size="sm" variant="ghost" className="text-slate-400 hover:text-white">
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {loadingData ? (
            <div className="flex justify-center py-20">
              <Loader2 className="h-6 w-6 text-[#2FBF9B] animate-spin" />
            </div>
          ) : (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="grid w-full grid-cols-2 lg:grid-cols-4 h-auto p-1.5 bg-[#0E3736] border border-[#2FBF9B]/20 rounded-2xl">
              <TabsTrigger value="financiero" className="gap-2 py-3 rounded-xl text-xs sm:text-sm font-semibold data-[state=active]:bg-[#2FBF9B] data-[state=active]:text-[#061E1F] data-[state=active]:font-bold text-slate-300 transition-all">
                <DollarSign className="h-4 w-4" />
                Financiero
              </TabsTrigger>
              <TabsTrigger value="disputas" className="gap-2 py-3 rounded-xl text-xs sm:text-sm font-semibold data-[state=active]:bg-[#2FBF9B] data-[state=active]:text-[#061E1F] data-[state=active]:font-bold text-slate-300 transition-all">
                <Scale className="h-4 w-4" />
                Disputas ({disputas.length})
              </TabsTrigger>
              <TabsTrigger value="documentos" className="gap-2 py-3 rounded-xl text-xs sm:text-sm font-semibold data-[state=active]:bg-[#2FBF9B] data-[state=active]:text-[#061E1F] data-[state=active]:font-bold text-slate-300 transition-all">
                <FileCheck2 className="h-4 w-4" />
                Revisión OCR ({documentosPendientes.length})
              </TabsTrigger>
              <TabsTrigger value="configuracion" className="gap-2 py-3 rounded-xl text-xs sm:text-sm font-semibold data-[state=active]:bg-[#2FBF9B] data-[state=active]:text-[#061E1F] data-[state=active]:font-bold text-slate-300 transition-all">
                <Settings className="h-4 w-4" />
                Parámetros
              </TabsTrigger>
            </TabsList>

            {/* TAB 1: FINANCIERO */}
            <TabsContent value="financiero" className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="rounded-3xl border border-[#2FBF9B]/20 bg-[#0E3736] p-5 shadow-lg space-y-2">
                  <div className="flex justify-between items-center text-xs font-medium text-slate-300">
                    <span>Holds Capturados</span>
                    <Lock className="h-4 w-4 text-[#2FBF9B]" />
                  </div>
                  <div className="text-2xl sm:text-3xl font-black text-white">
                    ${(finanzas?.total_holds_capturados_clp || 0).toLocaleString("es-CL")} CLP
                  </div>
                  <p className="text-[11px] text-slate-400">{finanzas?.cantidad_transacciones || 0} transacciones registradas</p>
                </div>

                <div className="rounded-3xl border border-[#2FBF9B]/20 bg-[#0E3736] p-5 shadow-lg space-y-2">
                  <div className="flex justify-between items-center text-xs font-medium text-slate-300">
                    <span>Cobros Finales</span>
                    <CheckCircle2 className="h-4 w-4 text-[#2FBF9B]" />
                  </div>
                  <div className="text-2xl sm:text-3xl font-black text-[#2FBF9B]">
                    ${(finanzas?.total_cobros_finales_clp || 0).toLocaleString("es-CL")} CLP
                  </div>
                  <p className="text-[11px] text-slate-400">Transacciones liquidadas</p>
                </div>

                <div className="rounded-3xl border border-[#2FBF9B]/20 bg-[#0E3736] p-5 shadow-lg space-y-2">
                  <div className="flex justify-between items-center text-xs font-medium text-slate-300">
                    <span>Liquidación Pendiente</span>
                    <DollarSign className="h-4 w-4 text-[#92E3CB]" />
                  </div>
                  <div className="text-2xl sm:text-3xl font-black text-[#92E3CB]">
                    ${(finanzas?.total_liquidaciones_pendientes_clp || 0).toLocaleString("es-CL")} CLP
                  </div>
                  <p className="text-[11px] text-slate-400">Por pagar a dueños</p>
                </div>

                <div className="rounded-3xl border border-[#2FBF9B]/20 bg-[#0E3736] p-5 shadow-lg space-y-2">
                  <div className="flex justify-between items-center text-xs font-medium text-slate-300">
                    <span>Disputas Abiertas</span>
                    <Scale className="h-4 w-4 text-amber-400" />
                  </div>
                  <div className="text-2xl sm:text-3xl font-black text-amber-400">
                    {metricas?.total_disputas_abiertas ?? 0}
                  </div>
                  <p className="text-[11px] text-slate-400">Requieren revisión</p>
                </div>
              </div>
            </TabsContent>

            {/* TAB 2: DISPUTAS */}
            <TabsContent value="disputas" className="space-y-6">
              <div className="rounded-3xl border border-[#2FBF9B]/20 bg-[#0E3736] p-6 shadow-xl space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                      <Scale className="h-4 w-4 text-[#2FBF9B]" />
                      Disputas Abiertas
                    </h3>
                    <p className="text-xs text-slate-400">
                      Arbitraje de cargos de limpieza, combustible, atraso y no-coincidencia de identidad
                    </p>
                  </div>
                </div>

                {disputas.length === 0 ? (
                  <div className="p-12 text-center text-sm text-slate-400 border border-dashed border-white/10 rounded-2xl">
                    No hay disputas abiertas en este momento.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {disputas.map((disp) => (
                      <div key={disp.id} className="rounded-2xl border border-white/10 bg-[#061E1F] p-5 space-y-3">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                          <div>
                            <h4 className="text-base font-bold text-white">Caso #{disp.id.slice(0, 8).toUpperCase()} · {disp.tipo}</h4>
                            <div className="text-xs text-slate-400 mt-0.5 font-mono">Reserva: {disp.reserva_id}</div>
                          </div>
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-rose-950/40 text-rose-400 border border-rose-500/30 self-start sm:self-auto">
                            {disp.estado}
                          </span>
                        </div>

                        <p className="text-xs text-slate-300 leading-relaxed bg-[#0E3736] p-3 rounded-xl border border-white/5">
                          <strong className="text-white">Motivo:</strong> {disp.motivo || "Sin detalle"}
                        </p>

                        <div className="pt-2 border-t border-white/10 flex justify-between items-center">
                          {disp.foto_evidencia_url ? (
                            <span className="text-xs text-slate-400 flex items-center gap-1.5">
                              <Camera className="h-3.5 w-3.5 text-[#2FBF9B]" />
                              Evidencia fotográfica adjunta
                            </span>
                          ) : <span />}

                          <Button
                            size="sm"
                            onClick={() => setLightboxDisputa(disp)}
                            className="rounded-xl text-xs font-semibold bg-[#2FBF9B] text-[#061E1F] hover:bg-[#28A787] gap-1.5"
                          >
                            <Search className="h-3.5 w-3.5" />
                            Revisar y Resolver
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>

            {/* TAB 3: REVISIÓN OCR */}
            <TabsContent value="documentos" className="space-y-6">
              <div className="rounded-3xl border border-[#2FBF9B]/20 bg-[#0E3736] p-6 shadow-xl space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                      <FileCheck2 className="h-4 w-4 text-[#2FBF9B]" />
                      Cola de Revisión Manual OCR (RF-31)
                    </h3>
                    <p className="text-xs text-slate-400">
                      Usuarios con score OCR &lt; 80% o alertas de legibilidad
                    </p>
                  </div>
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
                            {doc.foto_perfil_verificada_url ? (
                              <img
                                src={doc.foto_perfil_verificada_url}
                                alt={doc.nombre}
                                className="h-28 w-44 rounded-xl object-cover border border-white/10 shadow-md"
                              />
                            ) : (
                              <div className="h-28 w-44 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-[10px] text-slate-500">
                                Sin foto
                              </div>
                            )}
                          </div>

                          <div className="md:col-span-9 space-y-3">
                            <div className="flex flex-wrap items-center gap-2">
                              <h4 className="text-base font-bold text-white">{doc.nombre || "Sin nombre"}</h4>
                              <span className="font-mono text-xs font-bold bg-[#0E3736] text-white px-2 py-0.5 rounded border border-white/10">
                                RUT: {doc.rut || "—"}
                              </span>
                              <span className="font-semibold text-xs bg-[#2FBF9B]/20 text-[#92E3CB] border border-[#2FBF9B]/30 px-2 py-0.5 rounded">
                                Score OCR: {((doc.confianza_ocr || 0) * 100).toFixed(0)}%
                              </span>
                            </div>

                            <p className="text-xs text-[#92E3CB] bg-[#0E3736] p-3 rounded-xl border border-[#2FBF9B]/20">
                              {doc.notas_auditoria || "Sin notas de auditoría."}
                            </p>

                            <div className="flex flex-wrap justify-end gap-3 pt-2">
                              <Button
                                variant="outline"
                                size="sm"
                                className="rounded-xl text-xs font-semibold text-red-400 border-red-500/30 bg-red-950/20 hover:bg-red-950/40"
                                onClick={() => handleRevisarDocumento(doc.id, "rechazar")}
                              >
                                <XCircle className="h-3.5 w-3.5 mr-1" />
                                Rechazar
                              </Button>

                              <Button
                                size="sm"
                                className="rounded-xl text-xs font-bold bg-[#2FBF9B] text-[#061E1F] hover:bg-[#28A787]"
                                onClick={() => handleRevisarDocumento(doc.id, "aprobar")}
                              >
                                <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                                Aprobar Manualmente
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

            {/* TAB 4: CONFIGURACIÓN */}
            <TabsContent value="configuracion" className="space-y-6">
              {configPlataforma && (
              <div className="rounded-3xl border border-[#2FBF9B]/20 bg-[#0E3736] p-6 shadow-xl space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                      <Settings className="h-4 w-4 text-[#2FBF9B]" />
                      Parámetros Financieros & Operativos (RF-33)
                    </h3>
                    <p className="text-xs text-slate-400">
                      Edita valores de negocio en tiempo real
                    </p>
                  </div>
                  {configSaved && (
                    <span className="text-xs font-semibold text-[#2FBF9B] bg-[#2FBF9B]/10 border border-[#2FBF9B]/30 px-3 py-1 rounded-full flex items-center gap-1">
                      <Check className="h-3 w-3" />
                      Guardado
                    </span>
                  )}
                </div>

                <form onSubmit={handleGuardarConfig} className="space-y-6 pt-2">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {[
                      { key: "valor_uf_clp", label: "Valor UF de Referencia ($ CLP)" },
                      { key: "comision_plataforma_pct", label: "Comisión Plataforma (%)" },
                      { key: "hold_enrolamiento_clp", label: "Hold Garantía Enrolamiento ($ CLP)" },
                      { key: "cargo_limpieza_estandar_clp", label: "Multa Limpieza Estándar ($ CLP)" },
                      { key: "cargo_limpieza_profunda_clp", label: "Multa Limpieza Profunda ($ CLP)" },
                      { key: "km_diarios_incluidos", label: "Kilómetros Diarios Incluidos" },
                    ].map((f) => (
                      <div key={f.key} className="space-y-2">
                        <Label className="text-xs font-semibold text-slate-300">{f.label}</Label>
                        <Input
                          type="number"
                          value={configPlataforma[f.key]}
                          onChange={(e) =>
                            setConfigPlataforma({ ...configPlataforma, [f.key]: parseFloat(e.target.value) })
                          }
                          className="font-mono text-sm bg-[#061E1F] text-white border-white/10 rounded-xl"
                        />
                      </div>
                    ))}
                  </div>

                  <div className="flex justify-end pt-4 border-t border-white/10">
                    <Button
                      type="submit"
                      size="lg"
                      className="rounded-2xl px-8 py-6 text-sm font-bold bg-[#2FBF9B] text-[#061E1F] hover:bg-[#28A787]"
                    >
                      Guardar Parámetros
                    </Button>
                  </div>
                </form>
              </div>
              )}
            </TabsContent>
          </Tabs>
          )}

          {/* DIALOG RESOLVER DISPUTA */}
          {lightboxDisputa && (
            <Dialog open={!!lightboxDisputa} onOpenChange={(open) => !open && setLightboxDisputa(null)}>
              <DialogContent className="max-w-2xl bg-[#0E3736] border border-[#2FBF9B]/30 text-white rounded-3xl p-6 sm:p-8">
                <DialogHeader>
                  <DialogTitle className="text-xl font-black flex items-center gap-2 text-white">
                    <Camera className="h-5 w-5 text-[#2FBF9B]" />
                    Resolver Disputa
                  </DialogTitle>
                  <DialogDescription className="text-xs text-slate-300">
                    Reserva {lightboxDisputa.reserva_id} • Tipo: {lightboxDisputa.tipo}
                  </DialogDescription>
                </DialogHeader>

                {lightboxDisputa.foto_evidencia_url && (
                  <img
                    src={lightboxDisputa.foto_evidencia_url}
                    alt="Evidencia"
                    className="h-64 w-full rounded-2xl object-cover border border-white/10 my-3"
                  />
                )}

                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold text-slate-300">Acción de pago</Label>
                    <select
                      value={accionPago}
                      onChange={(e) => setAccionPago(e.target.value)}
                      className="w-full rounded-xl bg-[#061E1F] border border-white/10 text-white text-sm px-3 py-2"
                    >
                      <option value="sin_cobro">Sin cobro</option>
                      <option value="reembolso_total">Reembolso total al cliente</option>
                      <option value="cobro_cliente">Cobro al cliente</option>
                      <option value="cargo_limpieza_dueno">Cargo de limpieza al dueño</option>
                      <option value="division_deducible_50_50">División deducible 50/50</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs font-semibold text-slate-300">Resolución</Label>
                    <textarea
                      value={resolucionTexto}
                      onChange={(e) => setResolucionTexto(e.target.value)}
                      className="w-full rounded-xl bg-[#061E1F] border border-white/10 text-white text-sm px-3 py-2 h-24"
                      placeholder="Describe la resolución tomada..."
                    />
                  </div>
                </div>

                <DialogFooter className="pt-3 border-t border-white/10">
                  <Button
                    size="sm"
                    disabled={!resolucionTexto.trim()}
                    onClick={handleResolverDisputa}
                    className="rounded-xl text-xs font-bold bg-[#2FBF9B] text-[#061E1F] hover:bg-[#28A787]"
                  >
                    Confirmar Resolución
                  </Button>
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
