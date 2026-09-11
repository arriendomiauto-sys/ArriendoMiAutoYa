import React, { useState, useEffect, useCallback, useMemo } from "react";
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "../theme/colors";
import { theme } from "../theme/tokens";
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
  return new Date(iso).toLocaleDateString("es-CL", { day: "2-digit", month: "short" });
}

/**
 * Lista de conversaciones por reserva. La usan tanto el dueño como el
 * arrendatario — `rol` decide de quién son las reservas que se piden y el
 * texto vacío.
 *
 * No hay un endpoint único de "conversaciones": se cruza el resumen de
 * mensajes (`/reservas/mensajes/resumen` — última línea + no leídos) con las
 * reservas del usuario, para pintar la lista con vista previa sin abrir cada
 * chat.
 */
export function ChatListScreen({ rol = "owner", onSelectReserva, onBack }) {
  const insets = useSafeAreaInsets();
  // El resumen (última línea + no leídos) viene del hook, que se mantiene al
  // día con el poll de notificaciones — así la lista se refresca sola si llega
  // un mensaje mientras está abierta.
  const { conversaciones, refrescar: refrescarResumen } = useConversaciones();
  const [reservas, setReservas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refrescando, setRefrescando] = useState(false);

  const rolBackend = rol === "owner" ? "dueno" : "cliente";

  const cargarReservas = useCallback(async () => {
    try {
      const data = await ApiClient.getReservas(rolBackend);
      setReservas((data || []).filter((r) => r.estado !== "cancelada"));
    } catch {
      setReservas([]);
    } finally {
      setLoading(false);
      setRefrescando(false);
    }
  }, [rolBackend]);

  useEffect(() => {
    cargarReservas();
  }, [cargarReservas]);

  const items = useMemo(() => {
    const porReserva = Object.fromEntries((conversaciones || []).map((r) => [r.reserva_id, r]));
    const lista = reservas.map((r) => ({ ...r, _resumen: porReserva[r.id] || null }));
    // Con mensajes primero, por el más reciente; el resto por fecha de inicio.
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
      <TouchableOpacity style={styles.card} onPress={() => onSelectReserva(item)} activeOpacity={0.8}>
        <View style={styles.avatar}>
          <Icon name="user" size={18} color={colors.primary} />
          {noLeidos > 0 ? (
            <View style={styles.dot}>
              <Text style={styles.dotText} allowFontScaling={false}>
                {noLeidos > 9 ? "9+" : noLeidos}
              </Text>
            </View>
          ) : null}
        </View>
        <View style={{ flex: 1, gap: 3 }}>
          <View style={styles.cardHead}>
            <Text style={styles.carName} numberOfLines={1}>
              {nombre}
            </Text>
            {r?.ultimo_timestamp ? (
              <Text style={styles.time}>{tiempoRelativo(r.ultimo_timestamp)}</Text>
            ) : badge ? (
              <Badge variant={badge.variant} label={badge.label} />
            ) : null}
          </View>
          <Text
            style={[styles.preview, noLeidos > 0 && styles.previewFuerte]}
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
    <View style={[styles.screen, { paddingTop: Math.max(insets.top, 12) }]}>
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
        <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[styles.listContent, { paddingBottom: Math.max(insets.bottom, 16) + 24 }]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refrescando} onRefresh={onRefresh} tintColor={colors.primary} />
          }
          renderItem={renderItem}
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

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  listContent: { paddingHorizontal: theme.spacing.screen, gap: theme.spacing.sm },
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
  dot: {
    position: "absolute",
    top: -3,
    right: -3,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: colors.danger,
    borderWidth: 2,
    borderColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
  },
  dotText: { fontSize: 10, fontWeight: "700", color: "#FFFFFF" },
  cardHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: theme.spacing.sm },
  carName: { fontSize: 15, fontWeight: "700", color: colors.text, flex: 1 },
  time: { fontSize: 12, color: colors.textMuted },
  preview: { fontSize: 13, color: colors.textMuted },
  previewFuerte: { color: colors.text, fontWeight: "600" },
});
