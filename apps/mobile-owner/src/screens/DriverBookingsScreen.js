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

// El backend confirma la reserva de inmediato al crearla (no hay un paso
// de "aceptar/rechazar" separado hoy) — esta pantalla muestra las reservas
// reales de los autos del dueño y desde acá se entra al flujo de
// entrega/devolución con QR para la reserva correspondiente.
export function DriverBookingsScreen({ onOpenDelivery }) {
  const [reservas, setReservas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState("confirmada"); // 'confirmada' | 'en_curso' | 'todas'

  const cargar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await ApiClient.getReservas("dueno");
      setReservas(data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const filtered = reservas.filter((r) => {
    if (filter === "todas") return true;
    return r.estado === filter;
  });

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Reservas de mis autos</Text>
        <Text style={styles.subtitle}>Entrega y devolución con verificación por QR</Text>
      </View>

      {/* Filtros */}
      <View style={styles.filtersRow}>
        {[
          { id: "confirmada", label: "Por entregar" },
          { id: "en_curso", label: "Por devolver" },
          { id: "todas", label: "Todas" },
        ].map((f) => (
          <TouchableOpacity
            key={f.id}
            style={[styles.filterChip, filter === f.id && styles.filterChipActive]}
            onPress={() => setFilter(f.id)}
          >
            <Text style={[styles.filterChipText, filter === f.id && styles.filterChipTextActive]}>
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {loading ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={false} onRefresh={cargar} tintColor={colors.accent} />}
          renderItem={({ item }) => {
            const auto = item.auto || {};
            const nombreAuto = [auto.marca, auto.modelo, auto.anio].filter(Boolean).join(" ");
            const gananciaEstimada = Math.round((item.monto_hold || 0) * 0.8);
            const listoParaEntrega = item.estado === "confirmada";
            const listoParaDevolucion = item.estado === "en_curso";

            return (
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.carName}>{nombreAuto || "Auto"}</Text>
                  <View
                    style={[
                      styles.statusBadge,
                      listoParaEntrega ? styles.statusPending : styles.statusAccepted,
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusText,
                        listoParaEntrega ? styles.statusTextPending : styles.statusTextAccepted,
                      ]}
                    >
                      {item.estado}
                    </Text>
                  </View>
                </View>

                <View style={styles.detailsBox}>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Fechas:</Text>
                    <Text style={styles.detailVal}>
                      {formatearFecha(item.fecha_inicio)} → {formatearFecha(item.fecha_fin)}
                    </Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Lugar de entrega:</Text>
                    <Text style={styles.detailVal}>{item.lugar_entrega_acordado || "—"}</Text>
                  </View>
                  <View style={styles.divider} />
                  <View style={styles.detailRow}>
                    <Text style={styles.earningsLabel}>Tu ganancia estimada (80%):</Text>
                    <Text style={styles.earningsVal}>${gananciaEstimada.toLocaleString("es-CL")} CLP</Text>
                  </View>
                </View>

                {(listoParaEntrega || listoParaDevolucion) && (
                  <TouchableOpacity
                    style={styles.deliverBtn}
                    onPress={() => onOpenDelivery && onOpenDelivery(item)}
                  >
                    <Text style={styles.deliverBtnText}>
                      {listoParaEntrega ? "Iniciar entrega con QR →" : "Iniciar devolución con QR →"}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            );
          }}
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Icon name="history" size={36} color={colors.textMuted} style={{ marginBottom: 10 }} />
              <Text style={styles.emptyTitle}>No hay reservas {filter === "todas" ? "" : "en este estado"}</Text>
              <Text style={styles.emptySub}>
                Cuando alguien reserve tus autos en Los Ángeles, aparecerán aquí.
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
    marginBottom: 12,
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
  filtersRow: {
    flexDirection: "row",
    marginBottom: 14,
  },
  filterChip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    backgroundColor: colors.darkCard,
    marginRight: 6,
    borderWidth: 1,
    borderColor: colors.darkBorder,
  },
  filterChipActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  filterChipText: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.textSilver,
  },
  filterChipTextActive: {
    color: colors.dark,
    fontWeight: "900",
  },
  errorBox: {
    backgroundColor: "rgba(220,38,38,0.12)",
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
  },
  errorText: {
    color: colors.danger,
    fontSize: 12,
  },
  listContent: {
    paddingBottom: 40,
  },
  card: {
    backgroundColor: colors.darkCard,
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.darkBorder,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 10,
  },
  carName: {
    fontSize: 14,
    fontWeight: "800",
    color: colors.textWhite,
  },
  statusBadge: {
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 4,
  },
  statusPending: {
    backgroundColor: colors.accentMuted,
  },
  statusAccepted: {
    backgroundColor: "rgba(16, 185, 129, 0.15)",
  },
  statusText: {
    fontSize: 9,
    fontWeight: "800",
  },
  statusTextPending: {
    color: colors.accent,
  },
  statusTextAccepted: {
    color: colors.success,
  },
  detailsBox: {
    backgroundColor: colors.darkCardHover,
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  detailLabel: {
    fontSize: 11,
    color: colors.textSilver,
  },
  detailVal: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.textWhite,
  },
  divider: {
    height: 1,
    backgroundColor: colors.darkBorder,
    marginVertical: 6,
  },
  earningsLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: colors.textWhite,
  },
  earningsVal: {
    fontSize: 13,
    fontWeight: "900",
    color: colors.accent,
  },
  deliverBtn: {
    backgroundColor: colors.primaryLight,
    paddingVertical: 10,
    borderRadius: 6,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.accentMuted,
  },
  deliverBtnText: {
    color: colors.accent,
    fontWeight: "800",
    fontSize: 12,
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
