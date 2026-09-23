import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  View,
  Text,
  TextInput,
  ScrollView,
  FlatList,
  TouchableOpacity,
  StatusBar,
  RefreshControl,
  Modal,
  Platform,
} from "react-native";
import {
  useApp,
  Icon,
  Chip,
  Button,
  SectionLabel,
  EmptyState,
  VerifyIdentityBanner,
  useFavoritos,
} from "@rentacar/mobile-shared";
import { CarCard, CarCardSkeleton } from "../components/CarCard";

const CATEGORIES = [
  { id: "Todos", cat: null, icon: "grid" },
  { id: "Económico", cat: "economico", icon: "car" },
  { id: "Sedán", cat: "sedan", icon: "car" },
  { id: "SUV", cat: "suv", icon: "shield" },
  { id: "Camioneta", cat: "camioneta", icon: "truck" },
  { id: "Premium", cat: "premium", icon: "star" },
];

// Palabras clave de respaldo para autos publicados antes de que existiera
// el campo `categoria` (o que el dueño dejó sin elegir).
const CAT_KEYWORDS = {
  suv: ["rav4", "tucson", "jimny", "sportage", "cr-v", "crv", "tiguan", "kicks", "seltos", "corolla cross"],
  camioneta: ["hilux", "ranger", "amarok", "l200", "frontier", "d-max", "dmax", "colorado"],
};

const TRANSMISIONES = [
  { v: null, label: "Todas" },
  { v: "automatica", label: "Automática" },
  { v: "mecanica", label: "Mecánica" },
];
const COMBUSTIBLES = [
  { v: null, label: "Todos" },
  { v: "bencina", label: "Bencina" },
  { v: "diesel", label: "Diésel" },
  { v: "hibrido", label: "Híbrido" },
  { v: "electrico", label: "Eléctrico" },
];
const ORDENES = [
  { v: "recientes", label: "Más recientes" },
  { v: "precio_asc", label: "Menor precio" },
  { v: "precio_desc", label: "Mayor precio" },
  { v: "calificacion", label: "Mejor calificados" },
];

const FILTROS_VACIOS = { tarifaMax: "", transmision: null, combustible: null };

// Clave de persistencia de filtros, por usuario: al cambiar de pestaña el
// marketplace se desmonta y sin esto se perdía categoría, orden, búsqueda
// y filtros elegidos.
const FILTROS_STORAGE_PREFIX = "marketplace_filtros_state";

// Tope discreto del slider de precio.
const PASO_PRECIO = 5000;
const PRECIO_MIN_FALLBACK = 10000;
const PRECIO_MAX_FALLBACK = 100000;
const aTope = (n, fn) => fn(n / PASO_PRECIO) * PASO_PRECIO;

// Rango real del slider = min/max de la flota cargada, redondeado al tope.
function rangoPreciosFlota(cars) {
  const precios = (cars || []).map((c) => c.tarifa_dia).filter((n) => Number.isFinite(n) && n > 0);
  if (precios.length < 2) return { min: PRECIO_MIN_FALLBACK, max: PRECIO_MAX_FALLBACK };
  const min = Math.max(PASO_PRECIO, aTope(Math.min(...precios), Math.floor));
  const max = aTope(Math.max(...precios), Math.ceil);
  return max > min ? { min, max } : { min: PRECIO_MIN_FALLBACK, max: PRECIO_MAX_FALLBACK };
}

function contarFiltrosActivos(f) {
  let n = 0;
  if (f.tarifaMax) n += 1;
  if (f.transmision) n += 1;
  if (f.combustible) n += 1;
  return n;
}

// Predicado único de filtrado, compartido por la lista y por el contador de
// resultados del modal (así "Aplicar · N autos" y lo que se ve coinciden).
function autoCoincide(car, { q, catActiva, tarifaMax, transmision, combustible, currentUserId }) {
  if (currentUserId && (car.dueno_id === currentUserId || car.usuario_id === currentUserId)) {
    return false;
  }
  if (q) {
    const hay = `${car.marca} ${car.modelo} ${car.ubicacion_base || ""} ${car.comuna || ""}`.toLowerCase();
    if (!hay.includes(q)) return false;
  }
  if (catActiva) {
    if (car.categoria) {
      if (car.categoria !== catActiva) return false;
    } else if (catActiva === "economico") {
      if (!((car.tarifa_dia || 0) > 0 && car.tarifa_dia <= 35000)) return false;
    } else if (CAT_KEYWORDS[catActiva]) {
      if (!CAT_KEYWORDS[catActiva].some((m) => car.modelo?.toLowerCase().includes(m))) return false;
    }
  }
  if (tarifaMax && (car.tarifa_dia || 0) > tarifaMax) return false;
  if (transmision && car.transmision !== transmision) return false;
  if (combustible && car.combustible !== combustible) return false;
  return true;
}

/** Ordena una copia — nunca muta el array que viene del contexto. */
function ordenarAutos(autos, orden) {
  const copia = [...autos];
  switch (orden) {
    case "precio_asc":
      return copia.sort((a, b) => (a.tarifa_dia || 0) - (b.tarifa_dia || 0));
    case "precio_desc":
      return copia.sort((a, b) => (b.tarifa_dia || 0) - (a.tarifa_dia || 0));
    case "calificacion":
      // Sin calificaciones al final, no primero: un 0 implícito los pondría
      // arriba de dueños con buena reputación si se ordenara ingenuo.
      return copia.sort((a, b) => (b.rating_promedio ?? -1) - (a.rating_promedio ?? -1));
    case "recientes":
    default:
      return copia.sort((a, b) => {
        const fa = a.fecha_publicacion ? new Date(a.fecha_publicacion).getTime() : 0;
        const fb = b.fecha_publicacion ? new Date(b.fecha_publicacion).getTime() : 0;
        return fb - fa;
      });
  }
}

// Slider de tarifa máxima — mismo patrón PanResponder que el wizard del dueño.
// El tope máximo equivale a "sin límite" (tarifaMax = "").
function SliderPrecio({ min, max, valor, onChange }) {
  const anchoRef = useRef(0);
  const [ancho, setAncho] = useState(0);
  const actual = valor ? Math.min(max, Math.max(min, valor)) : max;
  const sinLimite = !valor || actual >= max;

  const fijarPorX = (x) => {
    const w = anchoRef.current;
    if (!w) return;
    const frac = Math.min(1, Math.max(0, x / w));
    const bruto = min + frac * (max - min);
    const escalonado = Math.round(bruto / PASO_PRECIO) * PASO_PRECIO;
    onChange(escalonado >= max ? "" : String(escalonado));
  };

  // Sistema de responder nativo del View (sin PanResponder): basta para un
  // deslizador de un eje y es directamente verificable.
  const responder = {
    onStartShouldSetResponder: () => true,
    onMoveShouldSetResponder: () => true,
    onResponderGrant: (e) => fijarPorX(e.nativeEvent.locationX),
    onResponderMove: (e) => fijarPorX(e.nativeEvent.locationX),
  };

  const pos = max > min ? ((actual - min) / (max - min)) * 100 : 100;

  return (
    <View>
      <View className="mt-2">
        <Text className="text-[15px] font-bold text-textDark">
          {sinLimite ? "Sin límite" : `Hasta $${actual.toLocaleString("es-CL")}`}
        </Text>
      </View>
      <View
        className="py-3"
        testID="filtro-slider-precio"
        onLayout={(e) => {
          anchoRef.current = e.nativeEvent.layout.width;
          setAncho(e.nativeEvent.layout.width);
        }}
        {...responder}
      >
        <View className="h-2 rounded-full bg-slate-200 justify-center relative">
          <View className="absolute left-0 top-0 bottom-0 rounded-full bg-primary" style={{ width: `${pos}%` }} />
          {ancho > 0 && <View className="absolute w-[26px] h-[26px] rounded-full -ml-[13px] bg-white border-[3px] border-primary shadow-sm" style={{ left: `${pos}%` }} />}
        </View>
      </View>
      <View className="flex-row justify-between">
        <Text className="text-xs text-textMuted">${min.toLocaleString("es-CL")}</Text>
        <Text className="text-xs text-textMuted">${max.toLocaleString("es-CL")}+</Text>
      </View>
    </View>
  );
}

function ModalFiltros({ visible, valor, cars, q, catActiva, currentUserId, onCambiar, onCerrar, onLimpiar, orden, onCambiarOrden }) {
  // Borrador local: "Aplicar" confirma de una vez, no filtro tecla a tecla.
  // El orden es distinto: se aplica al toque, no necesita confirmación.
  const [borrador, setBorrador] = useState(valor);
  React.useEffect(() => {
    if (visible) setBorrador(valor);
  }, [visible, valor]);

  const { min, max } = useMemo(() => rangoPreciosFlota(cars), [cars]);

  // Cuántos autos calzarían si se aplicara el borrador actual (para el CTA).
  const nResultados = useMemo(() => {
    const tarifaMax = borrador.tarifaMax ? parseInt(borrador.tarifaMax, 10) : null;
    return (cars || []).filter((c) =>
      autoCoincide(c, { q, catActiva, tarifaMax, transmision: borrador.transmision, combustible: borrador.combustible, currentUserId })
    ).length;
  }, [cars, q, catActiva, borrador, currentUserId]);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onCerrar}>
      <View className="flex-1 bg-black/80 justify-end">
        <View className="bg-white rounded-t-2xl max-h-[85%] p-5 pb-8 gap-3">
          <View className="w-10 h-1 rounded-full bg-border self-center" />
          <View className="flex-row items-center justify-between pb-3 border-b border-border">
            <Text className="text-[17px] font-bold text-textDark">Filtros y orden</Text>
            <TouchableOpacity onPress={onCerrar} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Icon name="close" size={18} color="#64748B" />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            <SectionLabel>Ordenar por</SectionLabel>
            <View className="flex-row flex-wrap gap-2 mt-2">
              {ORDENES.map((o) => (
                <Chip
                  key={o.v}
                  label={o.label}
                  selected={orden === o.v}
                  onPress={() => onCambiarOrden(o.v)}
                />
              ))}
            </View>

            <SectionLabel className="mt-4">Tarifa máxima por día</SectionLabel>
            <SliderPrecio
              min={min}
              max={max}
              valor={borrador.tarifaMax ? parseInt(borrador.tarifaMax, 10) : null}
              onChange={(t) => setBorrador((p) => ({ ...p, tarifaMax: t }))}
            />

            <SectionLabel className="mt-4">Transmisión</SectionLabel>
            <View className="flex-row flex-wrap gap-2 mt-2">
              {TRANSMISIONES.map((o) => (
                <Chip
                  key={o.label}
                  label={o.label}
                  selected={borrador.transmision === o.v}
                  onPress={() => setBorrador((p) => ({ ...p, transmision: o.v }))}
                />
              ))}
            </View>

            <SectionLabel className="mt-4">Combustible</SectionLabel>
            <View className="flex-row flex-wrap gap-2 mt-2">
              {COMBUSTIBLES.map((o) => (
                <Chip
                  key={o.label}
                  label={o.label}
                  selected={borrador.combustible === o.v}
                  onPress={() => setBorrador((p) => ({ ...p, combustible: o.v }))}
                />
              ))}
            </View>
          </ScrollView>

          <View className="flex-row gap-3 pt-2">
            <Button
              variant="secondary"
              label="Limpiar"
              onPress={() => {
                setBorrador(FILTROS_VACIOS);
                onLimpiar();
              }}
              fullWidth={false}
              className="flex-1"
            />
            <Button
              label={`Aplicar · ${nResultados} ${nResultados === 1 ? "auto" : "autos"}`}
              onPress={() => onCambiar(borrador)}
              fullWidth={false}
              className="flex-[1.6]"
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

export function MarketplaceScreen({ onSelectCar, onOpenMap, onOpenFavorites, onVerifyIdentity, onOpenActiveRental }) {
  const { cars, carsError, currentUser, loadData, loading, activeReservation } = useApp();
  const { esFavorito, favoritoIds, toggle: toggleFavorito } = useFavoritos();
  const identidadVerificada = currentUser?.estado_documentos === "verificado";
  const [category, setCategory] = useState("Todos");
  const [query, setQuery] = useState("");
  const [filtros, setFiltros] = useState(FILTROS_VACIOS);
  const [orden, setOrden] = useState("recientes");
  const [modalAbierto, setModalAbierto] = useState(false);
  // Alto real del header de la lista (banner de arriendo activo, verificación
  // de identidad, contador) — varía según esos estados. Se mide con onLayout
  // para que `getItemLayout` calcule bien el offset de cada fila.
  const [headerAltura, setHeaderAltura] = useState(0);

  // Filtros persistentes: se restauran al volver a la pestaña y se guardan
  // ante cada cambio. La clave lleva el id del usuario para que cada cuenta
  // recuerde sus propios filtros en el mismo dispositivo.
  const filtrosStorageKey = `${FILTROS_STORAGE_PREFIX}:${currentUser?.id || "anon"}`;
  const [filtrosRestaurados, setFiltrosRestaurados] = useState(false);
  useEffect(() => {
    let vivo = true;
    AsyncStorage.getItem(filtrosStorageKey)
      .then((crudo) => {
        if (!vivo || !crudo) return;
        try {
          const estado = JSON.parse(crudo);
          if (CATEGORIES.some((c) => c.id === estado?.category)) setCategory(estado.category);
          if (typeof estado?.query === "string") setQuery(estado.query);
          if (ORDENES.some((o) => o.v === estado?.orden)) setOrden(estado.orden);
          if (estado?.filtros) {
            setFiltros({
              ...FILTROS_VACIOS,
              tarifaMax: String(estado.filtros.tarifaMax || ""),
              transmision:
                TRANSMISIONES.some((t) => t.v === estado.filtros.transmision)
                  ? estado.filtros.transmision
                  : null,
              combustible:
                COMBUSTIBLES.some((c) => c.v === estado.filtros.combustible)
                  ? estado.filtros.combustible
                  : null,
            });
          }
        } catch {
          /* crudo corrupto: sigue con los valores por defecto */
        }
      })
      .catch(() => {})
      .finally(() => {
        if (vivo) setFiltrosRestaurados(true);
      });
    return () => {
      vivo = false;
    };
  }, [filtrosStorageKey]);

  useEffect(() => {
    if (!filtrosRestaurados) return;
    // Debounce: sin esto, cada tecla en el buscador escribía a AsyncStorage.
    const timer = setTimeout(() => {
      AsyncStorage.setItem(
        filtrosStorageKey,
        JSON.stringify({ category, query, filtros, orden })
      ).catch(() => {});
    }, 400);
    return () => clearTimeout(timer);
  }, [category, query, filtros, orden, filtrosRestaurados, filtrosStorageKey]);

  const q = query.trim().toLowerCase();
  const catActiva = CATEGORIES.find((c) => c.id === category)?.cat || null;
  const tarifaMaxNum = filtros.tarifaMax ? parseInt(filtros.tarifaMax, 10) : null;

  const filteredCars = useMemo(() => {
    const currentUserId = currentUser?.id;
    const base = (cars || []).filter((car) =>
      autoCoincide(car, {
        q,
        catActiva,
        tarifaMax: tarifaMaxNum,
        transmision: filtros.transmision,
        combustible: filtros.combustible,
        currentUserId,
      })
    );
    return ordenarAutos(base, orden);
  }, [cars, q, catActiva, tarifaMaxNum, filtros.transmision, filtros.combustible, orden, currentUser?.id]);

  const primerNombre = (currentUser?.nombre || "").split(" ")[0];
  const filtrosActivos = contarFiltrosActivos(filtros);
  const hayFiltrosOOrden = filtrosActivos > 0 || orden !== "recientes";

  // Skeleton solo en la PRIMERA carga (sin autos y sin error todavía).
  const cargandoInicial = !!loading && !(cars || []).length && !carsError;
  // Distingue "no calza con filtros" (hay autos) de "no hay autos" (lista vacía).
  const hayResultadosSinFiltros = (cars || []).length > 0;

  const limpiarTodo = () => {
    setFiltros(FILTROS_VACIOS);
    setOrden("recientes");
  };

  // Lista virtualizada: con muchos autos, ScrollView + map renderizaba todos
  // los CarCard de una vez (costo cuadrático con el buscador) y FlatList solo
  // pinta los visibles. El callback es estable para que React.memo de CarCard
  // evite redibujar toda la lista cuando cambia el contexto.
  const renderCar = useCallback(
    ({ item }) => (
      <View className="mb-3">
        <CarCard
          car={item}
          onPress={() => onSelectCar(item)}
          esFavorito={esFavorito(item.id || item._id)}
          onToggleFavorito={(c) => toggleFavorito(c.id || c._id)}
        />
      </View>
    ),
    [onSelectCar, esFavorito, toggleFavorito]
  );

  // getItemLayout: CarCard tiene alto fijo (104) + el margen inferior de cada
  // fila, así FlatList no necesita medir cada celda para virtualizar/scrollear.
  // Depende del alto medido del header porque este va dentro de
  // ListHeaderComponent (banner de arriendo activo / verificación / contador,
  // que cambian de alto según el estado del usuario).
  const ROW_ALTURA = 104 + 12;
  const getItemLayout = useCallback(
    (_data, index) => ({
      length: ROW_ALTURA,
      offset: 16 + headerAltura + ROW_ALTURA * index,
      index,
    }),
    [headerAltura, ROW_ALTURA]
  );

  return (
    <View className="flex-1 bg-background">
      <StatusBar barStyle="dark-content" />

      <View className="px-4 pt-2 pb-3 gap-3 border-b border-border">
        <View className="flex-row items-center gap-3">
          <View className="flex-1">
            <Text className="text-[22px] font-bold text-textDark tracking-[-0.3px]">
              {primerNombre ? `Hola, ${primerNombre}` : "Explorar autos"}
            </Text>
            <Text className="text-sm text-textMuted mt-0.5">¿A dónde vas esta vez?</Text>
          </View>
          {onOpenFavorites ? (
            <TouchableOpacity
              className="w-10 h-10 rounded-full mr-2 items-center justify-center bg-teal-50"
              onPress={onOpenFavorites}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Ver mis favoritos"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Icon name="heart" size={18} color="#0F766E" />
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity
            className="flex-row items-center gap-1 py-2 px-3.5 rounded-full bg-teal-50"
            onPress={onOpenMap}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Abrir el mapa"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Icon name="pin" size={16} color="#0F766E" />
            <Text className="text-sm font-semibold text-primary">Mapa</Text>
          </TouchableOpacity>
        </View>

        <View className="flex-row items-center gap-2">
          <View className="h-11 border-[1.5px] border-border rounded-full bg-white flex-row items-center gap-2 px-4 flex-1">
            <Icon name="search" size={17} color="#64748B" />
            <TextInput
              className="flex-1 text-[15px] text-textDark"
              value={query}
              onChangeText={setQuery}
              placeholder="Marca, modelo o comuna"
              placeholderTextColor="#94A3B8"
              returnKeyType="search"
            />
            {query ? (
              <TouchableOpacity onPress={() => setQuery("")} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Icon name="close" size={16} color="#64748B" />
              </TouchableOpacity>
            ) : null}
          </View>

          <TouchableOpacity
            className={`w-11 h-11 rounded-full border-[1.5px] items-center justify-center relative ${
              hayFiltrosOOrden ? "bg-primary border-primary" : "border-border bg-white"
            }`}
            onPress={() => setModalAbierto(true)}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={
              filtrosActivos > 0 ? `Filtros, ${filtrosActivos} activos` : "Filtros y orden"
            }
          >
            <Icon name="filter" size={18} color={hayFiltrosOOrden ? "#FFFFFF" : "#0F766E"} />
            {filtrosActivos > 0 ? (
              <View className="absolute -top-1 -right-1 min-w-[18px] h-[18px] rounded-full px-1 bg-danger items-center justify-center border-2 border-background">
                <Text className="text-[10px] font-bold text-white">{filtrosActivos}</Text>
              </View>
            ) : null}
          </TouchableOpacity>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerClassName="gap-2 pr-4"
        >
          {CATEGORIES.map((c) => (
            <Chip
              key={c.id}
              label={c.id}
              iconLeft={c.icon}
              selected={category === c.id}
              onPress={() => setCategory(c.id)}
            />
          ))}
        </ScrollView>

        {hayFiltrosOOrden && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerClassName="gap-2 pr-4"
          >
            {orden !== "recientes" && (
              <TouchableOpacity
                className="flex-row items-center gap-1.5 py-1.5 px-3 rounded-full bg-teal-50"
                onPress={() => setOrden("recientes")}
                activeOpacity={0.8}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityRole="button"
                accessibilityLabel={`Quitar el orden: ${ORDENES.find((o) => o.v === orden)?.label}`}
              >
                <Text className="text-xs font-semibold text-primary">{ORDENES.find((o) => o.v === orden)?.label}</Text>
                <Icon name="close" size={12} color="#0F766E" />
              </TouchableOpacity>
            )}
            {filtros.tarifaMax ? (
              <TouchableOpacity
                className="flex-row items-center gap-1.5 py-1.5 px-3 rounded-full bg-teal-50"
                onPress={() => setFiltros((p) => ({ ...p, tarifaMax: "" }))}
                activeOpacity={0.8}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityRole="button"
                accessibilityLabel={`Quitar el filtro: hasta $${parseInt(filtros.tarifaMax, 10).toLocaleString("es-CL")}`}
              >
                <Text className="text-xs font-semibold text-primary">
                  Hasta ${parseInt(filtros.tarifaMax, 10).toLocaleString("es-CL")}
                </Text>
                <Icon name="close" size={12} color="#0F766E" />
              </TouchableOpacity>
            ) : null}
            {filtros.transmision ? (
              <TouchableOpacity
                className="flex-row items-center gap-1.5 py-1.5 px-3 rounded-full bg-teal-50"
                onPress={() => setFiltros((p) => ({ ...p, transmision: null }))}
                activeOpacity={0.8}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityRole="button"
                accessibilityLabel="Quitar el filtro de transmisión"
              >
                <Text className="text-xs font-semibold text-primary">
                  {TRANSMISIONES.find((t) => t.v === filtros.transmision)?.label}
                </Text>
                <Icon name="close" size={12} color="#0F766E" />
              </TouchableOpacity>
            ) : null}
            {filtros.combustible ? (
              <TouchableOpacity
                className="flex-row items-center gap-1.5 py-1.5 px-3 rounded-full bg-teal-50"
                onPress={() => setFiltros((p) => ({ ...p, combustible: null }))}
                activeOpacity={0.8}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityRole="button"
                accessibilityLabel="Quitar el filtro de combustible"
              >
                <Text className="text-xs font-semibold text-primary">
                  {COMBUSTIBLES.find((c) => c.v === filtros.combustible)?.label}
                </Text>
                <Icon name="close" size={12} color="#0F766E" />
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity
              onPress={limpiarTodo}
              className="justify-center px-1"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityRole="button"
              accessibilityLabel="Limpiar todos los filtros"
            >
              <Text className="text-xs font-semibold text-textMuted underline">Limpiar todo</Text>
            </TouchableOpacity>
          </ScrollView>
        )}
      </View>

      <FlatList
        data={filteredCars}
        keyExtractor={(car) => String(car.id || car._id)}
        renderItem={renderCar}
        getItemLayout={getItemLayout}
        ListHeaderComponent={() => (
          <View onLayout={(e) => setHeaderAltura(e.nativeEvent.layout.height)}>
            {activeReservation && (activeReservation.estado === "en_curso" || activeReservation.estado === "confirmada") && (
              <TouchableOpacity
                className="flex-row items-center gap-3 bg-teal-950 rounded-2xl p-4 mb-4"
                onPress={onOpenActiveRental}
                activeOpacity={0.9}
                accessibilityRole="button"
                accessibilityLabel="Ver mi arriendo"
              >
                <Icon name="key" size={18} color="#FFFFFF" />
                <View className="flex-1">
                  <Text className="text-sm font-bold text-white">
                    {activeReservation.estado === "en_curso" ? "Tienes un arriendo en curso" : "Tienes una reserva confirmada"}
                  </Text>
                  <Text className="text-xs text-teal-200 mt-0.5">Toca para ver los detalles</Text>
                </View>
                <Icon name="chevron-right" size={18} color="#FFFFFF" />
              </TouchableOpacity>
            )}

            {!identidadVerificada && (
              <View className="mb-4">
                <VerifyIdentityBanner role="renter" onPress={onVerifyIdentity} />
              </View>
            )}

            {filteredCars.length > 0 && (
              <Text className="text-[13px] text-textMuted mb-3 font-medium">
                {filteredCars.length} {filteredCars.length === 1 ? "auto disponible" : "autos disponibles"}
              </Text>
            )}
          </View>
        )}
        ListEmptyComponent={
          cargandoInicial ? (
            // Primera carga sin datos aún: silueta de la lista.
            <>
              {[0, 1, 2, 3].map((i) => (
                <View key={i} className="mb-4">
                  <CarCardSkeleton />
                </View>
              ))}
            </>
          ) : carsError && !(cars || []).length ? (
            // El backend respondió con error: los filtros quedan guardados.
            <View className="rounded-2xl bg-red-50 border border-red-200 p-4 gap-2">
              <Text className="text-[15px] font-bold text-red-700">No pudimos cargar los autos</Text>
              <Text className="text-sm leading-5 text-red-700">
                {carsError} Revisa tu conexión; tus filtros quedan guardados.
              </Text>
              <TouchableOpacity className="self-start mt-1 px-4 py-2.5 rounded-xl bg-danger" onPress={loadData} activeOpacity={0.85}>
                <Text className="text-sm font-bold text-white">Reintentar</Text>
              </TouchableOpacity>
            </View>
          ) : hayResultadosSinFiltros ? (
            // Hay autos, pero ninguno calza con la búsqueda/filtros del usuario.
            <EmptyState
              icon="search"
              title="Ningún auto calza con tus filtros"
              message="Prueba subir la tarifa máxima, cambiar el tipo de combustible o limpiar la búsqueda."
              action="Limpiar filtros"
              onAction={() => {
                setQuery("");
                setCategory("Todos");
                limpiarTodo();
              }}
            />
          ) : (
            // No hay autos publicados en absoluto (o la zona no tiene).
            <EmptyState
              icon="car"
              title="Todavía no hay autos en tu zona"
              message="Aún no hay vehículos publicados cerca. Revisa el mapa o vuelve a intentarlo en unos días."
              action="Ver el mapa"
              onAction={onOpenMap}
            />
          )
        }
        contentContainerClassName="p-4 pb-12"
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        refreshControl={
          <RefreshControl refreshing={!!loading} onRefresh={loadData} tintColor="#0F766E" />
        }
        initialNumToRender={8}
        maxToRenderPerBatch={8}
        windowSize={7}
        updateCellsBatchingPeriod={50}
        extraData={favoritoIds}
        removeClippedSubviews={Platform.OS === "android"}
      />

      <ModalFiltros
        visible={modalAbierto}
        valor={filtros}
        cars={cars}
        q={q}
        catActiva={catActiva}
        currentUserId={currentUser?.id}
        orden={orden}
        onCambiarOrden={setOrden}
        onCambiar={(nuevo) => {
          setFiltros(nuevo);
          setModalAbierto(false);
        }}
        onCerrar={() => setModalAbierto(false)}
        onLimpiar={() => {
          setFiltros(FILTROS_VACIOS);
          setModalAbierto(false);
        }}
      />
    </View>
  );
}
