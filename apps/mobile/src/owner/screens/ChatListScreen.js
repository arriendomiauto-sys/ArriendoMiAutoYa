import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { colors, Icon, ApiClient } from "@rentacar/mobile-shared";

function formatearFecha(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("es-CL", { day: "2-digit", month: "short" });
  } catch {
    return iso;
  }
}

// No hay un endpoint que devuelva "conversaciones": se listan las reservas
// del dueño y desde acá se entra al chat real de cada una.
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
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={false} onRefresh={cargar} tintColor={colors.accent} />}
          renderItem={({ item }) => {
            const auto = item.auto || {};
            const nombreAuto = [auto.marca, auto.modelo].filter(Boolean).join(" ") || "Auto";
            return (
              <TouchableOpacity style={styles.card} onPress={() => onSelectReserva(item)}>
                <View style={styles.avatarPlaceholder}>
                  <Icon name="user" size={18} color={colors.accent} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.carName}>{nombreAuto}</Text>
                  <Text style={styles.dateText}>
                    {formatearFecha(item.fecha_inicio)} – {formatearFecha(item.fecha_fin)} · {item.estado}
                  </Text>
                </View>
                <Icon name="arrow-right" size={16} color={colors.textMuted} />
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Icon name="chat" size={32} color={colors.textMuted} style={{ marginBottom: 10 }} />
              <Text style={styles.emptyTitle}>Sin conversaciones aún</Text>
              <Text style={styles.emptySub}>
                Cuando tengas reservas confirmadas, podrás coordinar aquí con cada arrendatario.
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.darkBg,
    padding: 16,
  },
  header: {
    marginBottom: 14,
  },
  title: {
    fontSize: 20,
    fontWeight: "900",
    color: colors.textWhite,
  },
  subtitle: {
    fontSize: 12,
    color: colors.textSilver,
    marginTop: 2,
  },
  listContent: {
    paddingBottom: 40,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.darkCard,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.darkBorder,
    gap: 12,
  },
  avatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.accentMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  carName: {
    fontSize: 13,
    fontWeight: "800",
    color: colors.textWhite,
  },
  dateText: {
    fontSize: 11,
    color: colors.textSilver,
    marginTop: 2,
  },
  emptyBox: {
    alignItems: "center",
    paddingVertical: 50,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: colors.textWhite,
  },
  emptySub: {
    fontSize: 12,
    color: colors.textSilver,
    marginTop: 4,
    textAlign: "center",
    paddingHorizontal: 20,
  },
});
