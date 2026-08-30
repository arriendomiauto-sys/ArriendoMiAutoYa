import React, { useMemo, useRef, useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  Image,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, theme, useApp, Icon, Button } from "@rentacar/mobile-shared";

// react-native-maps es un módulo nativo: no existe en web ni en Expo Go sin
// dev build. Se carga de forma tolerante para que el bundle no se caiga y la
// pantalla muestre una alternativa cuando el mapa no está disponible.
let MapView = null;
let Marker = null;
try {
  const maps = require("react-native-maps");
  MapView = maps.default;
  Marker = maps.Marker;
} catch (e) {
  MapView = null;
}

// Centro por defecto: Los Ángeles, Región del Biobío (donde opera la flota).
const DEFAULT_REGION = {
  latitude: -37.4697,
  longitude: -72.3536,
  latitudeDelta: 0.08,
  longitudeDelta: 0.08,
};

// Para autos sin lat/long en el backend: posición estable y repartida
// alrededor del centro, derivada del id (no salta entre renders).
function fallbackCoord(car, index) {
  const seed = String(car.id || car._id || index)
    .split("")
    .reduce((a, c) => a + c.charCodeAt(0), 0);
  const angle = (seed % 360) * (Math.PI / 180);
  const dist = 0.006 + ((seed % 7) / 7) * 0.022;
  return {
    latitude: DEFAULT_REGION.latitude + Math.sin(angle) * dist,
    longitude: DEFAULT_REGION.longitude + Math.cos(angle) * dist,
  };
}

export function MapExploreScreen({ onBack, onSelectCar }) {
  const { cars } = useApp();
  const insets = useSafeAreaInsets();
  const mapRef = useRef(null);
  const [userCoords, setUserCoords] = useState(null);

  const puntos = useMemo(
    () =>
      (cars || []).map((car, i) => {
        const hasReal =
          typeof car.latitud === "number" && typeof car.longitud === "number";
        const coord = hasReal
          ? { latitude: car.latitud, longitude: car.longitud }
          : fallbackCoord(car, i);
        return { car, coord };
      }),
    [cars]
  );

  const [selectedId, setSelectedId] = useState(puntos[0]?.car?.id || null);
  const selected =
    puntos.find((p) => (p.car.id || p.car._id) === selectedId) || puntos[0] || null;

  const initialRegion = useMemo(() => {
    if (puntos.length === 0) return DEFAULT_REGION;
    const lats = puntos.map((p) => p.coord.latitude);
    const lngs = puntos.map((p) => p.coord.longitude);
    const midLat = (Math.min(...lats) + Math.max(...lats)) / 2;
    const midLng = (Math.min(...lngs) + Math.max(...lngs)) / 2;
    const spanLat = Math.max(...lats) - Math.min(...lats);
    const spanLng = Math.max(...lngs) - Math.min(...lngs);
    return {
      latitude: midLat,
      longitude: midLng,
      latitudeDelta: Math.max(spanLat * 1.6, 0.03),
      longitudeDelta: Math.max(spanLng * 1.6, 0.03),
    };
  }, [puntos]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const Location = require("expo-location");
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") return;
        const pos = await Location.getCurrentPositionAsync({ accuracy: 3 });
        if (!alive) return;
        setUserCoords({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
      } catch (e) {
        // sin ubicación: el mapa igual funciona centrado en la flota
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const centrarEnUsuario = () => {
    if (!userCoords || !mapRef.current) return;
    mapRef.current.animateToRegion(
      { ...userCoords, latitudeDelta: 0.03, longitudeDelta: 0.03 },
      450
    );
  };

  const precio = (n) => `$${(n || 0).toLocaleString("es-CL")}`;

  // --- Sin módulo de mapa (web / Expo Go): alternativa utilizable ---
  if (!MapView || Platform.OS === "web") {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="dark-content" />
        <View style={[styles.fallback, { paddingTop: insets.top + 40 }]}>
          <View style={styles.fallbackIcon}>
            <Icon name="pin" size={30} color={colors.primary} />
          </View>
          <Text style={styles.fallbackTitle}>El mapa necesita la app instalada</Text>
          <Text style={styles.fallbackText}>
            La vista de mapa usa mapas nativos y no está disponible en la versión web.
            Abre la app en tu teléfono para explorar los autos en el mapa.
          </Text>
          <Button label="Volver al listado" onPress={onBack} fullWidth={false} style={{ marginTop: theme.spacing.md }} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />

      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        initialRegion={initialRegion}
        showsUserLocation={!!userCoords}
        showsMyLocationButton={false}
        toolbarEnabled={false}
      >
        {puntos.map(({ car, coord }, i) => {
          const id = car.id || car._id || i;
          const active = id === (selected?.car?.id || selected?.car?._id);
          return (
            <Marker
              key={id}
              coordinate={coord}
              onPress={() => setSelectedId(car.id || car._id)}
              tracksViewChanges={false}
              anchor={{ x: 0.5, y: 1 }}
            >
              <View style={[styles.pin, active ? styles.pinActive : styles.pinIdle]}>
                <Text style={[styles.pinText, active ? styles.pinTextActive : styles.pinTextIdle]}>
                  {precio(car.tarifa_dia)}
                </Text>
              </View>
            </Marker>
          );
        })}
      </MapView>

      {/* Barra superior flotante */}
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity style={styles.roundBtn} onPress={onBack} activeOpacity={0.85}>
          <Icon name="arrow-left" size={20} color={colors.primary} />
        </TouchableOpacity>
        <View style={styles.searchPill}>
          <Icon name="search" size={16} color={colors.textMuted} />
          <Text style={styles.searchPillText} numberOfLines={1}>
            {puntos.length} autos en el mapa
          </Text>
        </View>
      </View>

      {/* Botón mi ubicación */}
      {userCoords ? (
        <TouchableOpacity
          style={[styles.locateBtn, { bottom: (selected ? 208 : 40) + insets.bottom }]}
          onPress={centrarEnUsuario}
          activeOpacity={0.85}
        >
          <Icon name="location" size={20} color={colors.primary} />
        </TouchableOpacity>
      ) : null}

      {/* Tarjeta del auto seleccionado */}
      {selected ? (
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) + 8 }]}>
          <View style={styles.sheetHandle} />
          <TouchableOpacity
            style={styles.sheetRow}
            activeOpacity={0.9}
            onPress={() => onSelectCar(selected.car)}
          >
            <Image
              source={{
                uri:
                  selected.car.fotos?.[0] ||
                  "https://images.unsplash.com/photo-1549399542-7e3f8b79c341?w=800",
              }}
              style={styles.sheetThumb}
            />
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={styles.sheetTitle} numberOfLines={1}>
                {selected.car.marca} {selected.car.modelo} {selected.car.anio || ""}
              </Text>
              <Text style={styles.sheetMeta} numberOfLines={1}>
                {selected.car.ubicacion_base || "Los Ángeles"}
              </Text>
              <Text style={styles.sheetPrice}>
                {precio(selected.car.tarifa_dia)} <Text style={styles.sheetPer}>/ día</Text>
              </Text>
            </View>
          </TouchableOpacity>
          <Button label="Ver el auto" onPress={() => onSelectCar(selected.car)} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  topBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.screen,
  },
  roundBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    ...theme.shadow.md,
  },
  searchPill: {
    flex: 1,
    height: 44,
    borderRadius: theme.radius.pill,
    backgroundColor: colors.surface,
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.lg,
    ...theme.shadow.md,
  },
  searchPillText: { fontSize: 14, color: colors.text, fontWeight: "500", flex: 1 },
  pin: {
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: theme.radius.pill,
    borderWidth: 2,
    ...theme.shadow.sm,
  },
  pinIdle: { backgroundColor: colors.surface, borderColor: colors.surface },
  pinActive: { backgroundColor: colors.primary, borderColor: "#FFFFFF" },
  pinText: { fontSize: 13, fontWeight: "700" },
  pinTextIdle: { color: colors.primary },
  pinTextActive: { color: "#FFFFFF" },
  locateBtn: {
    position: "absolute",
    right: theme.spacing.screen,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    ...theme.shadow.md,
  },
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.surface,
    borderTopLeftRadius: theme.radius.lg,
    borderTopRightRadius: theme.radius.lg,
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
    ...theme.shadow.lg,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 999,
    backgroundColor: colors.border,
    alignSelf: "center",
  },
  sheetRow: { flexDirection: "row", gap: theme.spacing.md, alignItems: "center" },
  sheetThumb: {
    width: 92,
    height: 70,
    borderRadius: theme.radius.field,
    backgroundColor: colors.primary100,
  },
  sheetTitle: { fontSize: 16, fontWeight: "700", color: colors.text },
  sheetMeta: { fontSize: 13, color: colors.textMuted },
  sheetPrice: { fontSize: 16, fontWeight: "700", color: colors.text, marginTop: 2 },
  sheetPer: { fontSize: 13, fontWeight: "400", color: colors.textMuted },
  fallback: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: theme.spacing.xxl,
    gap: theme.spacing.md,
  },
  fallbackIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primary100,
    alignItems: "center",
    justifyContent: "center",
  },
  fallbackTitle: { fontSize: 18, fontWeight: "700", color: colors.text, textAlign: "center" },
  fallbackText: { fontSize: 14, color: colors.textMuted, textAlign: "center", lineHeight: 20 },
});
