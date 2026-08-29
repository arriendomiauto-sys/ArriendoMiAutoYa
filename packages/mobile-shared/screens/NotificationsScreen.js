import React, { useState } from "react";
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from "react-native";
import { colors } from "../theme/colors";
import { theme } from "../theme/tokens";
import { useApp } from "../context/AppContext";
import { Icon } from "../components/Icon";
import { ScreenHeader, Chip, EmptyState } from "../components/ui";

const FILTROS = [
  { id: "todas", label: "Todas" },
  { id: "no_leidas", label: "Sin leer" },
  { id: "reserva", label: "Reservas" },
  { id: "pago", label: "Pagos" },
];

const ICONO_TIPO = { pago: "wallet", reserva: "key" };

export function NotificationsScreen({ onBack, onSelectNotification, variant = "renter" }) {
  const { notifications, markNotificationAsRead, clearAllNotifications } = useApp();
  const tone = variant === "owner" ? "dark" : "light";
  const dark = tone === "dark";
  const [filter, setFilter] = useState("todas");

  const filtered = notifications.filter((n) => {
    if (filter === "no_leidas") return !n.leido;
    if (filter === "reserva") return n.tipo === "reserva";
    if (filter === "pago") return n.tipo === "pago";
    return true;
  });
  const unread = notifications.filter((n) => !n.leido).length;

  return (
    <View style={[styles.container, { backgroundColor: dark ? colors.darkBg : colors.background }]}>
      <ScreenHeader
        tone={tone}
        title="Notificaciones"
        subtitle={unread > 0 ? `${unread} sin leer` : "Estás al día"}
        onBack={onBack}
        right={
          unread > 0 ? (
            <TouchableOpacity onPress={clearAllNotifications} style={[styles.markAll, dark && styles.markAllDark]}>
              <Text style={[styles.markAllText, { color: dark ? colors.accent : colors.primary }]}>
                Marcar leídas
              </Text>
            </TouchableOpacity>
          ) : null
        }
      />

      <View style={styles.filters}>
        {FILTROS.map((f) => (
          <Chip key={f.id} tone={tone} label={f.label} selected={filter === f.id} onPress={() => setFilter(f.id)} />
        ))}
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[
              styles.card,
              { backgroundColor: dark ? colors.darkCard : colors.surface, borderColor: dark ? colors.darkBorder : colors.border },
              !item.leido && { borderColor: dark ? colors.accent : colors.primary },
            ]}
            onPress={() => {
              markNotificationAsRead(item.id);
              onSelectNotification?.(item);
            }}
            activeOpacity={0.8}
          >
            <View style={[styles.icon, { backgroundColor: dark ? colors.darkCardSubtle : colors.primary100 }]}>
              <Icon name={ICONO_TIPO[item.tipo] || "bell"} size={17} color={dark ? colors.accent : colors.primary} />
            </View>
            <View style={{ flex: 1, gap: 3 }}>
              <View style={styles.cardHead}>
                <Text style={[styles.cardTitle, { color: dark ? colors.textWhite : colors.text }]} numberOfLines={1}>
                  {item.titulo}
                </Text>
                {!item.leido ? <View style={styles.dot} /> : null}
              </View>
              <Text style={[styles.cardMsg, { color: dark ? colors.textSilver : colors.textMuted }]}>
                {item.mensaje}
              </Text>
              <Text style={styles.cardDate}>{item.fecha}</Text>
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <EmptyState
            tone={tone}
            icon="bell"
            title="No hay notificaciones"
            message="Los recordatorios de entrega, pagos y seguros aparecerán aquí."
          />
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  markAll: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: theme.radius.sm, backgroundColor: colors.primary100 },
  markAllDark: { backgroundColor: colors.darkCard },
  markAllText: { fontSize: 12, fontWeight: "700" },
  filters: {
    flexDirection: "row",
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.screen,
    paddingBottom: theme.spacing.md,
  },
  list: { paddingHorizontal: theme.spacing.screen, paddingBottom: theme.spacing.xxxl, gap: theme.spacing.sm },
  card: {
    flexDirection: "row",
    gap: theme.spacing.md,
    padding: theme.spacing.md,
    borderRadius: theme.radius.card,
    borderWidth: 1,
  },
  icon: { width: 38, height: 38, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  cardHead: { flexDirection: "row", alignItems: "center", gap: 6 },
  cardTitle: { fontSize: 14, fontWeight: "700", flex: 1 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.accent },
  cardMsg: { fontSize: 13, lineHeight: 18 },
  cardDate: { fontSize: 11, color: colors.textMuted, fontWeight: "500", marginTop: 2 },
});
