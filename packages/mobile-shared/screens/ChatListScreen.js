import React, { useState, useEffect, useCallback, useMemo } from "react";
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "../theme/colors";
import { Icon } from "../components/Icon";
import { Badge, EmptyState, ScreenHeader } from "../components/ui";
import { ApiClient } from "../api/client";
import { useConversaciones } from "../hooks/useConversaciones";

const ESTADO_BADGE = {
  confirmada: { variant: "info", label: "Por entregar" },
  en_curso: { variant: "success", label: "En curso" },
  finalizada: { variant: "neutral", label: "Finalizada" },
};

// Tiempo relativo corto para la última línea: "ahora", "5 min", "3 h", "ayer",
// "12 sep".
function tiempoRelativo(iso) {
  if (!iso) return "";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "";
  const diff = Date.now() - t;
  const min = Math.round(diff / 60000);
  if (min < 1) return "ahora";
  if (min < 60) return `${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} h`;
  const d = Math.round(h / 24);
  if (d === 1) return "ayer";
  if (d < 7) return `${d} d`;
  const fecha = new Date(iso);
  return fecha.toLocaleDateString("es-CL", { day: "numeric", month: "short" });
}

/**
 * Lista de conversaciones activas asociadas a las reservas del usuario.
 * Tanto dueño como arrendatario ven una fila por reserva confirmada o activa.
 */
export function ChatListScreen({ rol = "renter", onSelectReserva, onBack }) {
  const insets = useSafeAreaInsets();
  const [reservas, setReservas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refrescando, setRefrescando] = useState(false);

  // Hook que mantiene en memoria el último mensaje y el conteo de no-leídos
  // por reserva, y se entera vía Socket.IO en tiempo real.
  const { conversaciones, refrescar: refrescarResumen } = useConversaciones();

  const rolBackend = rol === "owner" ? "dueno" : "cliente";

  const cargarReservas = useCallback(async () => {
    try {
      let data = [];
      if (typeof ApiClient.getReservas === "function") {
        data = await ApiClient.getReservas(rolBackend);
      } else {
        // Las reservas activas y confirmadas son las que tienen chat habilitado.
        const endpoint = rol === "owner" ? "/reservas/owner" : "/reservas/mis-reservas";
        const res = await ApiClient.get(endpoint);
        if (res.ok && Array.isArray(res.data)) {
          data = res.data;
        }
      }
      setReservas((data || []).filter((r) => r.estado !== "cancelada"));
    } catch {
      // El usuario puede refrescar tirando de la lista si falla.
      setReservas([]);
    } finally {
      setLoading(false);
      setRefrescando(false);
    }
  }, [rol, rolBackend]);

  useEffect(() => {
    cargarReservas();
  }, [cargarReservas]);

  // Cruzamos las reservas con el resumen del chat. Ordenamos:
  // 1) las que tienen mensaje más reciente primero
  // 2) el resto por fecha de inicio de reserva
  const items = useMemo(() => {
    const porReserva = Array.isArray(conversaciones)
      ? Object.fromEntries(conversaciones.map((r) => [r.reserva_id, r]))
      : (conversaciones || {});

    const lista = reservas.map((r) => ({
      ...r,
      _resumen: porReserva[r.id] || null,
    }));
    lista.sort((a, b) => {
      const ta = a._resumen?.ultimo_timestamp;
      const tb = b._resumen?.ultimo_timestamp;
      if (ta && tb) return new Date(tb) - new Date(ta);
      if (ta) return -1;
      if (tb) return 1;
      return new Date(a.fecha_inicio || 0) - new Date(b.fecha_inicio || 0);
    });
    return lista;
  }, [reservas, conversaciones]);

  const onRefresh = useCallback(() => {
    setRefrescando(true);
    cargarReservas();
    refrescarResumen();
  }, [cargarReservas, refrescarResumen]);

  const renderItem = ({ item }) => {
    const auto = item.auto || {};
    const nombre = [auto.marca, auto.modelo].filter(Boolean).join(" ") || "Auto";
    const badge = ESTADO_BADGE[item.estado];
    const r = item._resumen;
    const noLeidos = r?.no_leidos || 0;
    // Id de la CONTRAPARTE (no el propio): si el último mensaje es suyo, no
    // se antepone "Tú:"; si no, el mensaje lo escribió el usuario actual.
    const idContraparte = rol === "owner" ? item.cliente_id : item.auto?.dueno_id;
    const preview = r?.ultimo_mensaje
      ? `${r.ultimo_autor_id === idContraparte ? "" : "Tú: "}${r.ultimo_mensaje}`
      : "Sin mensajes aún · toca para coordinar";

    return (
      <TouchableOpacity
        className="flex-row items-center gap-3 bg-surface rounded-2xl p-3.5 border border-border shadow-sm active:opacity-80"
        onPress={() => onSelectReserva(item)}
        activeOpacity={0.8}
      >
        <View className="w-[42px] h-[42px] rounded-full bg-primary-100 items-center justify-center">
          <Icon name="user" size={18} color={colors.primary} />
          {noLeidos > 0 ? (
            <View className="absolute -top-[3px] -right-[3px] min-w-[18px] h-[18px] rounded-full px-1 bg-danger border-2 border-background items-center justify-center">
              <Text className="text-[10px] font-bold text-white" allowFontScaling={false}>
                {noLeidos > 9 ? "9+" : noLeidos}
              </Text>
            </View>
          ) : null}
        </View>
        <View className="flex-1 gap-1">
          <View className="flex-row items-center justify-between gap-2">
            <Text className="text-[15px] font-bold text-textDark flex-1" numberOfLines={1}>
              {nombre}
            </Text>
            {r?.ultimo_timestamp ? (
              <Text className="text-xs text-textMuted">{tiempoRelativo(r.ultimo_timestamp)}</Text>
            ) : badge ? (
              <Badge variant={badge.variant} label={badge.label} />
            ) : null}
          </View>
          <Text
            className={`text-[13px] ${noLeidos > 0 ? "text-textDark font-semibold" : "text-textMuted"}`}
            numberOfLines={1}
          >
            {preview}
          </Text>
        </View>
        <Icon name="chevron-right" size={16} color={colors.textMuted} />
      </TouchableOpacity>
    );
  };

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: Math.max(insets.top, 12) }}>
      <ScreenHeader
        title="Mensajes"
        subtitle={
          rol === "owner"
            ? "Coordina la entrega con cada arrendatario"
            : "Coordina tus arriendos con cada dueño"
        }
        onBack={onBack}
      />

      {loading ? (
        <ActivityIndicator color={colors.primary} className="mt-10" />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: 16, gap: 8, paddingBottom: Math.max(insets.bottom, 16) + 24 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refrescando} onRefresh={onRefresh} tintColor={colors.primary} />
          }
          renderItem={renderItem}
          initialNumToRender={10}
          maxToRenderPerBatch={10}
          windowSize={5}
          removeClippedSubviews={Platform.OS === "android"}
          ListEmptyComponent={
            <EmptyState
              icon="chat"
              title="Sin conversaciones aún"
              message={
                rol === "owner"
                  ? "Cuando tengas reservas confirmadas, podrás coordinar aquí con cada arrendatario."
                  : "Cuando tengas un arriendo activo o confirmado, podrás coordinar aquí con el dueño."
              }
            />
          }
        />
      )}
    </View>
  );
}
