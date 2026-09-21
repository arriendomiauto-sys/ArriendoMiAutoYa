import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  colors,
  theme,
  Icon,
  ApiClient,
  showAlert,
  msjError,
  useApp,
} from "@rentacar/mobile-shared";
import { CabeceraOwner, oc } from "../comun";
import { CuentaCobroModal } from "./CuentaCobroModal";

const DIAS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const fmt = (m) => `$${Math.abs(m || 0).toLocaleString("es-CL")}`;
const fmtFecha = (t) =>
  t ? new Date(t).toLocaleDateString("es-CL", { day: "numeric", month: "short", year: "numeric" }) : "";

export function EarningsScreen({ onOpenDisputes, onOpenChat, noLeidos }) {
  const insets = useSafeAreaInsets();
  const { currentUser } = useApp?.() || {};

  const [cuentas, setCuentas] = useState([]);
  const [cargandoCuentas, setCargandoCuentas] = useState(true);
  const [cuentaModal, setCuentaModal] = useState(false);
  const cargarCuentas = useCallback(async () => {
    try {
      setCuentas(await ApiClient.getCuentasCobro());
    } catch (e) {
      /* silencioso */
    } finally {
      setCargandoCuentas(false);
    }
  }, []);

  const usarCuenta = useCallback(
    async (cuentaId) => {
      try {
        await ApiClient.marcarCuentaCobroPredeterminada(cuentaId);
        await cargarCuentas();
      } catch (err) {
        showAlert("No se pudo actualizar", msjError(err, "Intenta de nuevo."));
      }
    },
    [cargarCuentas]
  );

  const eliminarCuenta = useCallback(
    (cuentaId) => {
      showAlert("Eliminar cuenta", "¿Eliminar esta cuenta de cobro?", [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Eliminar",
          style: "destructive",
          onPress: async () => {
            try {
              await ApiClient.eliminarCuentaCobro(cuentaId);
              await cargarCuentas();
            } catch (err) {
              showAlert("No se pudo actualizar", msjError(err, "Intenta de nuevo."));
            }
          },
        },
      ]);
    },
    [cargarCuentas]
  );

  const cachedGanancias = ApiClient.getCachedGanancias?.() || null;
  const [ganancias, setGanancias] = useState(cachedGanancias);
  const [loading, setLoading] = useState(!cachedGanancias);
  const [refrescando, setRefrescando] = useState(false);
  const [error, setError] = useState(null);

  const cargar = useCallback(async (forzar = false) => {
    if (!forzar && !ApiClient.getCachedGanancias?.()) {
      setLoading(true);
    }
    try {
      const data = await ApiClient.getMisGanancias(forzar ? { force: true } : {});
      if (data) setGanancias(data);
      setError(null);
    } catch (err) {
      console.warn("[EarningsScreen]", err.message);
      setError(msjError(err, "No pudimos cargar tus ganancias."));
    } finally {
      setLoading(false);
      setRefrescando(false);
    }
  }, []);

  // Se muestra el caché al instante y se revalida siempre: el saldo cambia
  // fuera de esta pantalla (devoluciones, depósitos automáticos) y el caché de
  // 30 s dejaba el valor viejo a la vista sin que nada lo refrescara.
  useEffect(() => {
    cargar(true);
  }, [cargar]);

  useEffect(() => {
    cargarCuentas();
  }, [cargarCuentas]);

  const predeterminada = cuentas.find((c) => c.predeterminada) || null;

  const saldo = ganancias?.saldo_disponible_clp ?? 0;
  const totalPagado = ganancias?.total_pagado_clp ?? 0;
  const totalGanado = (ganancias?.total_ganado_clp ?? (saldo + totalPagado)) || saldo;
  const historial = ganancias?.historial ?? [];
  const porAuto = ganancias?.por_auto ?? [];
  const bonoReferidoPendiente = ganancias?.bono_referido_pendiente_clp ?? 0;

  const hoy = new Date();
  const barras = Array.from({ length: 7 }).map((_, i) => {
    const dia = new Date(hoy);
    dia.setDate(hoy.getDate() - (6 - i));
    const total = historial
      .filter((h) => {
        const f = new Date(h.timestamp);
        return f.getFullYear() === dia.getFullYear() && f.getMonth() === dia.getMonth() && f.getDate() === dia.getDate();
      })
      .reduce((s, h) => s + h.monto, 0);
    return { dia: DIAS[dia.getDay()], monto: total };
  });
  const maxBarra = Math.max(...barras.map((b) => b.monto), 1);

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: Math.max(insets.top, 12) }}>
      <CabeceraOwner
        titulo="Ganancias"
        subtitulo="85% neto de arriendos + 100% de compensaciones"
        noLeidos={noLeidos}
        onMensajes={onOpenChat}
        right={
          onOpenDisputes ? (
            <TouchableOpacity
              onPress={onOpenDisputes}
              className="flex-row items-center gap-1.5 h-10 px-3 rounded-xl border border-gray-200 bg-white"
              activeOpacity={0.8}
            >
              <Icon name="shield" size={15} color={colors.primary} />
              <Text className="text-xs font-bold text-primary">Disputas</Text>
            </TouchableOpacity>
          ) : null
        }
      />

      <ScrollView
        contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 16) + 24 }}
        className="px-4"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refrescando}
            onRefresh={() => {
              setRefrescando(true);
              cargar(true);
              cargarCuentas();
            }}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        <View className="flex-col gap-4">
          {/* Saldo y Depósito Automático — el bloque oscuro/premium de la pantalla */}
          <View className="bg-[#101928] rounded-2xl border border-white/10 p-5 gap-1 shadow-lg">
            <Text className="text-xs font-semibold text-white/70 uppercase tracking-wider">
              Total generado
            </Text>
            {loading ? (
              <ActivityIndicator color="#FFFFFF" className="my-2.5 self-start" />
            ) : (
              <Text className="text-[32px] font-extrabold text-accent -tracking-tight">
                {fmt(totalGanado)}
              </Text>
            )}
            <Text className="text-xs text-white/75 mb-3">
              {ganancias
                ? `${ganancias.cantidad_liquidaciones} arriendo(s) liquidado(s) · Depósito directo a tu cuenta`
                : loading
                  ? "Cargando…"
                  : error
                    ? "Sin datos por el momento"
                    : "Aún no hay movimiento"}
            </Text>
            {bonoReferidoPendiente > 0 ? (
              <View className="flex-row items-center gap-1.5 -mt-1.5 mb-3">
                <Icon name="star" size={13} color="#FFFFFF" />
                <Text className="text-xs text-white/90 font-semibold">
                  + {fmt(bonoReferidoPendiente)} de bono por invitación incluido
                </Text>
              </View>
            ) : null}

            {cargandoCuentas ? (
              <View className="h-[54px] rounded-xl bg-white/10 mt-2" />
            ) : predeterminada ? (
              <TouchableOpacity
                className="flex-row items-center gap-2.5 bg-accent/15 rounded-xl border border-accent/35 py-2.5 px-3.5 mt-2"
                onPress={() => setCuentaModal(true)}
                activeOpacity={0.85}
              >
                <View className="w-2 h-2 rounded-full bg-accent" />
                <View className="flex-1">
                  <Text className="text-[13px] font-bold text-white">Depósito automático activo</Text>
                  <Text className="text-xs text-white/80 mt-0.5" numberOfLines={1}>
                    {predeterminada.banco} · {predeterminada.tipo_cuenta} (N° {predeterminada.numero})
                  </Text>
                </View>
                <Text className="text-[13px] font-bold text-accent">Cambiar</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                className="flex-row items-center gap-2.5 bg-amber-500/15 rounded-xl border border-amber-500/40 py-2.5 px-3.5 mt-2"
                onPress={() => setCuentaModal(true)}
                activeOpacity={0.85}
              >
                <Icon name="alert" size={16} color="#FFFFFF" />
                <View className="flex-1">
                  <Text className="text-[13px] font-bold text-yellow-300">Falta tu cuenta de cobro</Text>
                  <Text className="text-[11.5px] text-white/85 mt-0.5">
                    Agrégala para recibir tus depósitos automáticos.
                  </Text>
                </View>
                <Text className="text-[13px] font-bold text-yellow-300">Configurar</Text>
              </TouchableOpacity>
            )}
          </View>

          {error ? (
            <View className="flex-row items-center gap-3 bg-amber-50 border border-amber-200 rounded-2xl p-4">
              <View className="flex-1">
                <Text className="text-[13px] font-bold text-amber-800">No pudimos cargar tus ganancias</Text>
                <Text className="text-xs text-textMuted mt-0.5 leading-[17px]">{error}</Text>
              </View>
              <TouchableOpacity
                className="flex-row items-center gap-1.5 bg-primary py-2 px-3 rounded-lg"
                onPress={() => {
                  setLoading(true);
                  cargar(true);
                }}
                activeOpacity={0.85}
              >
                <Icon name="refresh" size={14} color="#FFFFFF" />
                <Text className="text-xs font-bold text-white">Reintentar</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          {/* Cuentas de Cobro */}
          <View className="bg-white rounded-2xl border border-gray-100 p-4 gap-3 shadow-sm">
            <View className="flex-row justify-between items-center">
              <View className="flex-row items-center gap-1.5">
                <Icon name="wallet" size={15} color={colors.accentDark} />
                <Text className="text-base font-bold text-primary">Cuentas de cobro</Text>
              </View>
              <TouchableOpacity onPress={() => setCuentaModal(true)}>
                <Text className="text-[13px] font-bold text-accent-700">Agregar cuenta</Text>
              </TouchableOpacity>
            </View>
            <Text className="text-xs text-textMuted leading-[17px] -mt-1">
              El 85% neto del arriendo y el 100% de compensaciones se depositan automáticamente en tu cuenta predeterminada al devolver el vehículo.
            </Text>
            {cuentas.length === 0 ? (
              <Text className="text-[13px] text-textMuted leading-[18px]">
                Aún no agregas una cuenta de cobro.
              </Text>
            ) : (
              cuentas.map((c) => (
                <View key={c.id} className="flex-row items-center py-2.5 border-t border-gray-100">
                  <View className="flex-1">
                    <Text className="text-[15px] font-bold text-textDark">{c.banco}</Text>
                    <Text className="text-[13px] text-textMuted">
                      {c.tipo_cuenta} · {c.numero}
                    </Text>
                  </View>
                  {c.predeterminada ? (
                    <Text className="text-[11px] font-bold text-accent-700 bg-accent/20 px-2 py-0.5 rounded-full">
                      Predeterminada
                    </Text>
                  ) : (
                    <TouchableOpacity onPress={() => usarCuenta(c.id)}>
                      <Text className="text-[13px] font-bold text-accent-700">Usar esta</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    onPress={() => eliminarCuenta(c.id)}
                    hitSlop={theme.control.hitSlop}
                    className="ml-2.5"
                  >
                    <Icon name="trash" size={15} color={colors.textMuted} />
                  </TouchableOpacity>
                </View>
              ))
            )}
          </View>

          {/* Últimos 7 días */}
          <View className="bg-white rounded-2xl border border-gray-100 p-4 gap-3 shadow-sm">
            <Text className="text-base font-bold text-primary">Últimos 7 días</Text>
            <View className="flex-row justify-between items-end h-[120px] pt-2">
              {barras.map((b, i) => (
                <View key={i} className="items-center flex-1 gap-1.5">
                  <View
                    className="w-4 bg-accent rounded"
                    style={{ height: Math.max((b.monto / maxBarra) * 96, b.monto > 0 ? 6 : 2) }}
                  />
                  <Text className="text-[11px] text-textMuted font-semibold">{b.dia}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* Rendimiento de tu flota */}
          {porAuto.length > 0 && (
            <View className="bg-white rounded-2xl border border-gray-100 p-4 gap-3 shadow-sm">
              <Text className="text-base font-bold text-primary">Rendimiento de tu flota</Text>
              {porAuto.map((a, i) => (
                <View
                  key={a.auto_id}
                  className={`gap-1.5 py-3 ${i < porAuto.length - 1 ? "border-b border-gray-100" : ""}`}
                >
                  <View className="flex-row justify-between items-center">
                    <Text className="flex-1 text-[13px] font-semibold text-textDark" numberOfLines={1}>
                      {a.marca} {a.modelo} · {a.patente}
                    </Text>
                    <Text className="text-sm font-extrabold text-accent-700">
                      {fmt(a.ganancia_total_clp)}
                    </Text>
                  </View>
                  <View className="h-1.5 rounded-full bg-emerald-50 overflow-hidden">
                    <View
                      className="h-full rounded-full bg-accent"
                      style={{ width: `${Math.max(a.tasa_ocupacion_pct, a.tasa_ocupacion_pct > 0 ? 4 : 0)}%` }}
                    />
                  </View>
                  <Text className="text-[11px] text-textMuted">
                    {a.tasa_ocupacion_pct}% de ocupación · {a.reservas_finalizadas} arriendo{a.reservas_finalizadas === 1 ? "" : "s"} finalizado{a.reservas_finalizadas === 1 ? "" : "s"}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {/* Últimas liquidaciones */}
          <View className="bg-white rounded-2xl border border-gray-100 p-4 gap-3 shadow-sm mb-6">
            <Text className="text-base font-bold text-primary">Últimas liquidaciones</Text>
            {loading ? (
              <ActivityIndicator color={colors.accentDark} className="my-2.5" />
            ) : historial.length === 0 ? (
              <Text className="text-[13px] text-textMuted leading-[18px]">
                Aparecerán aquí cuando termines tu primer arriendo.
              </Text>
            ) : (
              historial.map((item, i) => {
                const isPaid = item.estado === "pagado";
                return (
                  <View
                    key={item.id}
                    className={`flex-row items-center justify-between gap-3 py-2.5 ${
                      i < historial.length - 1 ? "border-b border-gray-100" : ""
                    }`}
                  >
                    <View className="flex-1">
                      <Text className="text-[13px] font-semibold text-textDark">
                        Liquidación de arriendo
                        {item.reserva_id ? ` · ${item.reserva_id.slice(0, 8)}` : ""}
                      </Text>
                      <Text className="text-[11px] text-textMuted mt-0.5">
                        {fmtFecha(item.timestamp)} ·{" "}
                        {isPaid
                          ? "Transferido a tu cuenta"
                          : item.estado === "procesando"
                            ? "Depósito en proceso"
                            : item.estado === "fallido"
                              ? "No se pudo depositar — revisa tu cuenta"
                              : predeterminada
                                ? "Depósito en camino"
                                : "Falta cuenta de cobro"}
                      </Text>
                    </View>
                    <Text className={`text-sm font-extrabold ${isPaid ? "text-accent-700" : "text-textMuted"}`}>
                      +{fmt(item.monto)}
                    </Text>
                  </View>
                );
              })
            )}
          </View>
        </View>
      </ScrollView>

      <CuentaCobroModal
        visible={cuentaModal}
        onClose={() => setCuentaModal(false)}
        onGuardada={() => {
          cargarCuentas();
          cargar(true);
        }}
        nombreTitular={currentUser?.nombre}
        rutTitular={currentUser?.rut}
        identidadVerificada={currentUser?.estado_documentos === "verificado"}
      />
    </View>
  );
}
