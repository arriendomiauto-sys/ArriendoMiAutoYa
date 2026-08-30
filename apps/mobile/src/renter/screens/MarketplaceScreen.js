import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  RefreshControl,
} from "react-native";
import {
  colors,
  theme,
  useApp,
  Icon,
  Chip,
  EmptyState,
  VerifyIdentityBanner,
} from "@rentacar/mobile-shared";
import { CarCard } from "../components/CarCard";

const CATEGORIES = [
  { id: "Todos", cat: null },
  { id: "Económico", cat: "economico" },
  { id: "Sedán", cat: "sedan" },
  { id: "SUV", cat: "suv" },
  { id: "Camioneta", cat: "camioneta" },
  { id: "Premium", cat: "premium" },
];

// Palabras clave de respaldo para autos publicados antes de que existiera
// el campo `categoria` (o que el dueño dejó sin elegir).
const CAT_KEYWORDS = {
  suv: ["rav4", "tucson", "jimny", "sportage", "cr-v", "crv", "tiguan", "kicks", "seltos", "corolla cross"],
  camioneta: ["hilux", "ranger", "amarok", "l200", "frontier", "d-max", "dmax", "colorado"],
};

export function MarketplaceScreen({ onSelectCar, onOpenMap, onVerifyIdentity }) {
  const { cars, currentUser, loadData, loading } = useApp();
  const identidadVerificada = currentUser?.estado_documentos === "verificado";
  const [category, setCategory] = useState("Todos");
  const [query, setQuery] = useState("");

  const q = query.trim().toLowerCase();
  const catActiva = CATEGORIES.find((c) => c.id === category)?.cat || null;
  const filteredCars = (cars || []).filter((car) => {
    if (q) {
      const hay = `${car.marca} ${car.modelo} ${car.ubicacion_base || ""} ${car.comuna || ""}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (!catActiva) return true;
    if (car.categoria) return car.categoria === catActiva;
    // Respaldo para autos sin categoría: económico por tarifa, SUV/camioneta
    // por el modelo; sedán/premium sin heurística → no se ocultan.
    if (catActiva === "economico") return (car.tarifa_dia || 0) > 0 && car.tarifa_dia <= 35000;
    if (CAT_KEYWORDS[catActiva]) {
      return CAT_KEYWORDS[catActiva].some((m) => car.modelo?.toLowerCase().includes(m));
    }
    return true;
  });

  const primerNombre = (currentUser?.nombre || "").split(" ")[0];

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />

      <View style={styles.header}>
        <View style={styles.greetRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.greetHi}>
              {primerNombre ? `Hola, ${primerNombre}` : "Explorar autos"}
            </Text>
            <Text style={styles.greetSub}>¿A dónde vas esta vez?</Text>
          </View>
          <TouchableOpacity style={styles.mapBtn} onPress={onOpenMap} activeOpacity={0.85}>
            <Icon name="pin" size={16} color={colors.primary} />
            <Text style={styles.mapBtnText}>Mapa</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.searchBar}>
          <Icon name="search" size={17} color={colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            value={query}
            onChangeText={setQuery}
            placeholder="Marca, modelo o comuna"
            placeholderTextColor={colors.textPlaceholder}
            returnKeyType="search"
          />
          {query ? (
            <TouchableOpacity onPress={() => setQuery("")} hitSlop={theme.control.hitSlop}>
              <Icon name="close" size={16} color={colors.textMuted} />
            </TouchableOpacity>
          ) : null}
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chips}
        >
          {CATEGORIES.map((c) => (
            <Chip key={c.id} label={c.id} selected={category === c.id} onPress={() => setCategory(c.id)} />
          ))}
        </ScrollView>
      </View>

      <ScrollView
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={!!loading} onRefresh={loadData} tintColor={colors.primary} />
        }
      >
        {!identidadVerificada && (
          <View style={{ marginBottom: theme.spacing.lg }}>
            <VerifyIdentityBanner role="renter" onPress={onVerifyIdentity} />
          </View>
        )}

        {filteredCars.length > 0 ? (
          <>
            <Text style={styles.count}>
              {filteredCars.length} {filteredCars.length === 1 ? "auto disponible" : "autos disponibles"}
            </Text>
            {filteredCars.map((car) => (
              <CarCard key={car.id || car._id} car={car} onPress={() => onSelectCar(car)} />
            ))}
          </>
        ) : (
          <EmptyState
            icon="car"
            title="No hay autos con estos filtros"
            message={
              q
                ? "Prueba con otra marca o comuna, o limpia la búsqueda."
                : "Ajusta la categoría para ver más resultados."
            }
            action="Limpiar filtros"
            onAction={() => {
              setQuery("");
              setCategory("Todos");
            }}
          />
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    paddingHorizontal: theme.spacing.screen,
    paddingTop: theme.spacing.sm,
    paddingBottom: theme.spacing.md,
    gap: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  greetRow: { flexDirection: "row", alignItems: "center", gap: theme.spacing.md },
  greetHi: { fontSize: 22, fontWeight: "700", color: colors.text, letterSpacing: -0.3 },
  greetSub: { fontSize: 14, color: colors.textMuted, marginTop: 2 },
  mapBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: theme.radius.pill,
    backgroundColor: colors.primary100,
  },
  mapBtnText: { fontSize: 14, fontWeight: "600", color: colors.primary },
  searchBar: {
    height: theme.control.height,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: theme.radius.pill,
    backgroundColor: colors.surface,
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.lg,
  },
  searchInput: { flex: 1, fontSize: 15, color: colors.text },
  chips: { gap: theme.spacing.sm, paddingRight: theme.spacing.screen },
  list: { padding: theme.spacing.screen, paddingBottom: theme.spacing.xxxl },
  count: { fontSize: 13, color: colors.textMuted, marginBottom: theme.spacing.md, fontWeight: "500" },
});
