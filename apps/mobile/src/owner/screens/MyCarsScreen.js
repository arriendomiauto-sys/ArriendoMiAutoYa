import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Switch,
  Image,
  Modal,
  TextInput,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  colors,
  theme,
  Icon,
  Button,
  EmptyState,
  ApiClient,
  showAlert,
  VerifyIdentityBanner,
} from "@rentacar/mobile-shared";

// `cars`/`setCars` vienen como props (la flota real del dueño, desde
// OwnerApp) — no del contexto global, que es el marketplace público completo.
export function MyCarsScreen({
  cars,
  setCars,
  error,
  onRetry,
  onAddNewCar,
  onOpenCalendar,
  onOpenMaintenance,
  identidadVerificada,
  onVerifyIdentity,
}) {
  const insets = useSafeAreaInsets();
  const [editingCar, setEditingCar] = useState(null);
  const [newTarifa, setNewTarifa] = useState("");
  const [saving, setSaving] = useState(false);

  const toggleCarAvailability = async (car) => {
    const nuevoEstado = car.estado === "pausado" ? "activo" : "pausado";
    setCars((prev) => prev.map((c) => (c.id === car.id ? { ...c, estado: nuevoEstado } : c)));
    try {
      await ApiClient.actualizarAuto(car.id, { estado: nuevoEstado });
    } catch (err) {
      setCars((prev) => prev.map((c) => (c.id === car.id ? { ...c, estado: car.estado } : c)));
      showAlert("No se pudo actualizar", err.message);
    }
  };

  const handleSaveRate = async () => {
    if (!editingCar || !newTarifa) return;
    const tarifaNum = parseInt(newTarifa, 10);
    if (isNaN(tarifaNum) || tarifaNum < 15000) {
      showAlert("Tarifa inválida", "La tarifa mínima sugerida es $15.000 CLP por día.");
      return;
    }
    setSaving(true);
    try {
      const actualizado = await ApiClient.actualizarAuto(editingCar.id, { tarifa_dia: tarifaNum });
      setCars((prev) => prev.map((c) => (c.id === editingCar.id ? actualizado : c)));
      setEditingCar(null);
      showAlert("Tarifa actualizada", `Nueva tarifa: $${tarifaNum.toLocaleString("es-CL")} por día.`);
    } catch (err) {
      showAlert("No se pudo guardar la tarifa", err.message);
    } finally {
      setSaving(false);
    }
  };

  const renderCar = ({ item }) => {
    const disponible = item.estado === "activo";
    const tarifa = item.tarifa_dia || 0;
    const ganancia = Math.round(tarifa * 0.8);
    const docsOk = item.documentos_verificados;

    return (
      <View style={styles.card}>
        <View style={styles.imageWrap}>
          <Image
            source={{
              uri: item.fotos?.[0] || "https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?w=800",
            }}
            style={styles.image}
          />
          <View style={[styles.statusPill, disponible ? styles.pillActive : styles.pillPaused]}>
            <View style={[styles.pillDot, { backgroundColor: disponible ? colors.accent500 : colors.textSilver }]} />
            <Text style={[styles.pillText, { color: disponible ? colors.accent : colors.textSilver }]}>
              {disponible ? "Disponible" : "Pausado"}
            </Text>
          </View>
        </View>

        <View style={styles.body}>
          <View>
            <Text style={styles.carName}>
              {item.marca} {item.modelo} {item.anio || ""}
            </Text>
            <Text style={styles.carMeta}>
              {item.ubicacion_base || "Los Ángeles"} · {item.patente || "—"}
            </Text>
          </View>

          <View style={styles.rateBox}>
            <View style={{ flex: 1 }}>
              <Text style={styles.rateLabel}>Tarifa / día</Text>
              <Text style={styles.rateValue}>${tarifa.toLocaleString("es-CL")}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.rateLabel}>Recibes (80%)</Text>
              <Text style={[styles.rateValue, { color: colors.accent }]}>${ganancia.toLocaleString("es-CL")}</Text>
            </View>
            <TouchableOpacity style={styles.editBtn} onPress={() => { setEditingCar(item); setNewTarifa(String(tarifa)); }}>
              <Icon name="settings" size={14} color={colors.textWhite} />
              <Text style={styles.editBtnText}>Editar</Text>
            </TouchableOpacity>
          </View>

          {!docsOk && (
            <View style={styles.docsWarn}>
              <Icon name="warning" size={14} color="#F2C879" />
              <Text style={styles.docsWarnText}>Documentos en revisión</Text>
            </View>
          )}

          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>Disponible para arriendos</Text>
            <Switch
              value={disponible}
              onValueChange={() => toggleCarAvailability(item)}
              trackColor={{ false: colors.darkBorderStrong, true: colors.accent }}
              thumbColor={colors.white}
            />
          </View>

          <View style={styles.tools}>
            <TouchableOpacity style={styles.tool} onPress={() => onOpenCalendar?.(item)} activeOpacity={0.8}>
              <Icon name="calendar" size={15} color={colors.accent} />
              <Text style={styles.toolText}>Calendario</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.tool} onPress={() => onOpenMaintenance?.(item)} activeOpacity={0.8}>
              <Icon name="settings" size={15} color={colors.accent} />
              <Text style={styles.toolText}>Mantenciones</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Mi flota</Text>
          <Text style={styles.subtitle}>
            {cars?.length
              ? `${cars.length} ${cars.length === 1 ? "vehículo" : "vehículos"}`
              : error
                ? "No pudimos cargar tu flota"
                : "Publica tu primer auto"}
          </Text>
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={onAddNewCar} activeOpacity={0.85}>
          <Icon name="plus" size={16} color={colors.primary900} />
          <Text style={styles.addBtnText}>Publicar</Text>
        </TouchableOpacity>
      </View>

      {!identidadVerificada && (
        <View style={styles.banner}>
          <VerifyIdentityBanner role="owner" onPress={onVerifyIdentity} />
        </View>
      )}

      <FlatList
        data={cars}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.list, { paddingBottom: Math.max(insets.bottom, 16) + 24 }]}
        showsVerticalScrollIndicator={false}
        renderItem={renderCar}
        ListEmptyComponent={
          error ? (
            // La flota no se pudo traer: no es lo mismo que no tener autos.
            <EmptyState
              tone="dark"
              icon="alert"
              title="No pudimos cargar tu flota"
              message={`${error} Tus autos siguen publicados; vuelve a intentarlo.`}
              action="Reintentar"
              onAction={onRetry}
            />
          ) : (
            <EmptyState
              tone="dark"
              icon="car"
              title="Todavía no tienes autos publicados"
              message="Publica tu vehículo con fotos y documentos para empezar a recibir arriendos."
              action="Publicar un auto"
              onAction={onAddNewCar}
            />
          )
        }
      />

      <Modal visible={!!editingCar} transparent animationType="fade" onRequestClose={() => setEditingCar(null)}>
        <View style={styles.overlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Ajustar tarifa diaria</Text>
            <Text style={styles.modalSub}>
              {editingCar?.marca} {editingCar?.modelo} · {editingCar?.patente}
            </Text>

            <Text style={styles.fieldLabel}>Tarifa por día (CLP)</Text>
            <TextInput
              style={styles.input}
              value={newTarifa}
              onChangeText={setNewTarifa}
              keyboardType="number-pad"
              placeholder="42000"
              placeholderTextColor={colors.textSilver}
            />

            {newTarifa && !isNaN(parseInt(newTarifa, 10)) ? (
              <View style={styles.simBox}>
                <View style={styles.simRow}>
                  <Text style={styles.simLabel}>Cobro al cliente</Text>
                  <Text style={styles.simValue}>${parseInt(newTarifa, 10).toLocaleString("es-CL")}</Text>
                </View>
                <View style={styles.simRow}>
                  <Text style={styles.simLabel}>Tu ingreso líquido (80%)</Text>
                  <Text style={[styles.simValue, { color: colors.accent }]}>
                    ${Math.round(parseInt(newTarifa, 10) * 0.8).toLocaleString("es-CL")}
                  </Text>
                </View>
              </View>
            ) : null}

            <View style={styles.modalActions}>
              <Button tone="dark" variant="secondary" label="Cancelar" onPress={() => setEditingCar(null)} style={{ flex: 1 }} />
              <Button tone="dark" label="Guardar" onPress={handleSaveRate} loading={saving} style={{ flex: 1 }} />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.darkBg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.md,
    paddingHorizontal: theme.spacing.screen,
    paddingTop: theme.spacing.sm,
    paddingBottom: theme.spacing.md,
  },
  title: { ...theme.typography.title, color: colors.textWhite },
  subtitle: { fontSize: 13, color: colors.textSilver, marginTop: 2 },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: colors.accent,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: theme.radius.field,
  },
  addBtnText: { color: colors.primary900, fontWeight: "700", fontSize: 14 },
  banner: { paddingHorizontal: theme.spacing.screen, paddingBottom: theme.spacing.md },
  list: { paddingHorizontal: theme.spacing.screen, gap: theme.spacing.lg },
  card: {
    backgroundColor: colors.darkCard,
    borderRadius: theme.radius.card,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.darkBorder,
  },
  imageWrap: { height: 150, backgroundColor: colors.darkCardHover },
  image: { width: "100%", height: "100%" },
  statusPill: {
    position: "absolute",
    top: theme.spacing.md,
    left: theme.spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: theme.radius.pill,
    backgroundColor: "rgba(6,30,31,0.78)",
  },
  pillActive: {},
  pillPaused: {},
  pillDot: { width: 6, height: 6, borderRadius: 3 },
  pillText: { fontSize: 12, fontWeight: "700" },
  body: { padding: theme.spacing.lg, gap: theme.spacing.md },
  carName: { fontSize: 16, fontWeight: "700", color: colors.textWhite },
  carMeta: { fontSize: 13, color: colors.textSilver, marginTop: 2 },
  rateBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.md,
    backgroundColor: colors.darkCardSubtle,
    padding: theme.spacing.md,
    borderRadius: theme.radius.field,
  },
  rateLabel: { fontSize: 11, color: colors.darkTextMuted, fontWeight: "600" },
  rateValue: { fontSize: 15, fontWeight: "800", color: colors.textWhite, marginTop: 2 },
  editBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: theme.radius.sm,
    backgroundColor: colors.primary600,
  },
  editBtnText: { fontSize: 12, fontWeight: "700", color: colors.textWhite },
  docsWarn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(242,200,121,0.12)",
    borderRadius: theme.radius.sm,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  docsWarnText: { fontSize: 12, color: "#F2C879", fontWeight: "600" },
  switchRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.darkBorder,
  },
  switchLabel: { fontSize: 13, color: colors.textWhite },
  tools: { flexDirection: "row", gap: theme.spacing.sm },
  tool: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: colors.darkCardSubtle,
    paddingVertical: 10,
    borderRadius: theme.radius.field,
    borderWidth: 1,
    borderColor: colors.darkBorder,
  },
  toolText: { fontSize: 12, fontWeight: "600", color: colors.textWhite },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(6,30,31,0.75)",
    justifyContent: "center",
    padding: theme.spacing.xl,
  },
  modalCard: {
    backgroundColor: colors.darkCard,
    borderRadius: theme.radius.card,
    padding: theme.spacing.xl,
    borderWidth: 1,
    borderColor: colors.darkBorderStrong,
    gap: theme.spacing.md,
  },
  modalTitle: { fontSize: 17, fontWeight: "700", color: colors.textWhite },
  modalSub: { fontSize: 13, color: colors.textSilver, marginTop: -6 },
  fieldLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.textSilver,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  input: {
    backgroundColor: colors.darkCardSubtle,
    borderRadius: theme.radius.field,
    paddingHorizontal: 14,
    height: theme.control.height,
    fontSize: 16,
    color: colors.textWhite,
    fontWeight: "700",
    borderWidth: 1,
    borderColor: colors.darkBorder,
  },
  simBox: {
    backgroundColor: colors.darkCardSubtle,
    padding: theme.spacing.md,
    borderRadius: theme.radius.field,
    gap: 6,
  },
  simRow: { flexDirection: "row", justifyContent: "space-between" },
  simLabel: { fontSize: 13, color: colors.textSilver },
  simValue: { fontSize: 13, color: colors.textWhite, fontWeight: "700" },
  modalActions: { flexDirection: "row", gap: theme.spacing.md, marginTop: 4 },
});
