import React from "react";
import { View, Text, StyleSheet, Image, TouchableOpacity } from "react-native";
import { colors, theme, Icon } from "@rentacar/mobile-shared";

export function CarCard({ car, onPress }) {
  const precio = (car.tarifa_dia || 0).toLocaleString("es-CL");
  const rating = car.rating_promedio || car.dueno?.rating;
  const equip = car.equipamiento || {};
  const specs = [
    equip.doble_traccion && "4x4",
    equip.ac && "A/C",
    equip.camara_retroceso && "Cámara",
  ].filter(Boolean);

  return (
    <TouchableOpacity style={styles.card} onPress={() => onPress(car)} activeOpacity={0.9}>
      <View style={styles.imageWrap}>
        <Image
          source={{
            uri: car.fotos?.[0] || "https://images.unsplash.com/photo-1549399542-7e3f8b79c341?w=800",
          }}
          style={styles.image}
          resizeMode="cover"
        />
        <View style={styles.badge}>
          <View style={styles.badgeDot} />
          <Text style={styles.badgeText}>Disponible</Text>
        </View>
      </View>

      <View style={styles.body}>
        <View style={styles.titleRow}>
          <Text style={styles.title} numberOfLines={1}>
            {car.marca} {car.modelo} {car.anio || ""}
          </Text>
          {rating ? (
            <View style={styles.rating}>
              <Icon name="star" size={13} color={colors.accent} />
              <Text style={styles.ratingText}>{Number(rating).toFixed(1)}</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.metaRow}>
          <Icon name="location" size={13} color={colors.textMuted} />
          <Text style={styles.meta} numberOfLines={1}>
            {car.ubicacion_base || car.comuna || "Los Ángeles"}
          </Text>
        </View>

        {specs.length ? (
          <View style={styles.specsRow}>
            {specs.map((s) => (
              <View key={s} style={styles.specChip}>
                <Text style={styles.specText}>{s}</Text>
              </View>
            ))}
          </View>
        ) : null}

        <View style={styles.priceRow}>
          <Text style={styles.price}>
            ${precio} <Text style={styles.per}>/ día</Text>
          </Text>
          <View style={styles.cta}>
            <Text style={styles.ctaText}>Ver</Text>
            <Icon name="arrow-right" size={15} color={colors.primary} />
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: theme.radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
    marginBottom: theme.spacing.lg,
    ...theme.shadow.sm,
  },
  imageWrap: { height: 168, backgroundColor: colors.surfaceSecondary },
  image: { width: "100%", height: "100%" },
  badge: {
    position: "absolute",
    top: theme.spacing.md,
    left: theme.spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255,255,255,0.95)",
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: theme.radius.pill,
  },
  badgeDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.accent500 },
  badgeText: { fontSize: 12, fontWeight: "600", color: colors.primary },
  body: { padding: theme.spacing.lg, gap: theme.spacing.sm },
  titleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: theme.spacing.sm },
  title: { flex: 1, fontSize: 17, fontWeight: "700", color: colors.text, letterSpacing: -0.2 },
  rating: { flexDirection: "row", alignItems: "center", gap: 3 },
  ratingText: { fontSize: 13, fontWeight: "600", color: colors.text },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  meta: { fontSize: 13, color: colors.textMuted, flex: 1 },
  specsRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  specChip: {
    backgroundColor: colors.surfaceSubtle,
    borderRadius: theme.radius.sm,
    paddingVertical: 3,
    paddingHorizontal: 8,
  },
  specText: { fontSize: 11, fontWeight: "600", color: colors.primary },
  priceRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: theme.spacing.md,
    marginTop: 2,
  },
  price: { fontSize: 18, fontWeight: "700", color: colors.text, letterSpacing: -0.3 },
  per: { fontSize: 13, fontWeight: "400", color: colors.textMuted },
  cta: { flexDirection: "row", alignItems: "center", gap: 4 },
  ctaText: { fontSize: 14, fontWeight: "600", color: colors.primary },
});
