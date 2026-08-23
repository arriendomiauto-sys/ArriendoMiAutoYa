import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
} from "react-native";
import { colors } from "../../theme/colors";
import { useApp } from "../../context/AppContext";
import { Icon } from "../components/Icon";

export function NotificationsScreen({ onBack, onSelectNotification }) {
  const {
    notifications,
    markNotificationAsRead,
    clearAllNotifications,
    mode,
  } = useApp();
  const isDriver = mode === "conductor";
  const [filter, setFilter] = useState("todas"); // 'todas' | 'no_leidas' | 'reserva' | 'pago'

  const filtered = notifications.filter((n) => {
    if (filter === "no_leidas") return !n.leido;
    if (filter === "reserva") return n.tipo === "reserva";
    if (filter === "pago") return n.tipo === "pago";
    return true;
  });

  const unreadCount = notifications.filter((n) => !n.leido).length;

  return (
    <View
      style={[
        styles.container,
        isDriver ? styles.bgDriver : styles.bgPassenger,
      ]}
    >
      {/* Botón Volver si aplica */}
      {onBack && (
        <TouchableOpacity style={styles.backBtn} onPress={onBack}>
          <Text
            style={[
              styles.backBtnText,
              isDriver ? styles.textWhite : styles.textDark,
            ]}
          >
            ← Volver
          </Text>
        </TouchableOpacity>
      )}

      {/* Header */}
      <View style={styles.headerRow}>
        <View>
          <Text
            style={[
              styles.title,
              isDriver ? styles.textWhite : styles.textDark,
            ]}
          >
            Notificaciones
          </Text>
          <Text
            style={[
              styles.subtitle,
              isDriver ? styles.textSilver : styles.textSecondary,
            ]}
          >
            {unreadCount > 0
              ? `Tienes ${unreadCount} avisos sin leer`
              : "Estás al día con todos tus avisos"}
          </Text>
        </View>
        {unreadCount > 0 && (
          <TouchableOpacity
            style={styles.markAllBtn}
            onPress={clearAllNotifications}
          >
            <Text style={styles.markAllBtnText}>Marcar leídas</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Filtros */}
      <View style={styles.filtersRow}>
        {[
          { id: "todas", label: "Todas" },
          { id: "no_leidas", label: "Sin leer" },
          { id: "reserva", label: "Reservas" },
          { id: "pago", label: "Pagos" },
        ].map((f) => (
          <TouchableOpacity
            key={f.id}
            style={[
              styles.filterChip,
              filter === f.id &&
                (isDriver
                  ? styles.filterChipActiveDriver
                  : styles.filterChipActivePassenger),
            ]}
            onPress={() => setFilter(f.id)}
          >
            <Text
              style={[
                styles.filterChipText,
                filter === f.id &&
                  (isDriver
                    ? styles.filterChipTextActiveDriver
                    : styles.filterChipTextActivePassenger),
              ]}
            >
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Lista */}
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[
              styles.card,
              isDriver ? styles.cardDriver : styles.cardPassenger,
              !item.leido &&
                (isDriver ? styles.cardUnreadDriver : styles.cardUnreadPassenger),
            ]}
            onPress={() => {
              markNotificationAsRead(item.id);
              if (onSelectNotification) onSelectNotification(item);
            }}
            activeOpacity={0.8}
          >
            <View style={styles.iconCircle}>
              <Icon
                name={item.tipo === "pago" ? "dollar" : item.tipo === "reserva" ? "key" : "bell"}
                size={16}
                color={isDriver ? colors.accent : colors.primary}
              />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <View style={styles.cardHeader}>
                <Text
                  style={[
                    styles.cardTitle,
                    isDriver ? styles.textWhite : styles.textDark,
                  ]}
                >
                  {item.titulo}
                </Text>
                {!item.leido && <View style={styles.unreadDot} />}
              </View>
              <Text
                style={[
                  styles.cardMessage,
                  isDriver ? styles.textSilver : styles.textSecondary,
                ]}
              >
                {item.mensaje}
              </Text>
              <Text style={styles.cardDate}>{item.fecha}</Text>
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <Icon name="bell" size={36} color={colors.textMuted} style={{ marginBottom: 10 }} />
            <Text
              style={[
                styles.emptyTitle,
                isDriver ? styles.textWhite : styles.textDark,
              ]}
            >
              No hay notificaciones
            </Text>
            <Text
              style={[
                styles.emptySub,
                isDriver ? styles.textSilver : styles.textSecondary,
              ]}
            >
              Los recordatorios de entrega, pagos y seguros aparecerán aquí.
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  bgPassenger: {
    backgroundColor: colors.lightBg,
  },
  bgDriver: {
    backgroundColor: colors.darkBg,
  },
  backBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    alignSelf: "flex-start",
    marginBottom: 10,
  },
  backBtnText: {
    fontSize: 12,
    fontWeight: "700",
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: "900",
  },
  subtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  markAllBtn: {
    backgroundColor: colors.primaryMuted,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 6,
  },
  markAllBtnText: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: "800",
  },
  filtersRow: {
    flexDirection: "row",
    marginBottom: 14,
  },
  filterChip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    backgroundColor: colors.lightSurface,
    marginRight: 6,
    borderWidth: 1,
    borderColor: colors.lightCardBorder,
  },
  filterChipActivePassenger: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterChipActiveDriver: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  filterChipText: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.textSecondary,
  },
  filterChipTextActivePassenger: {
    color: colors.textWhite,
  },
  filterChipTextActiveDriver: {
    color: colors.dark,
    fontWeight: "900",
  },
  listContent: {
    paddingBottom: 40,
  },
  card: {
    flexDirection: "row",
    padding: 12,
    borderRadius: 10,
    marginBottom: 10,
    borderWidth: 1,
  },
  cardPassenger: {
    backgroundColor: colors.lightCard,
    borderColor: colors.lightCardBorder,
  },
  cardDriver: {
    backgroundColor: colors.darkCard,
    borderColor: colors.darkBorder,
  },
  cardUnreadPassenger: {
    borderColor: colors.primary,
    backgroundColor: "rgba(15, 34, 61, 0.03)",
  },
  cardUnreadDriver: {
    borderColor: colors.accent,
    backgroundColor: "rgba(168, 230, 55, 0.05)",
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: colors.lightSurface,
    alignItems: "center",
    justifyContent: "center",
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: "800",
    flex: 1,
  },
  unreadDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.accent,
    marginLeft: 6,
  },
  cardMessage: {
    fontSize: 11,
    marginTop: 2,
    lineHeight: 15,
  },
  cardDate: {
    fontSize: 9,
    color: colors.textMuted,
    marginTop: 4,
    fontWeight: "600",
  },
  emptyBox: {
    alignItems: "center",
    paddingVertical: 50,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: "800",
  },
  emptySub: {
    fontSize: 11,
    marginTop: 4,
  },
  textWhite: { color: colors.textWhite },
  textDark: { color: colors.textDark },
  textSilver: { color: colors.textSilver },
  textSecondary: { color: colors.textSecondary },
});
