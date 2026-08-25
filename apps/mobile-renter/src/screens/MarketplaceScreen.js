import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
} from "react-native";
import { colors, useApp, Icon } from "@rentacar/mobile-shared";
import { CarCard } from "../components/CarCard";

const CATEGORIES = ["Todos", "Económico", "Automático", "Camioneta", "SUV"];

export function MarketplaceScreen({ onSelectCar, onOpenMap, onOpenFilters }) {
  const { cars } = useApp();
  const [selectedCategory, setSelectedCategory] = useState("Todos");
  const [searchQuery, setSearchQuery] = useState("Providencia · 12–16 ago");

  const filteredCars = (cars || []).filter((car) => {
    if (selectedCategory === "Todos") return true;
    if (selectedCategory === "Automático")
      return car.transmision?.toLowerCase().includes("auto");
    if (selectedCategory === "Camioneta")
      return (
        car.categoria?.toLowerCase().includes("camioneta") ||
        car.modelo?.toLowerCase().includes("hilux")
      );
    if (selectedCategory === "Económico")
      return (car.precio_diario || 38000) <= 35000;
    return true;
  });

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />

      {/* Top Header & Search Area (Pantalla 08) */}
      <View style={styles.headerArea}>
        <View style={styles.topRow}>
          {/* Map Link */}
          <TouchableOpacity
            style={styles.mapBtn}
            onPress={onOpenMap}
            activeOpacity={0.8}
          >
            <Icon name="location" size={18} color="#197A63" style={{ marginRight: 6 }} />
            <Text style={styles.mapBtnText}>Mapa</Text>
          </TouchableOpacity>
        </View>

        {/* Search Input Bar */}
        <View style={styles.searchBar}>
          <Icon name="search" size={17} color={colors.textMuted} style={{ marginRight: 10 }} />
          <TextInput
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Buscar comuna, fechas..."
            placeholderTextColor={colors.textMuted}
          />
        </View>

        {/* Filter Chips Row */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipsRow}
        >
          <TouchableOpacity
            style={styles.activeFilterChip}
            onPress={onOpenFilters}
            activeOpacity={0.85}
          >
            <Text style={styles.activeFilterChipText}>Filtros · 2</Text>
          </TouchableOpacity>

          {CATEGORIES.map((cat) => {
            const isSelected = selectedCategory === cat;
            return (
              <TouchableOpacity
                key={cat}
                style={[
                  styles.filterChip,
                  isSelected && styles.filterChipSelected,
                ]}
                onPress={() => setSelectedCategory(cat)}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    isSelected && styles.filterChipTextSelected,
                  ]}
                >
                  {cat}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Car Catalog List */}
      <ScrollView
        contentContainerStyle={styles.catalogList}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.resultsCount}>
          {filteredCars.length} autos disponibles
        </Text>

        {filteredCars.map((car) => (
          <CarCard
            key={car.id || car._id}
            car={car}
            onPress={() => onSelectCar(car)}
          />
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  headerArea: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 14,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
  },
  mapBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  mapBtnText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#197A63",
  },
  searchBar: {
    height: 48,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 999,
    backgroundColor: colors.surface,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: colors.text,
  },
  chipsRow: {
    gap: 8,
  },
  activeFilterChip: {
    backgroundColor: colors.primary,
    paddingVertical: 7,
    paddingHorizontal: 13,
    borderRadius: 999,
  },
  activeFilterChipText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  filterChip: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 7,
    paddingHorizontal: 13,
    borderRadius: 999,
  },
  filterChipSelected: {
    backgroundColor: colors.primary100,
    borderColor: colors.primary,
  },
  filterChipText: {
    fontSize: 13,
    color: colors.text,
  },
  filterChipTextSelected: {
    fontWeight: "600",
    color: colors.primary,
  },
  catalogList: {
    padding: 20,
    paddingBottom: 32,
  },
  resultsCount: {
    fontSize: 14,
    color: colors.textMuted,
    marginBottom: 14,
  },
});
