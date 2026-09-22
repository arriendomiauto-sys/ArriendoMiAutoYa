import React, { useState } from "react";
import { View, Text, FlatList, TouchableOpacity, RefreshControl } from "react-native";
import { colors } from "../theme/colors";
import { useApp } from "../context/AppContext";
import { Icon } from "../components/Icon";
import { ScreenHeader, Chip, EmptyState } from "../components/ui";

const FILTROS = [
  { id: "todas", label: "Todas" },
  { id: "no_leidas", label: "Sin leer" },
  { id: "reserva", label: "Reservas" },
  { id: "entrega", label: "Entregas" },
];

const ICONO_TIPO = { pago: "wallet", reserva: "key", mensaje: "chat", entrega: "car", kyc: "document", soporte: "shield", gps: "pin" };

function tiempoRelativo(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const seg = Math.floor((Date.now() - d.getTime()) / 1000);
  if (seg < 60) return "Ahora";
  if (seg < 3600) return `Hace ${Math.floor(seg / 60)} min`;
  if (seg < 86400) return `Hace ${Math.floor(seg / 3600)} h`;
  if (seg < 604800) return `Hace ${Math.floor(seg / 86400)} d`;
  try {
    return d.toLocaleDateString("es-CL", { day: "2-digit", month: "short" });
  } catch {
    return "";
  }
}

export function NotificationsScreen({ onBack, onSelectNotification, variant = "renter" }) {
  const { notifications, cargarNotificaciones, markNotificationAsRead, clearAllNotifications } = useApp();
  const tone = "light";
  const [filter, setFilter] = useState("todas");
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await cargarNotificaciones?.();
    } finally {
      setRefreshing(false);
    }
  };

  const filtered = notifications.filter((n) => {
    if (filter === "no_leidas") return !n.leido;
    if (filter === "reserva") return n.tipo === "reserva" || n.tipo === "pago";
    if (filter === "entrega") return n.tipo === "entrega";
    return true;
  });
  const unread = notifications.filter((n) => !n.leido).length;

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader
        tone={tone}
        title="Notificaciones"
        subtitle={unread > 0 ? `${unread} sin leer` : "Estás al día"}
        onBack={onBack}
        right={
          unread > 0 ? (
            <TouchableOpacity onPress={clearAllNotifications} className="py-1.5 px-2.5 rounded-lg bg-primary-100">
              <Text className="text-xs font-bold text-primary">
                Marcar leídas
              </Text>
            </TouchableOpacity>
          ) : null
        }
      />

      <View className="flex-row gap-2 px-4 pb-3">
        {FILTROS.map((f) => (
          <Chip key={f.id} tone={tone} label={f.label} selected={filter === f.id} onPress={() => setFilter(f.id)} />
        ))}
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40, gap: 8 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            className={`flex-row gap-3 p-3.5 rounded-2xl border bg-surface ${item.leido ? "border-border" : "border-primary"}`}
            onPress={() => {
              markNotificationAsRead(item.id);
              onSelectNotification?.(item);
            }}
            activeOpacity={0.8}
          >
            <View className="w-[38px] h-[38px] rounded-xl items-center justify-center bg-primary-100">
              <Icon name={ICONO_TIPO[item.tipo] || "bell"} size={17} color={colors.primary} />
            </View>
            <View className="flex-1 gap-1">
              <View className="flex-row items-center gap-1.5">
                <Text className="text-sm font-bold flex-1 text-textDark" numberOfLines={1}>
                  {item.titulo}
                </Text>
                {!item.leido ? <View className="w-2 h-2 rounded-full bg-accent" /> : null}
              </View>
              <Text className="text-[13px] leading-[18px] text-textMuted">
                {item.mensaje}
              </Text>
              <Text className="text-[11px] text-textMuted font-medium mt-0.5">{tiempoRelativo(item.creado_en)}</Text>
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
