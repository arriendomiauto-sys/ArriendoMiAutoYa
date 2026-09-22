import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Image } from "expo-image";
import { colors, Icon, Rating, Skeleton } from "@rentacar/mobile-shared";

// Esqueleto de carga con la misma silueta que <CarCard> (fila de 104 px).
export function CarCardSkeleton() {
  return (
    <View className="flex-row h-[104px] bg-gray-100 rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
      <Skeleton testID="skeleton-foto" className="w-[116px] h-full bg-gray-50" />
      <View className="flex-1 py-3 px-3.5 gap-1.5">
        <Skeleton className="w-[62%] h-3.5" />
        <Skeleton className="w-[40%] h-3" />
        <Skeleton className="w-[30%] h-3.5 mt-auto" />
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
      className="flex-row h-[104px] bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm active:opacity-85"
      onPress={() => onPress(car)}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={`${nombre}, $${precio} por día`}
    >
      {/* Bloque foto: skeleton mientras carga, imagen real o icono en error */}
      <View className="w-[116px] h-full bg-primary-100 border-r border-gray-100">
        {fotoCargando && <Skeleton testID="skeleton-foto" className="w-full h-full" />}
        {foto && !fotoError ? (
          <Image
            source={{ uri: foto }}
            className="w-full h-full"
            contentFit="contain"
            cachePolicy="memory-disk"
            transition={200}
            onLoadEnd={() => setFotoCargando(false)}
            onError={() => {
              setFotoError(true);
              setFotoCargando(false);
            }}
          />
        ) : (
          <View className="flex-1 bg-accent-100 items-center justify-center">
            <Icon name="car" size={24} color={colors.primary300} />
          </View>
        )}
      </View>

      {/* Bloque info */}
      <View className="flex-1 py-3 px-3.5 gap-1.5">
        <Text className="text-base font-semibold text-textDark pr-6" numberOfLines={1}>
          {nombre || "Vehículo"}
        </Text>

        <View className="flex-row items-center">
          <Rating value={car.rating_promedio} count={car.rating_cantidad} size="sm" />
          {comuna ? <Text className="text-xs text-textMuted shrink" numberOfLines={1}>{` · ${comuna}`}</Text> : null}
        </View>

        <View className="mt-auto flex-row items-baseline">
          <Text className="text-[17px] font-bold text-primary tracking-tight">
            {`$${precio} `}
            <Text className="text-[13px] font-normal text-textMuted">/ día</Text>
          </Text>
        </View>
      </View>

      {onToggleFavorito ? (
        <TouchableOpacity
          className="absolute top-2.5 right-2.5 w-7 h-7 items-center justify-center"
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
