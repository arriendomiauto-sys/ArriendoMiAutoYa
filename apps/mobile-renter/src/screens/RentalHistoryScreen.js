import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { colors, Icon, ApiClient } from "@rentacar/mobile-shared";

function formatearRangoFechas(inicio, fin) {
  if (!inicio || !fin) return "—";
  const opts = { day: "numeric", month: "short" };
  return `${new Date(inicio).toLocaleDateString("es-CL", opts)} – ${new Date(fin).toLocaleDateString("es-CL", opts)}`;
}

const BADGE_POR_ESTADO = {
  en_curso: { label: "En curso", bg: colors.primary100, color: colors.primary },
  confirmada: { label: "Confirmada", bg: "#FFF8EC", color: "#8A5B0B" },
  finalizada: { label: "Finalizada", bg: "#F3F4F6", color: "#4B5563" },
  cancelada: { label: "Cancelada", bg: colors.dangerBg, color: colors.dangerText },
};

export function RentalHistoryScreen({ onSelectReservation, onBack }) {
  const [activeTab, setActiveTab] = useState("activas"); // 'activas' | 'proximas' | 'pasadas'
  const [reservas, setReservas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const cargar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await ApiClient.getReservas("cliente");
      setReservas(data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const filtradas = reservas.filter((r) => {
    if (activeTab === "activas") return r.estado === "en_curso";
    if (activeTab === "proximas") return r.estado === "confirmada";
    return r.estado === "finalizada" || r.estado === "cancelada";
  });

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />

      <View style={styles.titleArea}>
        {onBack && (
          <TouchableOpacity onPress={onBack} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Icon name="arrow-left" size={20} color={colors.primary} />
          </TouchableOpacity>
        )}
        <Text style={styles.screenTitle}>Mis reservas</Text>
      </View>

      <View style={styles.tabsRow}>
        {[
          { id: "activas", label: "Activas" },
          { id: "proximas", label: "Próximas" },
          { id: "pasadas", label: "Pasadas" },
        ].map((t) => (
          <TouchableOpacity
            key={t.id}
            style={[styles.tabBtn, activeTab === t.id && styles.tabBtnActive]}
            onPress={() => setActiveTab(t.id)}
          >
            <Text style={[styles.tabText, activeTab === t.id && styles.tabTextActive]}>
              {t.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
      ) : error ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyTitle}>No se pudo cargar</Text>
          <Text style={styles.emptySub}>{error}</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
          {filtradas.map((r) => {
            const auto = r.auto || {};
            const badge = BADGE_POR_ESTADO[r.estado] || BADGE_POR_ESTADO.confirmada;
            const nombreAuto = [auto.marca, auto.modelo, auto.anio].filter(Boolean).join(" ") || "Auto";

            return (
              <TouchableOpacity
                key={r.id}
                style={styles.rentalCardSimple}
                onPress={() => onSelectReservation(r)}
                activeOpacity={0.8}
              >
                <View style={styles.thumbBox}>
                  {auto.fotos?.[0] && (
                    <Icon name="car" size={22} color={colors.primary} />
                  )}
                </View>
                <View style={{ flex: 1, gap: 4 }}>
                  <View style={styles.cardHeaderRow}>
                    <Text style={styles.carName}>{nombreAuto}</Text>
                    <View style={[styles.statusBadge, { backgroundColor: badge.bg }]}>
                      <Text style={[styles.statusBadgeText, { color: badge.color }]}>
                        {badge.label}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.carSub}>
                    {formatearRangoFechas(r.fecha_inicio, r.fecha_fin)}
                    {r.lugar_entrega_acordado ? ` · ${r.lugar_entrega_acordado}` : ""}
                  </Text>
                  {r.estado === "en_curso" && (
                    <Text style={styles.guaranteeText}>
                      Garantía retenida · ${(r.monto_hold || 0).toLocaleString("es-CL")}
                    </Text>
                  )}
                </View>
              </TouchableOpacity>
            );
          })}

          {filtradas.length === 0 && (
            <View style={styles.emptyBox}>
              <Icon name="calendar" size={32} color={colors.textMuted} style={{ marginBottom: 10 }} />
              <Text style={styles.emptyTitle}>Nada por aquí</Text>
              <Text style={styles.emptySub}>
                {activeTab === "activas"
                  ? "No tienes arriendos en curso ahora mismo."
                  : activeTab === "proximas"
                  ? "No tienes reservas confirmadas próximas."
                  : "Aún no tienes arriendos finalizados o cancelados."}
              </Text>
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  titleArea: {
    paddingHorizontal: 20,
    paddingTop: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  screenTitle: {
    fontSize: 26,
    fontWeight: "600",
    letterSpacing: -0.4,
    color: colors.text,
  },
  tabsRow: {
    flexDirection: "row",
    gap: 24,
    paddingHorizontal: 20,
    paddingTop: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tabBtn: {
    paddingBottom: 10,
  },
  tabBtnActive: {
    borderBottomWidth: 2.5,
    borderBottomColor: colors.primary,
  },
  tabText: {
    fontSize: 15,
    color: colors.textMuted,
  },
  tabTextActive: {
    fontWeight: "600",
    color: colors.text,
  },
  listContent: {
    padding: 20,
    gap: 14,
  },
  thumbBox: {
    width: 76,
    height: 58,
    borderRadius: 10,
    backgroundColor: colors.primary100,
    alignItems: "center",
    justifyContent: "center",
  },
  cardHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  carName: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.text,
  },
  carSub: {
    fontSize: 13,
    color: colors.textMuted,
  },
  statusBadge: {
    paddingVertical: 4,
    paddingHorizontal: 9,
    borderRadius: 999,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: "600",
  },
  guaranteeText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#8A5B0B",
  },
  rentalCardSimple: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  emptyBox: {
    alignItems: "center",
    paddingVertical: 50,
    paddingHorizontal: 30,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.text,
  },
  emptySub: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 4,
    textAlign: "center",
  },
});
