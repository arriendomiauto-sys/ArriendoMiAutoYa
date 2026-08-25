import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
} from "react-native";
import { colors, useApp, Icon } from "@rentacar/mobile-shared";

export function DriverBookingsScreen({ onOpenDelivery }) {
  const { driverBookings, respondBookingRequest } = useApp();
  const [filter, setFilter] = useState("pendientes"); // 'pendientes' | 'aceptadas' | 'todas'

  const filtered = driverBookings.filter((b) => {
    if (filter === "pendientes") return b.estado === "pendiente";
    if (filter === "aceptadas") return b.estado === "aceptada";
    return true;
  });

  const handleRespond = (id, response) => {
    respondBookingRequest(id, response);
    if (response === "aceptada") {
      Alert.alert(
        "Solicitud Aprobada",
        "Has confirmado el arriendo. Procede al punto de encuentro para realizar la inspección por QR y checklist.",
        [{ text: "Ir a Entrega", onPress: onOpenDelivery }]
      );
    } else {
      Alert.alert("Solicitud Rechazada", "La petición ha sido declinada.");
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Solicitudes de Arriendo</Text>
        <Text style={styles.subtitle}>
          Peticiones de clientes verificados para tus vehículos
        </Text>
      </View>

      {/* Filtros */}
      <View style={styles.filtersRow}>
        {[
          { id: "pendientes", label: "Pendientes" },
          { id: "aceptadas", label: "Aceptadas" },
          { id: "todas", label: "Todas" },
        ].map((f) => (
          <TouchableOpacity
            key={f.id}
            style={[
              styles.filterChip,
              filter === f.id && styles.filterChipActive,
            ]}
            onPress={() => setFilter(f.id)}
          >
            <Text
              style={[
                styles.filterChipText,
                filter === f.id && styles.filterChipTextActive,
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
        renderItem={({ item }) => {
          const isPendiente = item.estado === "pendiente";

          return (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View>
                  <Text style={styles.renterName}>{item.cliente_nombre}</Text>
                  <View style={styles.ratingRow}>
                    <Icon name="star" size={10} color={colors.accent} style={{ marginRight: 3 }} />
                    <Text style={styles.ratingText}>
                      {item.cliente_rating || "4.9"} (Perfil Verificado)
                    </Text>
                  </View>
                </View>
                <View
                  style={[
                    styles.statusBadge,
                    isPendiente ? styles.statusPending : styles.statusAccepted,
                  ]}
                >
                  <Text
                    style={[
                      styles.statusText,
                      isPendiente ? styles.statusTextPending : styles.statusTextAccepted,
                    ]}
                  >
                    {isPendiente ? "Pendiente" : "Confirmada"}
                  </Text>
                </View>
              </View>

              {/* Detalles */}
              <View style={styles.detailsBox}>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Vehículo Solicitado:</Text>
                  <Text style={styles.detailVal}>{item.auto_nombre}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Duración:</Text>
                  <Text style={styles.detailVal}>
                    {item.dias} {item.dias === 1 ? "día" : "días"} ({item.fecha_inicio})
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Lugar de Entrega:</Text>
                  <Text style={styles.detailVal}>{item.lugar_entrega}</Text>
                </View>
                <View style={styles.divider} />
                <View style={styles.detailRow}>
                  <Text style={styles.earningsLabel}>Tu Ganancia Neta (80%):</Text>
                  <Text style={styles.earningsVal}>
                    ${(item.ganancia_dueno || 89600).toLocaleString("es-CL")} CLP
                  </Text>
                </View>
              </View>

              {/* Acciones */}
              {isPendiente && (
                <View style={styles.actionsRow}>
                  <TouchableOpacity
                    style={styles.rejectBtn}
                    onPress={() => handleRespond(item.id, "rechazada")}
                  >
                    <Text style={styles.rejectBtnText}>Declinar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.acceptBtn}
                    onPress={() => handleRespond(item.id, "aceptada")}
                  >
                    <Text style={styles.acceptBtnText}>Aceptar Arriendo →</Text>
                  </TouchableOpacity>
                </View>
              )}

              {item.estado === "aceptada" && (
                <TouchableOpacity
                  style={styles.deliverBtn}
                  onPress={onOpenDelivery}
                >
                  <Text style={styles.deliverBtnText}>Proceder a la Entrega Física →</Text>
                </TouchableOpacity>
              )}
            </View>
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <Icon name="history" size={36} color={colors.textMuted} style={{ marginBottom: 10 }} />
            <Text style={styles.emptyTitle}>No hay solicitudes {filter}</Text>
            <Text style={styles.emptySub}>
              Cuando los pasajeros soliciten tus autos en Los Ángeles, aparecerán aquí para tu aprobación.
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
  renterName: {
    fontSize: 14,
    fontWeight: "800",
    color: colors.textWhite,
  },
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
  },
  ratingText: {
    fontSize: 10,
    color: colors.textSilver,
    fontWeight: "600",
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
  actionsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  rejectBtn: {
    flex: 1,
    backgroundColor: colors.darkCardHover,
    paddingVertical: 10,
    borderRadius: 6,
    alignItems: "center",
    marginRight: 6,
    borderWidth: 1,
    borderColor: colors.darkBorder,
  },
  rejectBtnText: {
    color: colors.textSilver,
    fontSize: 12,
    fontWeight: "700",
  },
  acceptBtn: {
    flex: 1.5,
    backgroundColor: colors.accent,
    paddingVertical: 10,
    borderRadius: 6,
    alignItems: "center",
    marginLeft: 6,
  },
  acceptBtnText: {
    color: colors.dark,
    fontSize: 12,
    fontWeight: "800",
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
