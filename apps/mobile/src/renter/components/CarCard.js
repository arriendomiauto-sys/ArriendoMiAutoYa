import React from "react";
import { View, Text, StyleSheet, Image, TouchableOpacity } from "react-native";
import { colors, theme, Icon, Rating, Skeleton } from "@rentacar/mobile-shared";

// Esqueleto de carga con la misma silueta que <CarCard> (fila de 104 px).
export function CarCardSkeleton() {
  return (
    <View style={[styles.card, styles.skelCard]}>
      <Skeleton testID="skeleton-foto" style={[styles.photo, styles.skelBlock]} />
      <View style={styles.body}>
        <Skeleton style={{ width: "62%", height: 14 }} />
        <Skeleton style={{ width: "40%", height: 12 }} />
        <Skeleton style={{ width: "30%", height: 14, marginTop: "auto" }} />
      </View>
    </View>
  );
}

// Tarjeta de auto del marketplace — dirección "lista densa" (Lote 3, 1a):
// fila horizontal de ~104 px, foto 4:3 a la izquierda, y a la derecha el
// nombre, el <Rating> con la comuna y el precio. El corazón flota sobre la
// info. Sin botón "Ver": toda la tarjeta es táctil. React.memo: dentro de la
// FlatList del marketplace, solo se redibujan las tarjetas que cambian
// (favorito, auto, callbacks estables), no toda la lista en cada tecla.
export const CarCard = React.memo(function CarCard({ car, onPress, esFavorito, onToggleFavorito }) {
  const [fotoError, setFotoError] = React.useState(false);
  const [fotoCargando, setFotoCargando] = React.useState(true);
  const foto = car.fotos?.[0];
  const precio = (car.tarifa_dia || 0).toLocaleString("es-CL");
  const comuna = car.ubicacion_base || car.comuna || "";
  const nombre = [car.marca, car.modelo, car.anio].filter(Boolean).join(" ");

  return (
    <TouchableOpacity
      testID={`car-card-${car.patente || car.id}`}
      style={styles.card}
      onPress={() => onPress(car)}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={`${nombre}, $${precio} por día`}
    >
      {/* Bloque foto: skeleton mientras carga, imagen real o icono en error */}
      <View style={styles.photo}>
        {fotoCargando && <Skeleton testID="skeleton-foto" style={styles.photoImg} />}
        {foto && !fotoError ? (
          <Image
            source={{ uri: foto }}
            style={styles.photoImg}
            resizeMode="contain"
            onLoadEnd={() => setFotoCargando(false)}
            onError={() => {
              setFotoError(true);
              setFotoCargando(false);
            }}
          />
        ) : (
          <View style={styles.photoPlaceholder}>
            <Icon name="car" size={24} color={colors.primary300} />
          </View>
        )}
      </View>

      {/* Bloque info */}
      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={1}>
          {nombre || "Vehículo"}
        </Text>

        <View style={styles.metaRow}>
          <Rating value={car.rating_promedio} count={car.rating_cantidad} size="sm" />
          {comuna ? <Text style={styles.comuna} numberOfLines={1}>{` · ${comuna}`}</Text> : null}
        </View>

        <View style={styles.priceRow}>
          <Text style={styles.price}>
            {`$${precio} `}
            <Text style={styles.per}>/ día</Text>
          </Text>
        </View>
      </View>

      {onToggleFavorito ? (
        <TouchableOpacity
          style={styles.fav}
          onPress={() => onToggleFavorito(car)}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityRole="button"
          accessibilityLabel={esFavorito ? "Quitar de favoritos" : "Agregar a favoritos"}
        >
          <Icon
            name="heart"
            size={18}
            color={esFavorito ? colors.accent700 : colors.primary}
            fill={esFavorito ? colors.accent500 : "none"}
          />
        </TouchableOpacity>
      ) : null}
    </TouchableOpacity>
  );
});

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    height: 104,
    backgroundColor: colors.surface,
    borderRadius: theme.radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
    ...theme.shadow.sm,
  },
  photo: {
    width: 116,
    height: "100%",
    backgroundColor: colors.primary100,
    borderRightWidth: 1,
    borderRightColor: colors.border,
  },
  photoImg: { width: "100%", height: "100%" },
  photoPlaceholder: {
    flex: 1,
    backgroundColor: colors.accent100,
    alignItems: "center",
    justifyContent: "center",
  },
  body: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 5,
  },
  title: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.text,
    paddingRight: 26,
  },
  metaRow: { flexDirection: "row", alignItems: "center" },
  comuna: { fontSize: 12, color: colors.textMuted, flexShrink: 1 },
  priceRow: { marginTop: "auto", flexDirection: "row", alignItems: "baseline" },
  price: { fontSize: 17, fontWeight: "700", color: colors.primary, letterSpacing: -0.2 },
  per: { fontSize: 13, fontWeight: "400", color: colors.textMuted },
  fav: {
    position: "absolute",
    top: 10,
    right: 10,
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
  },

  // Skeleton
  skelCard: { backgroundColor: colors.skeleton, borderColor: colors.skeleton },
  skelBlock: { backgroundColor: colors.surfaceSecondary, borderRightWidth: 0 },
});
