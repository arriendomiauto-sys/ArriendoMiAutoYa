import React, { useState, useEffect, useCallback } from "react";
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, theme, Icon, Badge, EmptyState, ScreenHeader, ApiClient } from "@rentacar/mobile-shared";
import { oc } from "../comun";

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
export function ChatListScreen({ onSelectReserva, onBack }) {
  const insets = useSafeAreaInsets();
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
    <View style={[oc.screen, { paddingTop: Math.max(insets.top, 12) }]}>
      <ScreenHeader
        title="Mensajes"
        subtitle="Coordina la entrega con cada arrendatario"
        onBack={onBack}
      />

      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={reservas}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[styles.list, { paddingBottom: Math.max(insets.bottom, 16) + 24 }]}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={false} onRefresh={cargar} tintColor={colors.primary} />}
          renderItem={({ item }) => {
            const auto = item.auto || {};
            const nombre = [auto.marca, auto.modelo].filter(Boolean).join(" ") || "Auto";
            const badge = ESTADO_BADGE[item.estado];
            return (
              <TouchableOpacity style={styles.card} onPress={() => onSelectReserva(item)} activeOpacity={0.8}>
                <View style={styles.avatar}>
                  <Icon name="user" size={18} color={colors.primary} />
                </View>
                <View style={{ flex: 1, gap: 3 }}>
                  <View style={styles.cardHead}>
                    <Text style={styles.carName} numberOfLines={1}>
                      {nombre}
                    </Text>
                    {badge ? <Badge variant={badge.variant} label={badge.label} /> : null}
                  </View>
                  <Text style={styles.date}>
                    {formatearFecha(item.fecha_inicio)} – {formatearFecha(item.fecha_fin)}
                  </Text>
                </View>
                <Icon name="chevron-right" size={16} color={colors.textMuted} />
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={
            <EmptyState
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
  list: { paddingHorizontal: theme.spacing.screen, gap: theme.spacing.sm },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.md,
    backgroundColor: colors.surface,
    borderRadius: theme.radius.card,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...theme.shadow.sm,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.primary100,
    alignItems: "center",
    justifyContent: "center",
  },
  cardHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: theme.spacing.sm },
  carName: { fontSize: 15, fontWeight: "700", color: colors.text, flex: 1 },
  date: { fontSize: 13, color: colors.textMuted },
});
