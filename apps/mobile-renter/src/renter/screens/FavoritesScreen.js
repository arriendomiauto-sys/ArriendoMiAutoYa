import React, { useEffect, useState, useCallback } from "react";
import { View, FlatList, StatusBar, ActivityIndicator, RefreshControl } from "react-native";
import {
  ScreenHeader,
  EmptyState,
  ApiClient,
  useFavoritos,
  showAlert,
  msjError,
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
    try {
      const datos = await ApiClient.getFavoritos();
      setAutos(datos || []);
    } catch (err) {
      showAlert("No se pudieron cargar tus favoritos", msjError(err, "Intenta de nuevo en unos segundos."));
    } finally {
      setCargando(false);
      setRefrescando(false);
    }
  }, []);

  useEffect(() => {
    cargar(false);
  }, [cargar]);

  // Quitar un auto de favoritos acá debe sacarlo de la lista de inmediato,
  // no solo apagar el corazón — es la razón de ser de esta pantalla.
  const handleToggle = useCallback(
    (car) => {
      const id = car.id || car._id;
      toggle(id);
      setAutos((prev) => prev.filter((a) => (a.id || a._id) !== id));
    },
    [toggle]
  );

  // Lista virtualizada (mismo motivo que en MarketplaceScreen: ScrollView +
  // .map() renderizaba todos los CarCard de una vez). CarCard tiene alto
  // fijo (104 px) y las filas no llevan separación entre sí, igual que
  // antes, así que getItemLayout no necesita medir nada.
  const ROW_ALTURA = 104;
  const getItemLayout = useCallback(
    (_data, index) => ({ length: ROW_ALTURA, offset: 16 + ROW_ALTURA * index, index }),
    []
  );
  const renderItem = useCallback(
    ({ item }) => (
      <CarCard
        car={item}
        onPress={() => onSelectCar(item)}
        esFavorito={esFavorito(item.id || item._id)}
        onToggleFavorito={() => handleToggle(item)}
      />
    ),
    [onSelectCar, esFavorito, handleToggle]
  );

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
        <FlatList
          data={autos}
          keyExtractor={(car) => String(car.id || car._id)}
          renderItem={renderItem}
          getItemLayout={getItemLayout}
          contentContainerClassName="p-4"
          refreshControl={<RefreshControl refreshing={refrescando} onRefresh={() => cargar(true)} />}
        />
      )}
    </View>
  );
}

