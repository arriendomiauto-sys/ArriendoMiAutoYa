import React, { useEffect, useState, useCallback } from "react";
import { View, ScrollView, StatusBar, ActivityIndicator, RefreshControl } from "react-native";
import {
  ScreenHeader,
  EmptyState,
  ApiClient,
  useFavoritos,
} from "@rentacar/mobile-shared";
import { CarCard } from "../components/CarCard";

export function FavoritesScreen({ onBack, onSelectCar }) {
  const [autos, setAutos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [refrescando, setRefrescando] = useState(false);
  const { esFavorito, toggle } = useFavoritos();

  const cargar = useCallback(async (conRefresh) => {
    if (conRefresh) setRefrescando(true);
    else setCargando(true);
    const datos = await ApiClient.getFavoritos();
    setAutos(datos || []);
    setCargando(false);
    setRefrescando(false);
  }, []);

  useEffect(() => {
    cargar(false);
  }, [cargar]);

  // Quitar un auto de favoritos acá debe sacarlo de la lista de inmediato,
  // no solo apagar el corazón — es la razón de ser de esta pantalla.
  const handleToggle = (car) => {
    const id = car.id || car._id;
    toggle(id);
    setAutos((prev) => prev.filter((a) => (a.id || a._id) !== id));
  };

  return (
    <View className="flex-1 bg-white">
      <StatusBar barStyle="dark-content" />
      <ScreenHeader title="Mis favoritos" onBack={onBack} />

      {cargando ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#0F766E" />
        </View>
      ) : autos.length === 0 ? (
        <EmptyState
          icon="heart"
          title="Todavía no tienes favoritos"
          message="Toca el corazón en cualquier auto del marketplace para guardarlo acá."
        />
      ) : (
        <ScrollView
          contentContainerClassName="p-4"
          refreshControl={<RefreshControl refreshing={refrescando} onRefresh={() => cargar(true)} />}
        >
          {autos.map((car) => (
            <CarCard
              key={car.id || car._id}
              car={car}
              onPress={() => onSelectCar(car)}
              esFavorito={esFavorito(car.id || car._id)}
              onToggleFavorito={() => handleToggle(car)}
            />
          ))}
        </ScrollView>
      )}
    </View>
  );
}

