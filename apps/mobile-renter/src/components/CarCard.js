import React from "react";
import { View, Text, StyleSheet, Image, TouchableOpacity } from "react-native";
import { colors } from "@rentacar/mobile-shared";

export function CarCard({ car, onPress }) {
  const precio = (car.tarifa_dia || 0).toLocaleString("es-CL");

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => onPress(car)}
      activeOpacity={0.88}
    >
      {/* 3:2 Car Image Area (Pantalla 08 / Tarjeta de vehículo) */}
      <View style={styles.imageContainer}>
        <Image
          source={{
            uri: car.fotos?.[0] || "https://images.unsplash.com/photo-1549399542-7e3f8b79c341?w=800",
          }}
          style={styles.carImage}
          resizeMode="cover"
        />
        <View style={styles.statusBadge}>
          <Text style={styles.statusBadgeText}>Disponible</Text>
        </View>
      </View>

      {/* Card Content */}
      <View style={styles.content}>
        <View style={styles.titleRow}>
          <View style={{ flex: 1, paddingRight: 8 }}>
            <Text style={styles.carTitle} numberOfLines={1}>
              {car.marca} {car.modelo} {car.anio || ""}
            </Text>
            <Text style={styles.carSpecs} numberOfLines={1}>
              Patente {car.patente || "—"}
            </Text>
          </View>
        </View>

        {/* Location and Price Row */}
        <View style={styles.footerRow}>
          <Text style={styles.distanceText} numberOfLines={1}>
            {car.ubicacion_base || "Los Ángeles"}
          </Text>
          <Text style={styles.priceValue}>
            ${precio} <Text style={styles.pricePerDay}>/ día</Text>
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
    marginBottom: 16,
    boxShadow: "0 1px 2px rgba(15,61,62,.08)",
  },
  imageContainer: {
    height: 150,
    backgroundColor: colors.surfaceSecondary,
    position: "relative",
  },
  carImage: {
    width: "100%",
    height: "100%",
  },
  statusBadge: {
    position: "absolute",
    top: 12,
    left: 12,
    backgroundColor: colors.accent100,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 999,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.accent800,
  },
  content: {
    padding: 16,
    gap: 12,
    backgroundColor: colors.surface,
  },
  titleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  carTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: colors.text,
    letterSpacing: -0.2,
  },
  carSpecs: {
    fontSize: 14,
    color: colors.textMuted,
    marginTop: 2,
  },
  footerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 10,
  },
  distanceText: {
    fontSize: 14,
    color: colors.textMuted,
  },
  priceValue: {
    fontSize: 18,
    fontWeight: "600",
    color: colors.text,
  },
  pricePerDay: {
    fontSize: 14,
    fontWeight: "400",
    color: colors.textMuted,
  },
});
