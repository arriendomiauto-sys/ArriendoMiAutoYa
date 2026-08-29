import React, { useState, useEffect, useCallback } from "react";
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl } from "react-native";
import { colors, theme, Icon, Badge, EmptyState, ApiClient } from "@rentacar/mobile-shared";

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
};

// No hay un endpoint de "conversaciones": se listan las reservas del dueño y
// desde acá se entra al chat real de cada una.
export function ChatListScreen({ onSelectReserva }) {
  const [reservas, setReservas] = useState([]);
  const [loading, setLoading] = useState(true);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const data = await ApiClient.getReservas("dueno");
      setReservas((data || []).filter((r) => r.estado !== "cancelada"));
    } catch {
      setReservas([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Mensajes</Text>
        <Text style={styles.subtitle}>Coordina la entrega con cada arrendatario</Text>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={reservas}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={false} onRefresh={cargar} tintColor={colors.accent} />}
          renderItem={({ item }) => {
            const auto = item.auto || {};
            const nombre = [auto.marca, auto.modelo].filter(Boolean).join(" ") || "Auto";
            const badge = ESTADO_BADGE[item.estado];
            return (
              <TouchableOpacity style={styles.card} onPress={() => onSelectReserva(item)} activeOpacity={0.8}>
                <View style={styles.avatar}>
                  <Icon name="user" size={18} color={colors.accent} />
                </View>
                <View style={{ flex: 1, gap: 3 }}>
                  <View style={styles.cardHead}>
                    <Text style={styles.carName} numberOfLines={1}>{nombre}</Text>
                    {badge ? <Badge variant={badge.variant} label={badge.label} /> : null}
                  </View>
                  <Text style={styles.date}>
                    {formatearFecha(item.fecha_inicio)} – {formatearFecha(item.fecha_fin)}
                  </Text>
                </View>
                <Icon name="chevron-right" size={16} color={colors.textSilver} />
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={
            <EmptyState
              tone="dark"
              icon="chat"
              title="Sin conversaciones aún"
              message="Cuando tengas reservas confirmadas, podrás coordinar aquí con cada arrendatario."
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
  list: { paddingHorizontal: theme.spacing.screen, paddingBottom: theme.spacing.xxxl, gap: theme.spacing.sm },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.md,
    backgroundColor: colors.darkCard,
    borderRadius: theme.radius.card,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: colors.darkBorder,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "rgba(47,191,155,0.14)",
    alignItems: "center",
    justifyContent: "center",
  },
  cardHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: theme.spacing.sm },
  carName: { fontSize: 15, fontWeight: "700", color: colors.textWhite, flex: 1 },
  date: { fontSize: 13, color: colors.textSilver },
});
