import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  RefreshControl,
  Modal,
  KeyboardAvoidingView,
  Platform,
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

function contarFiltrosActivos(f) {
  let n = 0;
  if (f.tarifaMax) n += 1;
  if (f.transmision) n += 1;
  if (f.combustible) n += 1;
  return n;
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

function ModalFiltros({ visible, valor, onCambiar, onCerrar, onLimpiar, orden, onCambiarOrden }) {
  // Borrador local: "Aplicar" confirma de una vez, no filtro tecla a tecla.
  // El orden es distinto: se aplica al toque, no necesita confirmación.
  const [borrador, setBorrador] = useState(valor);
  React.useEffect(() => {
    if (visible) setBorrador(valor);
  }, [visible, valor]);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onCerrar}>
      <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Filtros y orden</Text>
            <TouchableOpacity onPress={onCerrar} hitSlop={theme.control.hitSlop}>
              <Icon name="close" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
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
            <View style={styles.tarifaInputWrap}>
              <Text style={styles.tarifaPrefijo}>$</Text>
              <TextInput
                style={styles.tarifaInput}
                value={borrador.tarifaMax}
                onChangeText={(t) => setBorrador((p) => ({ ...p, tarifaMax: t.replace(/\D/g, "") }))}
                placeholder="Sin límite"
                placeholderTextColor={colors.textPlaceholder}
                keyboardType="number-pad"
              />
            </View>

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
              label="Aplicar"
              onPress={() => onCambiar(borrador)}
              fullWidth={false}
              style={{ flex: 1.4 }}
            />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export function MarketplaceScreen({ onSelectCar, onOpenMap, onOpenFavorites, onVerifyIdentity }) {
  const { cars, carsError, currentUser, loadData, loading } = useApp();
  const { esFavorito, toggle: toggleFavorito } = useFavoritos();
  const identidadVerificada = currentUser?.estado_documentos === "verificado";
  const [category, setCategory] = useState("Todos");
  const [query, setQuery] = useState("");
  const [filtros, setFiltros] = useState(FILTROS_VACIOS);
  const [orden, setOrden] = useState("recientes");
  const [modalAbierto, setModalAbierto] = useState(false);

  const q = query.trim().toLowerCase();
  const catActiva = CATEGORIES.find((c) => c.id === category)?.cat || null;
  const tarifaMaxNum = filtros.tarifaMax ? parseInt(filtros.tarifaMax, 10) : null;

  const filteredCars = useMemo(() => {
    const base = (cars || []).filter((car) => {
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
      if (tarifaMaxNum && (car.tarifa_dia || 0) > tarifaMaxNum) return false;
      if (filtros.transmision && car.transmision !== filtros.transmision) return false;
      if (filtros.combustible && car.combustible !== filtros.combustible) return false;
      return true;
    });
    return ordenarAutos(base, orden);
  }, [cars, q, catActiva, tarifaMaxNum, filtros.transmision, filtros.combustible, orden]);

  const primerNombre = (currentUser?.nombre || "").split(" ")[0];
  const filtrosActivos = contarFiltrosActivos(filtros);
  const hayFiltrosOOrden = filtrosActivos > 0 || orden !== "recientes";

  const limpiarTodo = () => {
    setFiltros(FILTROS_VACIOS);
    setOrden("recientes");
  };

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
            >
              <Icon name="heart" size={18} color={colors.primary} />
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity style={styles.mapBtn} onPress={onOpenMap} activeOpacity={0.85}>
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
            contentContainerStyle={styles.chips}
          >
            {orden !== "recientes" && (
              <TouchableOpacity
                style={styles.activeChip}
                onPress={() => setOrden("recientes")}
                activeOpacity={0.8}
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
              >
                <Text style={styles.activeChipText}>
                  {COMBUSTIBLES.find((c) => c.v === filtros.combustible)?.label}
                </Text>
                <Icon name="close" size={12} color={colors.primary} />
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity onPress={limpiarTodo} style={styles.limpiarTodoBtn}>
              <Text style={styles.limpiarTodoText}>Limpiar todo</Text>
            </TouchableOpacity>
          </ScrollView>
        )}
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

        {carsError && !(cars || []).length ? (
          // El backend respondió con error: distinto de "no hay autos".
          <EmptyState
            icon="alert"
            title="No pudimos cargar los autos"
            message={`${carsError} Desliza hacia abajo o toca Reintentar.`}
            action="Reintentar"
            onAction={loadData}
          />
        ) : filteredCars.length > 0 ? (
          <>
            <Text style={styles.count}>
              {filteredCars.length} {filteredCars.length === 1 ? "auto disponible" : "autos disponibles"}
            </Text>
            {filteredCars.map((car) => (
              <CarCard
                key={car.id || car._id}
                car={car}
                onPress={() => onSelectCar(car)}
                esFavorito={esFavorito(car.id || car._id)}
                onToggleFavorito={(c) => toggleFavorito(c.id || c._id)}
              />
            ))}
          </>
        ) : (
          <EmptyState
            icon="car"
            title="No hay autos con estos filtros"
            message={
              q
                ? "Prueba con otra marca o comuna, o limpia la búsqueda."
                : "Ajusta la categoría o los filtros para ver más resultados."
            }
            action="Limpiar filtros"
            onAction={() => {
              setQuery("");
              setCategory("Todos");
              limpiarTodo();
            }}
          />
        )}
      </ScrollView>

      <ModalFiltros
        visible={modalAbierto}
        valor={filtros}
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
    width: 34,
    height: 34,
    borderRadius: 17,
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
  tarifaInputWrap: {
    flexDirection: "row",
    alignItems: "center",
    height: theme.control.height,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: theme.radius.field,
    paddingHorizontal: theme.spacing.lg,
    marginTop: theme.spacing.sm,
  },
  tarifaPrefijo: { fontSize: 15, fontWeight: "700", color: colors.textMuted, marginRight: 4 },
  tarifaInput: { flex: 1, fontSize: 15, color: colors.text },
  chipsRow: { flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.sm, marginTop: theme.spacing.sm },
  sheetFooter: { flexDirection: "row", gap: theme.spacing.md, paddingTop: theme.spacing.sm },
});
