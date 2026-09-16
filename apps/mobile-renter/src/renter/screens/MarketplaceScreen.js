import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  View,
  Text,
  StyleSheet,
TextInput,
  ScrollView,
  FlatList,
  TouchableOpacity,
  StatusBar,
  RefreshControl,
  Modal,
} from "react-native";
import {
  colors,
  theme,
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
function autoCoincide(car, { q, catActiva, tarifaMax, transmision, combustible }) {
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
      <View style={styles.sliderCabecera}>
        <Text style={styles.sliderValor}>
          {sinLimite ? "Sin límite" : `Hasta $${actual.toLocaleString("es-CL")}`}
        </Text>
      </View>
      <View
        style={styles.sliderZona}
        testID="filtro-slider-precio"
        onLayout={(e) => {
          anchoRef.current = e.nativeEvent.layout.width;
          setAncho(e.nativeEvent.layout.width);
        }}
        {...responder}
      >
        <View style={styles.sliderTrack}>
          <View style={[styles.sliderFill, { width: `${pos}%` }]} />
          {ancho > 0 && <View style={[styles.sliderThumb, { left: `${pos}%` }]} />}
        </View>
      </View>
      <View style={styles.sliderExtremos}>
        <Text style={styles.sliderExtremo}>${min.toLocaleString("es-CL")}</Text>
        <Text style={styles.sliderExtremo}>${max.toLocaleString("es-CL")}+</Text>
      </View>
    </View>
  );
}

function ModalFiltros({ visible, valor, cars, q, catActiva, onCambiar, onCerrar, onLimpiar, orden, onCambiarOrden }) {
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
      autoCoincide(c, { q, catActiva, tarifaMax, transmision: borrador.transmision, combustible: borrador.combustible })
    ).length;
  }, [cars, q, catActiva, borrador]);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onCerrar}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Filtros y orden</Text>
            <TouchableOpacity onPress={onCerrar} hitSlop={theme.control.hitSlop}>
              <Icon name="close" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            <SectionLabel>Ordenar por</SectionLabel>
            <View style={styles.chipsRow}>
              {ORDENES.map((o) => (
                <Chip
                  key={o.v}
                  label={o.label}
                  selected={orden === o.v}
                  onPress={() => onCambiarOrden(o.v)}
                />
              ))}
            </View>

            <SectionLabel style={{ marginTop: theme.spacing.lg }}>Tarifa máxima por día</SectionLabel>
            <SliderPrecio
              min={min}
              max={max}
              valor={borrador.tarifaMax ? parseInt(borrador.tarifaMax, 10) : null}
              onChange={(t) => setBorrador((p) => ({ ...p, tarifaMax: t }))}
            />

            <SectionLabel style={{ marginTop: theme.spacing.lg }}>Transmisión</SectionLabel>
            <View style={styles.chipsRow}>
              {TRANSMISIONES.map((o) => (
                <Chip
                  key={o.label}
                  label={o.label}
                  selected={borrador.transmision === o.v}
                  onPress={() => setBorrador((p) => ({ ...p, transmision: o.v }))}
                />
              ))}
            </View>

            <SectionLabel style={{ marginTop: theme.spacing.lg }}>Combustible</SectionLabel>
            <View style={styles.chipsRow}>
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

          <View style={styles.sheetFooter}>
            <Button
              variant="secondary"
              label="Limpiar"
              onPress={() => {
                setBorrador(FILTROS_VACIOS);
                onLimpiar();
              }}
              fullWidth={false}
              style={{ flex: 1 }}
            />
            <Button
              label={`Aplicar · ${nResultados} ${nResultados === 1 ? "auto" : "autos"}`}
              onPress={() => onCambiar(borrador)}
              fullWidth={false}
              style={{ flex: 1.6 }}
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
    AsyncStorage.setItem(
      filtrosStorageKey,
      JSON.stringify({ category, query, filtros, orden })
    ).catch(() => {});
  }, [category, query, filtros, orden, filtrosRestaurados, filtrosStorageKey]);

  const q = query.trim().toLowerCase();
  const catActiva = CATEGORIES.find((c) => c.id === category)?.cat || null;
  const tarifaMaxNum = filtros.tarifaMax ? parseInt(filtros.tarifaMax, 10) : null;

  const filteredCars = useMemo(() => {
    const base = (cars || []).filter((car) =>
      autoCoincide(car, {
        q,
        catActiva,
        tarifaMax: tarifaMaxNum,
        transmision: filtros.transmision,
        combustible: filtros.combustible,
      })
    );
    return ordenarAutos(base, orden);
  }, [cars, q, catActiva, tarifaMaxNum, filtros.transmision, filtros.combustible, orden]);

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
      <View style={{ marginBottom: theme.spacing.md }}>
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
  const ROW_ALTURA = 104 + theme.spacing.md;
  const getItemLayout = useCallback(
    (_data, index) => ({
      length: ROW_ALTURA,
      offset: theme.spacing.screen + headerAltura + ROW_ALTURA * index,
      index,
    }),
    [headerAltura, ROW_ALTURA]
  );

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
          {onOpenFavorites ? (
            <TouchableOpacity
              style={styles.favIconBtn}
              onPress={onOpenFavorites}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Ver mis favoritos"
              hitSlop={theme.control.hitSlop}
            >
              <Icon name="heart" size={18} color={colors.primary} />
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity
            style={styles.mapBtn}
            onPress={onOpenMap}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Abrir el mapa"
            hitSlop={theme.control.hitSlop}
          >
            <Icon name="pin" size={16} color={colors.primary} />
            <Text style={styles.mapBtnText}>Mapa</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.searchRow}>
          <View style={[styles.searchBar, { flex: 1 }]}>
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

          <TouchableOpacity
            style={[styles.filterBtn, hayFiltrosOOrden && styles.filterBtnActivo]}
            onPress={() => setModalAbierto(true)}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={
              filtrosActivos > 0 ? `Filtros, ${filtrosActivos} activos` : "Filtros y orden"
            }
          >
            <Icon name="filter" size={18} color={hayFiltrosOOrden ? "#FFFFFF" : colors.primary} />
            {filtrosActivos > 0 ? (
              <View style={styles.filterBadge}>
                <Text style={styles.filterBadgeText}>{filtrosActivos}</Text>
              </View>
            ) : null}
          </TouchableOpacity>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.chips}
        >
          {CATEGORIES.map((c) => (
            <Chip key={c.id} label={c.id} selected={category === c.id} onPress={() => setCategory(c.id)} />
          ))}
        </ScrollView>

        {hayFiltrosOOrden && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.chips}
          >
            {orden !== "recientes" && (
              <TouchableOpacity
                style={styles.activeChip}
                onPress={() => setOrden("recientes")}
                activeOpacity={0.8}
                hitSlop={theme.control.hitSlop}
                accessibilityRole="button"
                accessibilityLabel={`Quitar el orden: ${ORDENES.find((o) => o.v === orden)?.label}`}
              >
                <Text style={styles.activeChipText}>{ORDENES.find((o) => o.v === orden)?.label}</Text>
                <Icon name="close" size={12} color={colors.primary} />
              </TouchableOpacity>
            )}
            {filtros.tarifaMax ? (
              <TouchableOpacity
                style={styles.activeChip}
                onPress={() => setFiltros((p) => ({ ...p, tarifaMax: "" }))}
                activeOpacity={0.8}
                hitSlop={theme.control.hitSlop}
                accessibilityRole="button"
                accessibilityLabel={`Quitar el filtro: hasta $${parseInt(filtros.tarifaMax, 10).toLocaleString("es-CL")}`}
              >
                <Text style={styles.activeChipText}>
                  Hasta ${parseInt(filtros.tarifaMax, 10).toLocaleString("es-CL")}
                </Text>
                <Icon name="close" size={12} color={colors.primary} />
              </TouchableOpacity>
            ) : null}
            {filtros.transmision ? (
              <TouchableOpacity
                style={styles.activeChip}
                onPress={() => setFiltros((p) => ({ ...p, transmision: null }))}
                activeOpacity={0.8}
                hitSlop={theme.control.hitSlop}
                accessibilityRole="button"
                accessibilityLabel="Quitar el filtro de transmisión"
              >
                <Text style={styles.activeChipText}>
                  {TRANSMISIONES.find((t) => t.v === filtros.transmision)?.label}
                </Text>
                <Icon name="close" size={12} color={colors.primary} />
              </TouchableOpacity>
            ) : null}
            {filtros.combustible ? (
              <TouchableOpacity
                style={styles.activeChip}
                onPress={() => setFiltros((p) => ({ ...p, combustible: null }))}
                activeOpacity={0.8}
                hitSlop={theme.control.hitSlop}
                accessibilityRole="button"
                accessibilityLabel="Quitar el filtro de combustible"
              >
                <Text style={styles.activeChipText}>
                  {COMBUSTIBLES.find((c) => c.v === filtros.combustible)?.label}
                </Text>
                <Icon name="close" size={12} color={colors.primary} />
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity
              onPress={limpiarTodo}
              style={styles.limpiarTodoBtn}
              hitSlop={theme.control.hitSlop}
              accessibilityRole="button"
              accessibilityLabel="Limpiar todos los filtros"
            >
              <Text style={styles.limpiarTodoText}>Limpiar todo</Text>
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
                style={styles.activeRentalBanner}
                onPress={onOpenActiveRental}
                activeOpacity={0.9}
                accessibilityRole="button"
                accessibilityLabel="Ver mi arriendo"
              >
                <Icon name="key" size={18} color="#FFFFFF" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.activeRentalBannerTitle}>
                    {activeReservation.estado === "en_curso" ? "Tienes un arriendo en curso" : "Tienes una reserva confirmada"}
                  </Text>
                  <Text style={styles.activeRentalBannerSub}>Toca para ver los detalles</Text>
                </View>
                <Icon name="chevron-right" size={18} color="#FFFFFF" />
              </TouchableOpacity>
            )}

            {!identidadVerificada && (
              <View style={{ marginBottom: theme.spacing.lg }}>
                <VerifyIdentityBanner role="renter" onPress={onVerifyIdentity} />
              </View>
            )}

            {filteredCars.length > 0 && (
              <Text style={styles.count}>
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
                <View key={i} style={{ marginBottom: theme.spacing.lg }}>
                  <CarCardSkeleton />
                </View>
              ))}
            </>
          ) : carsError && !(cars || []).length ? (
            // El backend respondió con error: los filtros quedan guardados.
            <View style={styles.errorCard}>
              <Text style={styles.errorTitle}>No pudimos cargar los autos</Text>
              <Text style={styles.errorBody}>
                {carsError} Revisa tu conexión; tus filtros quedan guardados.
              </Text>
              <TouchableOpacity style={styles.errorBtn} onPress={loadData} activeOpacity={0.85}>
                <Text style={styles.errorBtnText}>Reintentar</Text>
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
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        refreshControl={
          <RefreshControl refreshing={!!loading} onRefresh={loadData} tintColor={colors.primary} />
        }
        initialNumToRender={6}
        windowSize={10}
        extraData={favoritoIds}
        removeClippedSubviews={false}
      />

      <ModalFiltros
        visible={modalAbierto}
        valor={filtros}
        cars={cars}
        q={q}
        catActiva={catActiva}
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

const styles = StyleSheet.create({
  activeRentalBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.md,
    backgroundColor: colors.primary900,
    borderRadius: theme.radius.card,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.lg,
  },
  activeRentalBannerTitle: { fontSize: 14, fontWeight: "700", color: "#FFFFFF" },
  activeRentalBannerSub: { fontSize: 12, color: colors.accent200, marginTop: 2 },
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
  favIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: theme.spacing.sm,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary100,
  },
  searchRow: { flexDirection: "row", alignItems: "center", gap: theme.spacing.sm },
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
  filterBtn: {
    width: theme.control.height,
    height: theme.control.height,
    borderRadius: theme.radius.pill,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  filterBtnActivo: { backgroundColor: colors.primary, borderColor: colors.primary },
  filterBadge: {
    position: "absolute",
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: colors.danger,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: colors.background,
  },
  filterBadgeText: { fontSize: 10, fontWeight: "700", color: "#FFFFFF" },
  chips: { gap: theme.spacing.sm, paddingRight: theme.spacing.screen },
  activeChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: theme.radius.pill,
    backgroundColor: colors.primary100,
  },
  activeChipText: { fontSize: 12, fontWeight: "600", color: colors.primary },
  limpiarTodoBtn: { justifyContent: "center", paddingHorizontal: 4 },
  limpiarTodoText: { fontSize: 12, fontWeight: "600", color: colors.textMuted, textDecorationLine: "underline" },
  list: { padding: theme.spacing.screen, paddingBottom: theme.spacing.xxxl },
  count: { fontSize: 13, color: colors.textMuted, marginBottom: theme.spacing.md, fontWeight: "500" },
  errorCard: {
    borderRadius: theme.radius.card,
    backgroundColor: colors.dangerBg,
    borderWidth: 1,
    borderColor: colors.dangerBorder,
    padding: theme.spacing.lg,
    gap: theme.spacing.sm,
  },
  errorTitle: { fontSize: 15, fontWeight: "700", color: colors.dangerText },
  errorBody: { fontSize: 14, lineHeight: 20, color: colors.dangerText },
  errorBtn: {
    alignSelf: "flex-start",
    marginTop: 4,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: theme.radius.field,
    backgroundColor: colors.danger,
  },
  errorBtnText: { fontSize: 14, fontWeight: "700", color: colors.textWhite },
  overlay: { flex: 1, backgroundColor: "rgba(6,30,31,0.8)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: theme.radius.lg,
    borderTopRightRadius: theme.radius.lg,
    maxHeight: "85%",
    padding: theme.spacing.xl,
    paddingBottom: theme.spacing.xxl,
    gap: theme.spacing.md,
  },
  handle: { width: 40, height: 4, borderRadius: 999, backgroundColor: colors.border, alignSelf: "center" },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  sheetTitle: { fontSize: 17, fontWeight: "700", color: colors.text },
  sliderCabecera: { marginTop: theme.spacing.sm },
  sliderValor: { fontSize: 15, fontWeight: "700", color: colors.text },
  sliderZona: { paddingVertical: 12 },
  sliderTrack: { height: 8, borderRadius: 999, backgroundColor: colors.surfaceSecondary, justifyContent: "center" },
  sliderFill: { position: "absolute", left: 0, top: 0, bottom: 0, borderRadius: 999, backgroundColor: colors.primary },
  sliderThumb: {
    position: "absolute",
    width: 26,
    height: 26,
    borderRadius: 13,
    marginLeft: -13,
    backgroundColor: "#FFFFFF",
    borderWidth: 3,
    borderColor: colors.primary,
    ...theme.shadow.sm,
  },
  sliderExtremos: { flexDirection: "row", justifyContent: "space-between" },
  sliderExtremo: { fontSize: 12, color: colors.textMuted },
  chipsRow: { flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.sm, marginTop: theme.spacing.sm },
  sheetFooter: { flexDirection: "row", gap: theme.spacing.md, paddingTop: theme.spacing.sm },
});
