import React, { useState, useEffect, useCallback } from "react";
import { View, Text, StyleSheet, FlatList, ActivityIndicator, RefreshControl } from "react-native";
import {
  colors,
  theme,
  Icon,
  Chip,
  Badge,
  Button,
  EmptyState,
  ApiClient,
} from "@rentacar/mobile-shared";

function formatearFecha(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("es-CL", { day: "2-digit", month: "short" });
  } catch {
    return iso;
  }
}

const ESTADO_BADGE = {
  confirmada: { variant: "info", label: "Por entregar" },
  en_curso: { variant: "success", label: "En curso" },
  finalizada: { variant: "neutral", label: "Finalizada" },
  cancelada: { variant: "danger", label: "Cancelada" },
  pendiente: { variant: "warning", label: "Pendiente" },
};

// El backend confirma la reserva de inmediato al crearla — esta pantalla
// lista las reservas reales de los autos del dueño y da entrada al flujo de
// entrega/devolución con QR.
export function DriverBookingsScreen({ onOpenDelivery, onOpenContract }) {
  const [reservas, setReservas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState("confirmada");

  const cargar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setReservas((await ApiClient.getReservas("dueno")) || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const filtered = reservas.filter((r) => (filter === "todas" ? true : r.estado === filter));

  const renderItem = ({ item }) => {
    const auto = item.auto || {};
    const nombre = [auto.marca, auto.modelo, auto.anio].filter(Boolean).join(" ") || "Auto";
    const ganancia = Math.round((item.monto_hold || 0) * 0.8);
    const badge = ESTADO_BADGE[item.estado] || ESTADO_BADGE.pendiente;
    const puedeEntregar = item.estado === "confirmada";
    const puedeDevolver = item.estado === "en_curso";

    return (
      <View style={styles.card}>
        <View style={styles.cardHead}>
          <Text style={styles.carName}>{nombre}</Text>
          <Badge variant={badge.variant} label={badge.label} />
        </View>

        <View style={styles.detail}>
          <View style={styles.row}>
            <Text style={styles.label}>Fechas</Text>
            <Text style={styles.value}>
              {formatearFecha(item.fecha_inicio)} → {formatearFecha(item.fecha_fin)}
            </Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Lugar de entrega</Text>
            <Text style={styles.value} numberOfLines={1}>{item.lugar_entrega_acordado || "—"}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.row}>
            <Text style={[styles.label, { color: colors.textWhite, fontWeight: "700" }]}>
              Tu ganancia (80%)
            </Text>
            <Text style={styles.earnings}>${ganancia.toLocaleString("es-CL")}</Text>
          </View>
        </View>

        {(puedeEntregar || puedeDevolver) && (
          <Button
            tone="dark"
            label={puedeEntregar ? "Iniciar entrega con QR" : "Iniciar devolución con QR"}
            iconRight="arrow-right"
            onPress={() => onOpenDelivery?.(item)}
          />
        )}
        <Button
          tone="dark"
          variant="ghost"
          size="sm"
          label="Ver contrato de esta reserva"
          onPress={() => onOpenContract?.(item)}
        />
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Reservas de mis autos</Text>
        <Text style={styles.subtitle}>Entrega y devolución verificadas por QR</Text>
      </View>

      <View style={styles.filters}>
        {[
          { id: "confirmada", label: "Por entregar" },
          { id: "en_curso", label: "Por devolver" },
          { id: "todas", label: "Todas" },
        ].map((f) => (
          <Chip key={f.id} tone="dark" label={f.label} selected={filter === f.id} onPress={() => setFilter(f.id)} />
        ))}
      </View>

      {error && (
        <View style={styles.errorBox}>
          <Icon name="warning" size={15} color={colors.danger} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {loading ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={false} onRefresh={cargar} tintColor={colors.accent} />}
          renderItem={renderItem}
          ListEmptyComponent={
            <EmptyState
              tone="dark"
              icon="calendar"
              title={filter === "todas" ? "Sin reservas todavía" : "Nada en este estado"}
              message="Cuando alguien reserve tus autos, las reservas aparecerán aquí para coordinar la entrega."
            />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.darkBg },
  header: { paddingHorizontal: theme.spacing.screen, paddingTop: theme.spacing.sm, paddingBottom: theme.spacing.md },
  title: { ...theme.typography.title, color: colors.textWhite },
  subtitle: { fontSize: 13, color: colors.textSilver, marginTop: 2 },
  filters: {
    flexDirection: "row",
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.screen,
    paddingBottom: theme.spacing.md,
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: theme.spacing.screen,
    backgroundColor: "rgba(220,38,38,0.12)",
    borderRadius: theme.radius.field,
    padding: theme.spacing.md,
  },
  errorText: { color: colors.danger, fontSize: 13, flex: 1 },
  list: { paddingHorizontal: theme.spacing.screen, paddingBottom: theme.spacing.xxxl, gap: theme.spacing.lg },
  card: {
    backgroundColor: colors.darkCard,
    borderRadius: theme.radius.card,
    padding: theme.spacing.lg,
    borderWidth: 1,
    borderColor: colors.darkBorder,
    gap: theme.spacing.md,
  },
  cardHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: theme.spacing.sm },
  carName: { fontSize: 16, fontWeight: "700", color: colors.textWhite, flex: 1 },
  detail: { backgroundColor: colors.darkCardSubtle, borderRadius: theme.radius.field, padding: theme.spacing.md, gap: theme.spacing.sm },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: theme.spacing.md },
  label: { fontSize: 13, color: colors.textSilver },
  value: { fontSize: 13, fontWeight: "600", color: colors.textWhite, flexShrink: 1, textAlign: "right" },
  divider: { height: 1, backgroundColor: colors.darkBorder, marginVertical: 2 },
  earnings: { fontSize: 15, fontWeight: "800", color: colors.accent },
});
