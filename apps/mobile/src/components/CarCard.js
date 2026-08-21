import React from "react";
import { View, Text, StyleSheet, Image, TouchableOpacity } from "react-native";
import { colors } from "../theme/colors";
import { Icon } from "./Icon";

export function CarCard({ car, onPress }) {
  const precio = (car.precio_diario || 38000).toLocaleString("es-CL");

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => onPress(car)}
      activeOpacity={0.9}
    >
      {/* 3:2 Car Image Area (Pantalla 08 / Tarjeta de vehículo) */}
      <View style={styles.imageContainer}>
        <Image
          source={{
            uri:
              car.foto_principal_url ||
              car.imagen_url ||
              "https://images.unsplash.com/photo-1549399542-7e3f8b79c341?w=800",
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
          <View style={{ flex: 1 }}>
            <Text style={styles.carTitle} numberOfLines={1}>
              {car.marca} {car.modelo} {car.ano || 2023}
            </Text>
            <Text style={styles.carSpecs} numberOfLines={1}>
              {car.transmision || "Automático"} · {car.comuna || "Providencia"} · {car.distancia || "1,2 km"}
            </Text>
          </View>

          <View style={styles.ratingRow}>
            <Icon name="star" size={14} color="#2FBF9B" style={{ marginRight: 3 }} />
            <Text style={styles.ratingText}>{car.rating_promedio || "4,8"}</Text>
          </View>
        </View>

        {/* Price Row */}
        <View style={styles.priceRow}>
          <Text style={styles.priceValue}>
            ${precio}{" "}
            <Text style={styles.pricePerDay}>/ día</Text>
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
    marginBottom: 14,
  },
  imageContainer: {
    height: 140,
    backgroundColor: colors.primary100,
    position: "relative",
  },
  carImage: {
    width: "100%",
    height: "100%",
  },
  statusBadge: {
    position: "absolute",
    top: 10,
    left: 10,
    backgroundColor: "#E4F8F2",
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 999,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#125A49",
  },
  content: {
    padding: 14,
    gap: 10,
  },
  titleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 10,
  },
  carTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: colors.text,
  },
  carSpecs: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 2,
  },
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  ratingText: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.text,
  },
  priceRow: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 8,
    alignItems: "flex-end",
  },
  priceValue: {
    fontSize: 17,
    fontWeight: "600",
    color: colors.text,
  },
  pricePerDay: {
    fontSize: 13,
    fontWeight: "400",
    color: colors.textMuted,
  },
});
