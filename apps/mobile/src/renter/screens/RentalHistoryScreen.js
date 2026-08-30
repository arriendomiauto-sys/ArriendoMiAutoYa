import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  ScrollView,
  Image,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { colors, theme, Icon, Badge, EmptyState, ScreenHeader, ApiClient } from "@rentacar/mobile-shared";

function formatearRango(inicio, fin) {
  if (!inicio || !fin) return "—";
  const opts = { day: "numeric", month: "short" };
  return `${new Date(inicio).toLocaleDateString("es-CL", opts)} – ${new Date(fin).toLocaleDateString("es-CL", opts)}`;
}

const BADGE = {
  en_curso: { variant: "info", label: "En curso" },
  confirmada: { variant: "warning", label: "Confirmada" },
  finalizada: { variant: "neutral", label: "Finalizada" },
  cancelada: { variant: "danger", label: "Cancelada" },
};

const TABS = [
  { id: "activas", label: "Activas", estados: ["en_curso"] },
  { id: "proximas", label: "Próximas", estados: ["confirmada"] },
  { id: "pasadas", label: "Pasadas", estados: ["finalizada", "cancelada"] },
];

export function RentalHistoryScreen({ onSelectReservation, onBack }) {
  const [tab, setTab] = useState("activas");
  const [reservas, setReservas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const cargar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setReservas((await ApiClient.getReservas("cliente")) || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const estados = TABS.find((t) => t.id === tab)?.estados || [];
  const filtradas = reservas.filter((r) => estados.includes(r.estado));

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <ScreenHeader title="Mis reservas" onBack={onBack} />

      <View style={styles.tabs}>
        {TABS.map((t) => (
          <TouchableOpacity key={t.id} style={styles.tab} onPress={() => setTab(t.id)} activeOpacity={0.7}>
            <Text style={[styles.tabText, tab === t.id && styles.tabTextOn]}>{t.label}</Text>
            <View style={[styles.tabUnderline, tab === t.id && styles.tabUnderlineOn]} />
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
      ) : error ? (
        <EmptyState icon="warning" title="No se pudo cargar" message={error} action="Reintentar" onAction={cargar} />
      ) : (
        <ScrollView
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={false} onRefresh={cargar} tintColor={colors.primary} />}
        >
          {filtradas.map((r) => {
            const auto = r.auto || {};
            const badge = BADGE[r.estado] || BADGE.confirmada;
            const nombre = [auto.marca, auto.modelo, auto.anio].filter(Boolean).join(" ") || "Auto";
            return (
              <TouchableOpacity
                key={r.id}
                style={styles.card}
                onPress={() => onSelectReservation(r)}
                activeOpacity={0.85}
              >
                <View style={styles.thumb}>
                  {auto.fotos?.[0] ? (
                    <Image source={{ uri: auto.fotos[0] }} style={styles.thumbImg} />
                  ) : (
                    <Icon name="car" size={22} color={colors.primary} />
                  )}
                </View>
                <View style={{ flex: 1, gap: 4 }}>
                  <View style={styles.cardHead}>
                    <Text style={styles.carName} numberOfLines={1}>{nombre}</Text>
                    <Badge variant={badge.variant} label={badge.label} />
                  </View>
                  <Text style={styles.meta}>
                    {formatearRango(r.fecha_inicio, r.fecha_fin)}
                    {r.lugar_entrega_acordado ? ` · ${r.lugar_entrega_acordado}` : ""}
                  </Text>
                  {r.estado === "en_curso" && (
                    <Text style={styles.guarantee}>
                      Garantía retenida · ${(r.monto_hold || 0).toLocaleString("es-CL")}
                    </Text>
                  )}
                </View>
              </TouchableOpacity>
            );
          })}

          {filtradas.length === 0 && (
            <EmptyState
              icon="calendar"
              title="Nada por aquí"
              message={
                tab === "activas"
                  ? "No tienes arriendos en curso ahora mismo."
                  : tab === "proximas"
                  ? "No tienes reservas confirmadas próximas."
                  : "Aún no tienes arriendos finalizados o cancelados."
              }
            />
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  tabs: {
    flexDirection: "row",
    gap: theme.spacing.xxl,
    paddingHorizontal: theme.spacing.screen,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tab: { paddingTop: theme.spacing.sm },
  tabText: { fontSize: 15, color: colors.textMuted, paddingBottom: 10 },
  tabTextOn: { fontWeight: "600", color: colors.text },
  tabUnderline: { height: 2.5, borderRadius: 999, backgroundColor: "transparent" },
  tabUnderlineOn: { backgroundColor: colors.primary },
  list: { padding: theme.spacing.screen, gap: theme.spacing.md },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: theme.radius.card,
    padding: theme.spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.md,
    ...theme.shadow.sm,
  },
  thumb: {
    width: 76,
    height: 60,
    borderRadius: theme.radius.field,
    backgroundColor: colors.primary100,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  thumbImg: { width: "100%", height: "100%" },
  cardHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: theme.spacing.sm },
  carName: { fontSize: 15, fontWeight: "700", color: colors.text, flex: 1 },
  meta: { fontSize: 13, color: colors.textMuted },
  guarantee: { fontSize: 13, fontWeight: "600", color: colors.warningText },
});
