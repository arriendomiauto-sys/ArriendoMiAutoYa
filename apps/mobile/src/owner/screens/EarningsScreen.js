import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  colors,
  theme,
  Icon,
  ApiClient,
} from "@rentacar/mobile-shared";
import { CabeceraOwner, oc, OWNER_PREMIUM_BG, OWNER_PREMIUM_LINE } from "../comun";
import { CuentaCobroModal } from "./CuentaCobroModal";

const DIAS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const fmt = (m) => `$${Math.abs(m || 0).toLocaleString("es-CL")}`;
const fmtFecha = (t) =>
  t ? new Date(t).toLocaleDateString("es-CL", { day: "numeric", month: "short", year: "numeric" }) : "";

export function EarningsScreen({ onOpenDisputes, onOpenChat, noLeidos }) {
  const insets = useSafeAreaInsets();

  const [cuentas, setCuentas] = useState([]);
  const [cuentaModal, setCuentaModal] = useState(false);
  const cargarCuentas = useCallback(async () => {
    try {
      setCuentas(await ApiClient.getCuentasCobro());
    } catch (e) {
      /* silencioso */
    }
  }, []);

  const [ganancias, setGanancias] = useState(null);
  const [loading, setLoading] = useState(true);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      setGanancias(await ApiClient.getMisGanancias());
    } catch (err) {
      console.warn("[EarningsScreen]", err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    cargar();
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
    <View style={[oc.screen, { paddingTop: Math.max(insets.top, 12) }]}>
      <CabeceraOwner
        titulo="Ganancias"
        subtitulo="85% neto de arriendos + 100% de compensaciones"
        noLeidos={noLeidos}
        onMensajes={onOpenChat}
        right={
          onOpenDisputes ? (
            <TouchableOpacity onPress={onOpenDisputes} style={styles.disputesBtn} activeOpacity={0.8}>
              <Icon name="shield" size={15} color={colors.primary} />
              <Text style={styles.disputesText}>Disputas</Text>
            </TouchableOpacity>
          ) : null
        }
      />

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom, 16) + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Saldo y Depósito Automático — el bloque teal de la pantalla. */}
        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>Total generado</Text>
          {loading ? (
            <ActivityIndicator color="#FFFFFF" style={{ marginVertical: 10, alignSelf: "flex-start" }} />
          ) : (
            <Text style={styles.balanceAmount}>{fmt(totalGanado)}</Text>
          )}
          <Text style={styles.balanceSub}>
            {ganancias ? `${ganancias.cantidad_liquidaciones} arriendo(s) liquidado(s) · Depósito directo a tu cuenta` : "Cargando…"}
          </Text>
          {bonoReferidoPendiente > 0 ? (
            <View style={styles.bonoReferidoRow}>
              <Icon name="star" size={13} color="#FFFFFF" />
              <Text style={styles.bonoReferidoTexto}>
                + {fmt(bonoReferidoPendiente)} de bono por invitación incluido
              </Text>
            </View>
          ) : null}

          {predeterminada ? (
            <TouchableOpacity style={styles.autoPayoutBanner} onPress={() => setCuentaModal(true)} activeOpacity={0.85}>
              <View style={styles.autoPayoutDot} />
              <View style={{ flex: 1 }}>
                <Text style={styles.autoPayoutTitle}>Depósito automático activo</Text>
                <Text style={styles.autoPayoutSub} numberOfLines={1}>
                  {predeterminada.banco} · {predeterminada.tipo_cuenta} (N° {predeterminada.numero})
                </Text>
              </View>
              <Text style={styles.autoPayoutLink}>Cambiar</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.missingBankBanner} onPress={() => setCuentaModal(true)} activeOpacity={0.85}>
              <Icon name="alert" size={16} color="#FFFFFF" />
              <View style={{ flex: 1 }}>
                <Text style={styles.missingBankTitle}>Falta tu cuenta bancaria</Text>
                <Text style={styles.missingBankSub}>Configúrala para recibir tus transferencias automáticas.</Text>
              </View>
              <Text style={styles.missingBankLink}>Configurar</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={[oc.card, oc.cardPadded, styles.cardBody]}>
          <View style={styles.rowBetween}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Icon name="wallet" size={15} color={colors.accentDark} />
              <Text style={oc.cardTitle}>Cuentas de cobro</Text>
            </View>
            <TouchableOpacity onPress={() => setCuentaModal(true)}>
              <Text style={styles.link}>Agregar cuenta</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.bankExplain}>
            El 85% neto del arriendo y el 100% de compensaciones se depositan automáticamente en tu cuenta predeterminada al devolver el vehículo.
          </Text>
          {cuentas.length === 0 ? (
            <Text style={styles.bankLineMuted}>Aún no agregas una cuenta de cobro.</Text>
          ) : (
            cuentas.map((c) => (
              <View key={c.id} style={styles.cuentaRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.bankName}>{c.banco}</Text>
                  <Text style={styles.bankLine}>
                    {c.tipo_cuenta} · {c.numero}
                  </Text>
                </View>
                {c.predeterminada ? (
                  <Text style={styles.badgePred}>Predeterminada</Text>
                ) : (
                  <TouchableOpacity
                    onPress={async () => {
                      await ApiClient.marcarCuentaCobroPredeterminada(c.id);
                      cargarCuentas();
                    }}
                  >
                    <Text style={styles.link}>Usar esta</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  onPress={async () => {
                    await ApiClient.eliminarCuentaCobro(c.id);
                    cargarCuentas();
                  }}
                  hitSlop={theme.control.hitSlop}
                  style={{ marginLeft: 10 }}
                >
                  <Icon name="trash" size={15} color={colors.textMuted} />
                </TouchableOpacity>
              </View>
            ))
          )}
        </View>

        <View style={[oc.card, oc.cardPadded, styles.cardBody]}>
          <Text style={oc.cardTitle}>Últimos 7 días</Text>
          <View style={styles.bars}>
            {barras.map((b, i) => (
              <View key={i} style={styles.barCol}>
                <View style={[styles.bar, { height: Math.max((b.monto / maxBarra) * 96, b.monto > 0 ? 6 : 2) }]} />
                <Text style={styles.barDay}>{b.dia}</Text>
              </View>
            ))}
          </View>
        </View>

        {porAuto.length > 0 && (
          <View style={[oc.card, oc.cardPadded, styles.cardBody]}>
            <Text style={oc.cardTitle}>Rendimiento de tu flota</Text>
            {porAuto.map((a, i) => (
              <View key={a.auto_id} style={[styles.fleetRow, i === porAuto.length - 1 && { borderBottomWidth: 0 }]}>
                <View style={styles.rowBetween}>
                  <Text style={styles.fleetName} numberOfLines={1}>
                    {a.marca} {a.modelo} · {a.patente}
                  </Text>
                  <Text style={styles.fleetEarnings}>{fmt(a.ganancia_total_clp)}</Text>
                </View>
                <View style={styles.occupancyTrack}>
                  <View
                    style={[
                      styles.occupancyFill,
                      { width: `${Math.max(a.tasa_ocupacion_pct, a.tasa_ocupacion_pct > 0 ? 4 : 0)}%` },
                    ]}
                  />
                </View>
                <Text style={styles.fleetMeta}>
                  {a.tasa_ocupacion_pct}% de ocupación · {a.reservas_finalizadas} arriendo{a.reservas_finalizadas === 1 ? "" : "s"} finalizado{a.reservas_finalizadas === 1 ? "" : "s"}
                </Text>
              </View>
            ))}
          </View>
        )}

        <View style={[oc.card, oc.cardPadded, styles.cardBody]}>
          <Text style={oc.cardTitle}>Últimas liquidaciones</Text>
          {loading ? (
            <ActivityIndicator color={colors.accentDark} style={{ marginVertical: 10 }} />
          ) : historial.length === 0 ? (
            <Text style={styles.bankLineMuted}>
              Aparecerán aquí cuando termines tu primer arriendo.
            </Text>
          ) : (
            historial.map((item, i) => {
              return (
                <View key={item.id} style={[styles.histRow, i === historial.length - 1 && { borderBottomWidth: 0 }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.histConcept}>
                      Liquidación de arriendo
                      {item.reserva_id ? ` · ${item.reserva_id.slice(0, 8)}` : ""}
                    </Text>
                    <Text style={styles.histDate}>
                      {fmtFecha(item.timestamp)} ·{" "}
                      {item.estado === "pagado"
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
                  <Text
                    style={[
                      styles.histAmount,
                      { color: item.estado === "pagado" ? colors.accentDark : colors.textMuted },
                    ]}
                  >
                    +{fmt(item.monto)}
                  </Text>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>

      <CuentaCobroModal
        visible={cuentaModal}
        onClose={() => setCuentaModal(false)}
        onGuardada={() => {
          cargarCuentas();
          cargar();
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: theme.spacing.screen, gap: theme.spacing.lg },
  disputesBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    height: 40,
    paddingHorizontal: 12,
    borderRadius: theme.radius.field,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  disputesText: { fontSize: 12, fontWeight: "700", color: colors.primary },

  cardBody: { gap: theme.spacing.md },

  balanceCard: {
    backgroundColor: OWNER_PREMIUM_BG,
    borderRadius: theme.radius.card,
    borderWidth: 1,
    borderColor: OWNER_PREMIUM_LINE,
    padding: theme.spacing.xl,
    gap: 4,
    ...theme.shadow.lg,
  },
  balanceLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "rgba(255,255,255,0.66)",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  // El monto en menta sobre el casi-negro: la firma "premium" del saldo.
  balanceAmount: { fontSize: 32, fontWeight: "800", color: colors.accent, letterSpacing: -0.5 },
  balanceSub: { fontSize: 12, color: "rgba(255,255,255,0.75)", marginBottom: theme.spacing.md },
  bonoReferidoRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: -6, marginBottom: theme.spacing.md },
  bonoReferidoTexto: { fontSize: 12, color: "rgba(255,255,255,0.85)", fontWeight: "600" },
  autoPayoutBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "rgba(47,191,155,0.14)",
    borderRadius: theme.radius.field,
    borderWidth: 1,
    borderColor: "rgba(47,191,155,0.35)",
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginTop: theme.spacing.sm,
  },
  autoPayoutDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accent },
  autoPayoutTitle: { fontSize: 13, fontWeight: "700", color: "#FFFFFF" },
  autoPayoutSub: { fontSize: 12, color: "rgba(255,255,255,0.8)", marginTop: 1 },
  autoPayoutLink: { fontSize: 13, fontWeight: "700", color: colors.accent },
  missingBankBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "rgba(234,179,8,0.15)",
    borderRadius: theme.radius.field,
    borderWidth: 1,
    borderColor: "rgba(234,179,8,0.4)",
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginTop: theme.spacing.sm,
  },
  missingBankTitle: { fontSize: 13, fontWeight: "700", color: "#FDE047" },
  missingBankSub: { fontSize: 11.5, color: "rgba(255,255,255,0.85)", marginTop: 1 },
  missingBankLink: { fontSize: 13, fontWeight: "700", color: "#FDE047" },
  bankExplain: { fontSize: 12, color: colors.textMuted, lineHeight: 17, marginBottom: 2 },

  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  link: { fontSize: 13, fontWeight: "700", color: colors.accentDark },
  bankName: { fontSize: 15, fontWeight: "700", color: colors.text },
  bankLine: { fontSize: 13, color: colors.textMuted },
  bankLineMuted: { fontSize: 13, color: colors.textMuted, lineHeight: 18 },
  cuentaRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  badgePred: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.accentDark,
    backgroundColor: colors.accent100,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  bars: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", height: 120, paddingTop: 8 },
  barCol: { alignItems: "center", flex: 1, gap: 6 },
  bar: { width: 16, backgroundColor: colors.accent, borderRadius: 4 },
  barDay: { fontSize: 11, color: colors.textMuted, fontWeight: "600" },
  histRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing.md,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  histConcept: { fontSize: 13, fontWeight: "600", color: colors.text },
  histDate: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  histAmount: { fontSize: 14, fontWeight: "800" },
  fleetRow: {
    gap: 6,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  fleetName: { flex: 1, fontSize: 13, fontWeight: "600", color: colors.text },
  fleetEarnings: { fontSize: 14, fontWeight: "800", color: colors.accentDark },
  occupancyTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.surfaceSubtle,
    overflow: "hidden",
  },
  occupancyFill: { height: "100%", borderRadius: 3, backgroundColor: colors.accent },
  fleetMeta: { fontSize: 11, color: colors.textMuted },
});
