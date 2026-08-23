import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  ScrollView,
  Image,
} from "react-native";
import { colors } from "../../../theme/colors";
import { useApp } from "../../../context/AppContext";
import { Icon } from "../../../shared/components/Icon";

export function MapExploreScreen({ onBack, onSelectCar }) {
  const { cars } = useApp();
  const [selectedCar, setSelectedCar] = useState(cars[0] || null);
  const [showFilterModal, setShowFilterModal] = useState(false);

  // Filter state (Pantalla 10)
  const [category, setCategory] = useState("Económico");
  const [transmission, setTransmission] = useState("Automático");

  const activeCar = selectedCar || cars[0] || {
    marca: "Suzuki",
    modelo: "Swift",
    ano: 2023,
    precio_diario: 38000,
    rating_promedio: 4.8,
    comuna: "Providencia",
    distancia: "1,2 km",
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />

      {/* Background Map Simulation (Pantalla 09) */}
      <View style={styles.mapCanvas}>
        <View style={styles.mapGridLines} />
        <View style={[styles.mapRoad, styles.mapRoad1]} />
        <View style={[styles.mapRoad, styles.mapRoad2]} />

        {/* Top Search Bar with Filter Trigger */}
        <View style={styles.topSearchRow}>
          <TouchableOpacity
            style={styles.searchBubble}
            onPress={onBack}
            activeOpacity={0.85}
          >
            <Icon name="search" size={17} color={colors.textMuted} style={{ marginRight: 8 }} />
            <Text style={styles.searchBubbleText}>Providencia · 12–16 ago</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.filterCircleBtn}
            onPress={() => setShowFilterModal(true)}
            activeOpacity={0.85}
          >
            <Icon name="gear" size={20} color={colors.primary} />
          </TouchableOpacity>
        </View>

        {/* Map Price Pins */}
        <TouchableOpacity
          style={[
            styles.pricePin,
            styles.pricePin1,
            activeCar.modelo === "Swift" ? styles.pinActive : styles.pinInactive,
          ]}
          onPress={() => setSelectedCar(cars[0])}
        >
          <Text
            style={[
              styles.pinText,
              activeCar.modelo === "Swift" ? styles.pinTextActive : styles.pinTextInactive,
            ]}
          >
            $38.000
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.pricePin,
            styles.pricePin2,
            activeCar.modelo === "Sail" ? styles.pinActive : styles.pinInactive,
          ]}
          onPress={() => setSelectedCar(cars[1] || cars[0])}
        >
          <Text
            style={[
              styles.pinText,
              activeCar.modelo === "Sail" ? styles.pinTextActive : styles.pinTextInactive,
            ]}
          >
            $26.000
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.pricePin, styles.pricePin3, styles.pinInactive]}
        >
          <Text style={[styles.pinText, styles.pinTextInactive]}>$44.000</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.pricePin, styles.pricePin4, styles.pinInactive]}
        >
          <Text style={[styles.pinText, styles.pinTextInactive]}>$31.000</Text>
        </TouchableOpacity>

        {/* Bottom Sheet Card Preview (Pantalla 09) */}
        <View style={styles.bottomCardSheet}>
          <View style={styles.sheetHandle} />

          <View style={styles.sheetContent}>
            <View style={styles.sheetImageThumb}>
              <Image
                source={{
                  uri:
                    activeCar.foto_principal_url ||
                    "https://images.unsplash.com/photo-1549399542-7e3f8b79c341?w=800",
                }}
                style={styles.sheetImage}
              />
            </View>

            <View style={styles.sheetDetails}>
              <Text style={styles.sheetTitle}>
                {activeCar.marca} {activeCar.modelo} {activeCar.ano || 2023}
              </Text>
              <Text style={styles.sheetSpecs}>
                {activeCar.transmision || "Automático"} · {activeCar.comuna || "Providencia"} · {activeCar.distancia || "1,2 km"}
              </Text>

              <View style={styles.sheetPriceRow}>
                <View style={styles.ratingBadge}>
                  <Icon name="star" size={14} color="#2FBF9B" style={{ marginRight: 3 }} />
                  <Text style={styles.ratingText}>{activeCar.rating_promedio || 4.8}</Text>
                </View>
                <Text style={styles.sheetPrice}>
                  ${(activeCar.precio_diario || 38000).toLocaleString("es-CL")}{" "}
                  <Text style={styles.sheetPricePerDay}>/ día</Text>
                </Text>
              </View>
            </View>
          </View>

          <TouchableOpacity
            style={styles.viewCarBtn}
            onPress={() => onSelectCar(activeCar)}
            activeOpacity={0.85}
          >
            <Text style={styles.viewCarBtnText}>Ver el auto</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ========================================================================= */}
      {/* PANTALLA 10: MODAL DE FILTROS */}
      {/* ========================================================================= */}
      {showFilterModal && (
        <View style={styles.modalOverlay}>
          <View style={styles.filterModal}>
            <View style={styles.modalHeader}>
              <View style={styles.sheetHandle} />
              <View style={styles.modalHeaderRow}>
                <Text style={styles.modalTitle}>Filtros</Text>
                <TouchableOpacity onPress={() => setShowFilterModal(false)}>
                  <Text style={styles.cleanBtnText}>Limpiar</Text>
                </TouchableOpacity>
              </View>
            </View>

            <ScrollView contentContainerStyle={styles.modalBody} showsVerticalScrollIndicator={false}>
              {/* Categoría */}
              <View style={styles.filterSection}>
                <Text style={styles.filterLabel}>CATEGORÍA</Text>
                <View style={styles.filterChipsRow}>
                  {["Económico", "Sedán", "SUV", "Camioneta"].map((cat) => (
                    <TouchableOpacity
                      key={cat}
                      style={[
                        styles.modalChip,
                        category === cat && styles.modalChipActive,
                      ]}
                      onPress={() => setCategory(cat)}
                    >
                      <Text
                        style={[
                          styles.modalChipText,
                          category === cat && styles.modalChipTextActive,
                        ]}
                      >
                        {cat}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Transmisión */}
              <View style={styles.filterSection}>
                <Text style={styles.filterLabel}>TRANSMISIÓN</Text>
                <View style={styles.transmissionRow}>
                  <TouchableOpacity
                    style={[
                      styles.transBtn,
                      transmission === "Automático" && styles.transBtnActive,
                    ]}
                    onPress={() => setTransmission("Automático")}
                  >
                    <Text
                      style={[
                        styles.transBtnText,
                        transmission === "Automático" && styles.transBtnTextActive,
                      ]}
                    >
                      Automático
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.transBtn,
                      transmission === "Mecánico" && styles.transBtnActive,
                    ]}
                    onPress={() => setTransmission("Mecánico")}
                  >
                    <Text
                      style={[
                        styles.transBtnText,
                        transmission === "Mecánico" && styles.transBtnTextActive,
                      ]}
                    >
                      Mecánico
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Rango de Precio */}
              <View style={styles.filterSection}>
                <View style={styles.priceHeader}>
                  <Text style={styles.filterLabel}>PRECIO POR DÍA</Text>
                  <Text style={styles.priceRangeValue}>$22.000 – $45.000</Text>
                </View>
                <View style={styles.sliderTrack}>
                  <View style={styles.sliderActiveTrack} />
                  <View style={[styles.sliderThumb, { left: 0 }]} />
                  <View style={[styles.sliderThumb, { left: "64%" }]} />
                </View>
              </View>

              {/* Fechas */}
              <View style={styles.filterSection}>
                <Text style={styles.filterLabel}>FECHAS</Text>
                <View style={styles.dateSelectorBox}>
                  <Text style={styles.dateSelectorText}>12 – 16 de agosto</Text>
                  <Icon name="calendar" size={18} color={colors.textMuted} />
                </View>
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.applyFilterBtn}
                onPress={() => setShowFilterModal(false)}
                activeOpacity={0.85}
              >
                <Text style={styles.applyFilterBtnText}>Ver 27 autos</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  mapCanvas: {
    flex: 1,
    backgroundColor: "#E6F0F0",
    position: "relative",
    overflow: "hidden",
  },
  mapGridLines: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.5,
  },
  mapRoad: {
    position: "absolute",
    backgroundColor: "#94BFBF",
  },
  mapRoad1: {
    top: 180,
    left: -40,
    width: 300,
    height: 26,
    transform: [{ rotate: "-18deg" }],
  },
  mapRoad2: {
    top: 430,
    left: 60,
    width: 420,
    height: 22,
    transform: [{ rotate: "9deg" }],
  },
  topSearchRow: {
    paddingHorizontal: 20,
    paddingTop: 12,
    flexDirection: "row",
    alignItems: "center",
    zIndex: 2,
  },
  searchBubble: {
    height: 48,
    flex: 1,
    borderRadius: 999,
    backgroundColor: colors.surface,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    shadowColor: "#0F3D3E",
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 3,
  },
  searchBubbleText: {
    fontSize: 15,
    color: colors.text,
  },
  filterCircleBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.surface,
    marginLeft: 10,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#0F3D3E",
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 3,
  },
  pricePin: {
    position: "absolute",
    paddingVertical: 8,
    paddingHorizontal: 13,
    borderRadius: 999,
    zIndex: 2,
  },
  pricePin1: {
    top: 240,
    left: 80,
  },
  pricePin2: {
    top: 330,
    left: 210,
  },
  pricePin3: {
    top: 190,
    left: 230,
  },
  pricePin4: {
    top: 400,
    left: 50,
  },
  pinActive: {
    backgroundColor: colors.primary,
    shadowColor: "#0F3D3E",
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  pinInactive: {
    backgroundColor: colors.surface,
    shadowColor: "#0F3D3E",
    shadowOpacity: 0.14,
    shadowRadius: 6,
    elevation: 2,
  },
  pinText: {
    fontSize: 14,
    fontWeight: "600",
  },
  pinTextActive: {
    color: "#FFFFFF",
  },
  pinTextInactive: {
    color: colors.primary,
  },
  bottomCardSheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 3,
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 28,
    gap: 14,
    shadowColor: "#0F3D3E",
    shadowOpacity: 0.16,
    shadowRadius: 24,
    elevation: 6,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 999,
    backgroundColor: colors.border,
    alignSelf: "center",
  },
  sheetContent: {
    flexDirection: "row",
    gap: 14,
  },
  sheetImageThumb: {
    width: 104,
    height: 78,
    borderRadius: 12,
    backgroundColor: colors.primary100,
    overflow: "hidden",
  },
  sheetImage: {
    width: "100%",
    height: "100%",
  },
  sheetDetails: {
    flex: 1,
    gap: 4,
  },
  sheetTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: colors.text,
  },
  sheetSpecs: {
    fontSize: 13,
    color: colors.textMuted,
  },
  sheetPriceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    marginTop: 4,
  },
  ratingBadge: {
    flexDirection: "row",
    alignItems: "center",
  },
  ratingText: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.text,
  },
  sheetPrice: {
    fontSize: 17,
    fontWeight: "600",
    color: colors.text,
  },
  sheetPricePerDay: {
    fontSize: 13,
    fontWeight: "400",
    color: colors.textMuted,
  },
  viewCarBtn: {
    height: 52,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  viewCarBtnText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(6, 30, 31, 0.4)",
    justifyContent: "flex-end",
    zIndex: 10,
  },
  filterModal: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: 620,
  },
  modalHeader: {
    padding: 20,
    paddingBottom: 12,
    gap: 12,
  },
  modalHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: colors.text,
  },
  cleanBtnText: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.accent700,
  },
  modalBody: {
    paddingHorizontal: 20,
    gap: 20,
    paddingBottom: 16,
  },
  filterSection: {
    gap: 10,
  },
  filterLabel: {
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.8,
    color: colors.textMuted,
    textTransform: "uppercase",
  },
  filterChipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  modalChip: {
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  modalChipText: {
    fontSize: 14,
    color: colors.text,
  },
  modalChipTextActive: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  transmissionRow: {
    flexDirection: "row",
    gap: 8,
  },
  transBtn: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  transBtnActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  transBtnText: {
    fontSize: 15,
    color: colors.text,
  },
  transBtnTextActive: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  priceHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
  },
  priceRangeValue: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.text,
  },
  sliderTrack: {
    height: 4,
    borderRadius: 999,
    backgroundColor: colors.border,
    position: "relative",
    marginVertical: 10,
  },
  sliderActiveTrack: {
    position: "absolute",
    left: 0,
    right: "36%",
    top: 0,
    bottom: 0,
    borderRadius: 999,
    backgroundColor: colors.primary,
  },
  sliderThumb: {
    position: "absolute",
    top: -9,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.primary,
  },
  dateSelectorBox: {
    height: 52,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: colors.surface,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
  },
  dateSelectorText: {
    fontSize: 16,
    color: colors.text,
  },
  modalFooter: {
    padding: 20,
    paddingBottom: 30,
  },
  applyFilterBtn: {
    height: 56,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  applyFilterBtnText: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "600",
  },
});
