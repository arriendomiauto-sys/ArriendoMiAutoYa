import React, { useMemo, useRef, useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp, Icon, Button, BackButton, Rating, showAlert, CarPhotoThumb } from "@rentacar/mobile-shared";

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

// Colores del pin según la categoría, para leer el mapa de un vistazo sin
// tocar cada punto.
const COLOR_CATEGORIA = {
  economico: "#B45309",
  sedan: "#0F766E",
  suv: "#7A4FBF",
  camioneta: "#B4642A",
  premium: "#1F2937",
};

function colorDeCategoria(categoria) {
  return COLOR_CATEGORIA[categoria] || "#0F766E";
}

// Mismas categorías que usa MarketplaceScreen, para que el filtro del mapa
// hable el mismo idioma que el de la lista.
const CATEGORIAS_MAPA = [
  { cat: "economico", label: "Económico" },
  { cat: "sedan", label: "Sedán" },
  { cat: "suv", label: "SUV" },
  { cat: "camioneta", label: "Camioneta" },
  { cat: "premium", label: "Premium" },
];

export function MapExploreScreen({ onBack, onSelectCar }) {
  const { cars, currentUser } = useApp();
  const insets = useSafeAreaInsets();
  const mapRef = useRef(null);
  const [userCoords, setUserCoords] = useState(null);
  const [permisoUbicacionDenegado, setPermisoUbicacionDenegado] = useState(false);
  const [errorUbicacion, setErrorUbicacion] = useState(false);
  // Antes la barra de arriba solo parecía un buscador (ícono de lupa +
  // texto "X autos en el mapa") pero no era más que un View decorativo: no
  // había ningún TextInput detrás, tocarla no hacía nada. Ahora sí filtra.
  const [query, setQuery] = useState("");
  const [categoriaFiltro, setCategoriaFiltro] = useState(null);

  // Solo los autos con coordenadas reales van al mapa.
  // Se excluyen los autos propios del usuario si está autenticado (BUG-027 UX).
  const { todosLosPuntos, sinUbicacion } = useMemo(() => {
    const conUbicacion = [];
    let sinCoords = 0;
    const uid = currentUser?.id;
    for (const car of cars || []) {
      if (uid && (car.dueno_id === uid || car.usuario_id === uid)) {
        continue;
      }
      if (typeof car.latitud === "number" && typeof car.longitud === "number") {
        conUbicacion.push({ car, coord: { latitude: car.latitud, longitude: car.longitud } });
      } else {
        sinCoords += 1;
      }
    }
    return { todosLosPuntos: conUbicacion, sinUbicacion: sinCoords };
  }, [cars, currentUser?.id]);

  // Búsqueda por marca/modelo + filtro de categoría (los chips de abajo),
  // sobre el total de autos con ubicación -- no hace falta salir al listado
  // para acotar qué se ve en el mapa.
  const puntos = useMemo(() => {
    const q = query.trim().toLowerCase();
    return todosLosPuntos.filter(({ car }) => {
      if (categoriaFiltro && car.categoria !== categoriaFiltro) return false;
      if (!q) return true;
      const nombre = `${car.marca || ""} ${car.modelo || ""}`.toLowerCase();
      return nombre.includes(q);
    });
  }, [todosLosPuntos, query, categoriaFiltro]);

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
        if (status !== "granted") {
          if (alive) setPermisoUbicacionDenegado(true);
          return;
        }
        // High (4), no Balanced (3): con ~100 m de error el "estás aquí"
        // aparece a dos cuadras y la distancia a cada auto sale mal.
        // Con timeout: en interiores o con GPS lento, getCurrentPositionAsync
        // puede tardar mucho o no resolver nunca — sin esto, el botón "mi
        // ubicación" quedaba oculto indefinidamente sin ningún aviso.
        const timeout = new Promise((_, reject) =>
          setTimeout(() => reject(new Error("timeout_ubicacion")), 10000)
        );
        const pos = await Promise.race([
          Location.getCurrentPositionAsync({ accuracy: Location.Accuracy?.High ?? 4 }),
          timeout,
        ]);
        if (!alive) return;
        setUserCoords({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
      } catch (e) {
        // sin ubicación: el mapa igual funciona centrado en la flota, pero
        // se deja rastro para poder avisar en el botón "mi ubicación".
        if (alive) setErrorUbicacion(true);
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
      <View className="flex-1 bg-background">
        <StatusBar barStyle="dark-content" />
        <View className="flex-1 items-center px-8 gap-3" style={{ paddingTop: insets.top + 40 }}>
          <View className="w-16 h-16 rounded-full bg-teal-50 items-center justify-center">
            <Icon name="pin" size={30} color="#0F766E" />
          </View>
          <Text className="text-lg font-bold text-textDark text-center">El mapa necesita la app instalada</Text>
          <Text className="text-sm text-textMuted text-center leading-5">
            La vista de mapa usa mapas nativos y no está disponible en la versión web.
            Abre la app en tu teléfono para explorar los autos en el mapa.
          </Text>
          <Button label="Volver al listado" onPress={onBack} fullWidth={false} className="mt-3" />
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background">
      <StatusBar barStyle="dark-content" />

      <MapView
        ref={mapRef}
        // Estilo explícito además de className: sin tamaño, el mapa quedaba de 0×0.
        style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
        initialRegion={initialRegion}
        showsUserLocation={!!userCoords}
        showsMyLocationButton={false}
        toolbarEnabled={false}
      >
        {puntos.map(({ car, coord }, i) => {
          const id = car.id || car._id || i;
          const active = id === (selected?.car?.id || selected?.car?._id);
          const color = colorDeCategoria(car.categoria);
          return (
            <Marker
              key={id}
              coordinate={coord}
              onPress={() => setSelectedId(car.id || car._id)}
              // tracksViewChanges en false congela el pin apenas se dibuja, y
              // el seleccionado se quedaba con el color del anterior. Se deja
              // vivo solo el activo, que es uno.
              tracksViewChanges={active}
              anchor={{ x: 0.5, y: 1 }}
              accessibilityLabel={`${car.marca} ${car.modelo}, ${precio(car.tarifa_dia)} por día`}
            >
              <View className="items-center">
                <View
                  className="py-1.5 px-3 rounded-full border-2 shadow-sm"
                  style={
                    active
                      ? { backgroundColor: color, borderColor: "#FFFFFF" }
                      : { backgroundColor: "#FFFFFF", borderColor: color }
                  }
                >
                  <Text className="text-[13px] font-bold" style={{ color: active ? "#FFFFFF" : color }}>
                    {precio(car.tarifa_dia)}
                  </Text>
                </View>
                {/* La punta ancla el globo al punto exacto: sin ella el precio
                    flota y no se sabe a qué coordenada corresponde. */}
                <View
                  className="w-0 h-0 -mt-px border-l-[5px] border-r-[5px] border-t-[7px] border-l-transparent border-r-transparent"
                  style={{ borderTopColor: active ? color : "#FFFFFF" }}
                />
              </View>
            </Marker>
          );
        })}
      </MapView>

      {/* Barra superior flotante. Antes esto era decorativo: tenía ícono de
          lupa y texto pero ningún TextInput detrás -- parecía un buscador y
          no hacía nada al tocarlo. Ahora filtra de verdad, y debajo se
          agregó una fila de categorías (mismo criterio que el listado) que
          además sirve de leyenda para los colores de los pines. */}
      <View className="absolute top-0 left-0 right-0" style={{ paddingTop: insets.top + 8 }}>
        <View className="flex-row items-center gap-2 px-4">
          <BackButton variant="overlay" onPress={onBack} className="shadow-md" />
          <View className="flex-1 h-11 rounded-full bg-white flex-row items-center gap-2 px-4 shadow-md">
            <Icon name="search" size={16} color="#64748B" />
            <TextInput
              className="flex-1 text-sm text-textDark font-medium"
              placeholder={
                (puntos.length === 1 ? "1 auto en el mapa" : `${puntos.length} autos en el mapa`) +
                (sinUbicacion > 0 ? ` · ${sinUbicacion} sin ubicación` : "")
              }
              placeholderTextColor="#94A3B8"
              value={query}
              onChangeText={setQuery}
              returnKeyType="search"
              accessibilityLabel="Buscar auto por marca o modelo"
            />
            {query ? (
              <TouchableOpacity
                onPress={() => setQuery("")}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityLabel="Borrar búsqueda"
              >
                <Icon name="close" size={14} color="#94A3B8" />
              </TouchableOpacity>
            ) : null}
          </View>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, gap: 8 }}
        >
          {CATEGORIAS_MAPA.map(({ cat, label }) => {
            const activo = categoriaFiltro === cat;
            return (
              <TouchableOpacity
                key={cat}
                className="flex-row items-center gap-1.5 h-8 pl-2.5 pr-3 rounded-full shadow-sm"
                style={{ backgroundColor: activo ? colorDeCategoria(cat) : "#FFFFFF" }}
                onPress={() => setCategoriaFiltro(activo ? null : cat)}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityState={{ selected: activo }}
                accessibilityLabel={`Filtrar por ${label}`}
              >
                <View
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: activo ? "#FFFFFF" : colorDeCategoria(cat) }}
                />
                <Text
                  className="text-xs font-semibold"
                  style={{ color: activo ? "#FFFFFF" : "#334155" }}
                >
                  {label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Botón mi ubicación */}
      {userCoords ? (
        <TouchableOpacity
          className="absolute right-4 w-11 h-11 rounded-full bg-white items-center justify-center shadow-md"
          style={{ bottom: (selected ? 208 : 40) + insets.bottom }}
          onPress={centrarEnUsuario}
          activeOpacity={0.85}
        >
          <Icon name="location" size={20} color="#0F766E" />
        </TouchableOpacity>
      ) : permisoUbicacionDenegado || errorUbicacion ? (
        // Sin esto, cuando el permiso se deniega (o falla el GPS) el botón
        // simplemente desaparecía sin ninguna explicación.
        <TouchableOpacity
          className="absolute right-4 w-11 h-11 rounded-full bg-white items-center justify-center shadow-md"
          style={{ bottom: (selected ? 208 : 40) + insets.bottom }}
          onPress={() =>
            showAlert(
              "Ubicación no disponible",
              permisoUbicacionDenegado
                ? "Activa el permiso de ubicación en los ajustes del teléfono para centrar el mapa en ti."
                : "No pudimos obtener tu ubicación. Revisa el GPS e inténtalo de nuevo."
            )
          }
          activeOpacity={0.85}
        >
          <Icon name="location" size={20} color="#94A3B8" />
        </TouchableOpacity>
      ) : null}

      {/* Tarjeta del auto seleccionado */}
      {selected ? (
        <View
          className="absolute left-0 right-0 bottom-0 bg-white rounded-t-2xl p-4 gap-3 shadow-lg"
          style={{ paddingBottom: Math.max(insets.bottom, 16) + 8 }}
        >
          <View className="w-10 h-1 rounded-full bg-border self-center" />
          <TouchableOpacity
            className="flex-row gap-3 items-center"
            activeOpacity={0.9}
            onPress={() => onSelectCar(selected.car)}
          >
            <CarPhotoThumb uri={selected.car.fotos?.[0]} className="w-[92px] h-[70px] rounded-xl" iconSize={24} />
            <View className="flex-1 gap-0.5">
              <Text className="text-base font-bold text-textDark" numberOfLines={1}>
                {selected.car.marca} {selected.car.modelo} {selected.car.anio || ""}
              </Text>
              <View className="flex-row items-center">
                <Rating
                  value={selected.car.rating_promedio}
                  count={selected.car.rating_cantidad}
                  size="sm"
                />
                {selected.car.ubicacion_base ? (
                  <Text className="text-[13px] text-textMuted shrink" numberOfLines={1}>
                    {` · ${selected.car.ubicacion_base}`}
                  </Text>
                ) : null}
              </View>
              <Text className="text-base font-bold text-textDark mt-0.5">
                {precio(selected.car.tarifa_dia)} <Text className="text-[13px] font-normal text-textMuted">/ día</Text>
              </Text>
            </View>
          </TouchableOpacity>
          <Button label="Ver auto" onPress={() => onSelectCar(selected.car)} />
        </View>
      ) : null}
    </View>
  );
}

