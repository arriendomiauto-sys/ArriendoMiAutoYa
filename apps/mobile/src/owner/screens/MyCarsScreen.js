import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ScrollView,
  TouchableOpacity,
  Switch,
  Image,
  Modal,
  KeyboardAvoidingView,
  Platform,
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
  useCatalogoPrecios,
  obtenerConfiguracionTipo,
  clampTarifa,
  calcularDesgloseIva,
} from "@rentacar/mobile-shared";
import { CabeceraOwner, FranjaResumen, oc } from "../comun";
import { ControlTarifa } from "./addcar/ControlTarifa";

const fmt = (n) => `$${Number(n || 0).toLocaleString("es-CL")}`;

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
  onOpenChat,
  onOpenEarnings,
  noLeidos,
  identidadVerificada,
  onVerifyIdentity,
}) {
  const insets = useSafeAreaInsets();
  const tipos = useCatalogoPrecios();
  const [editingCar, setEditingCar] = useState(null);
  const [tarifaSeleccionada, setTarifaSeleccionada] = useState(0);
  const [saving, setSaving] = useState(false);

  const tipoConfig = obtenerConfiguracionTipo(editingCar?.categoria, tipos);
  const desgloseTarifa = calcularDesgloseIva(tarifaSeleccionada);

  const disponibles = (cars || []).filter((c) => c.estado === "activo").length;
  const potencialDia = (cars || [])
    .filter((c) => c.estado === "activo")
    .reduce((s, c) => s + Math.round((c.tarifa_dia || 0) * 0.85), 0);

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

  const handleOpenEdit = (car) => {
    const cat = obtenerConfiguracionTipo(car?.categoria, tipos);
    const inicial = clampTarifa(car?.tarifa_dia || cat.base, cat);
    setEditingCar(car);
    setTarifaSeleccionada(inicial);
  };

  const handleAjustarTarifa = (delta) => {
    setTarifaSeleccionada((prev) => clampTarifa(prev + delta, tipoConfig));
  };

  const handleFijarTarifa = (precio) => {
    setTarifaSeleccionada(clampTarifa(precio, tipoConfig));
  };

  const handleSaveRate = async () => {
    if (saving || !editingCar) return;
    const tarifaNum = clampTarifa(tarifaSeleccionada, tipoConfig);
    setSaving(true);
    try {
      const actualizado = await ApiClient.actualizarAuto(editingCar.id, { tarifa_dia: tarifaNum });
      setCars((prev) => prev.map((c) => (c.id === editingCar.id ? actualizado : c)));
      setEditingCar(null);
      showAlert("Tarifa actualizada", `Nueva tarifa: ${fmt(tarifaNum)} por día.`);
    } catch (err) {
      showAlert("No se pudo guardar la tarifa", err.message);
    } finally {
      setSaving(false);
    }
  };

  const renderCar = ({ item }) => {
    const disponible = item.estado === "activo";
    const tarifa = item.tarifa_dia || 0;
    const ganancia = Math.round(tarifa * 0.85);
    const docsOk = item.documentos_verificados;

    return (
      <View style={[oc.card, styles.card]}>
        <View style={styles.imageWrap}>
          {item.fotos?.[0] ? (
            <Image source={{ uri: item.fotos[0] }} style={styles.image} />
          ) : (
            <View style={[styles.image, styles.imageEmpty]}>
              <Icon name="car" size={44} color={colors.primary200} />
            </View>
          )}
          <View style={[oc.pill, styles.statusPill]}>
            <View style={[oc.pillDot, { backgroundColor: disponible ? colors.accent : colors.textMuted }]} />
            <Text style={[oc.pillText, { color: disponible ? colors.accentDark : colors.textMuted }]}>
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

          {!docsOk && (
            <View style={styles.docsWarn}>
              <Icon name="warning" size={14} color={colors.warning} />
              <Text style={styles.docsWarnText}>Documentos en revisión</Text>
            </View>
          )}

          <View style={[oc.seccionMarca, styles.rateBox]}>
            <View style={{ flex: 1 }}>
              <Text style={styles.rateLabel}>Tarifa / día</Text>
              <Text style={styles.rateValue}>{fmt(tarifa)}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.rateLabel}>Recibes (85%)</Text>
              <Text style={[styles.rateValue, { color: colors.accentDark }]}>{fmt(ganancia)}</Text>
            </View>
            <TouchableOpacity
              style={styles.editBtn}
              onPress={() => handleOpenEdit(item)}
            >
              <Icon name="settings" size={14} color="#FFFFFF" />
              <Text style={styles.editBtnText}>Editar</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>Disponible para arriendos</Text>
            <Switch
              value={disponible}
              onValueChange={() => toggleCarAvailability(item)}
              trackColor={{ false: colors.border, true: colors.accent }}
              thumbColor="#FFFFFF"
            />
          </View>

          <View style={styles.tools}>
            <TouchableOpacity style={styles.tool} onPress={() => onOpenCalendar?.(item)} activeOpacity={0.8}>
              <Icon name="calendar" size={15} color={colors.primary} />
              <Text style={styles.toolText}>Calendario</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.tool} onPress={() => onOpenMaintenance?.(item)} activeOpacity={0.8}>
              <Icon name="settings" size={15} color={colors.primary} />
              <Text style={styles.toolText}>Mantenciones</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={[oc.screen, { paddingTop: Math.max(insets.top, 12) }]}>
      <CabeceraOwner
        titulo="Mi flota"
        subtitulo={
          cars?.length
            ? `${cars.length} ${cars.length === 1 ? "vehículo" : "vehículos"} · ${disponibles} disponible${disponibles === 1 ? "" : "s"}`
            : error
              ? "No pudimos cargar tu flota"
              : "Publica tu primer auto"
        }
        noLeidos={noLeidos}
        onMensajes={onOpenChat}
      />

      {!identidadVerificada && (
        <View style={styles.banner}>
          <VerifyIdentityBanner role="owner" onPress={onVerifyIdentity} />
        </View>
      )}

      <FlatList
        data={cars}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[oc.listContent, { paddingBottom: Math.max(insets.bottom, 16) + 24 }]}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          cars?.length ? (
            <TouchableOpacity onPress={onOpenEarnings} activeOpacity={0.9} accessibilityRole="button">
              <FranjaResumen
                items={[
                  { value: cars.length, label: "Autos" },
                  { value: disponibles, label: "Disponibles" },
                  { value: `$${Math.round(potencialDia / 1000)}k`, label: "Potencial / día" },
                ]}
              />
            </TouchableOpacity>
          ) : null
        }
        renderItem={renderCar}
        ListEmptyComponent={
          error ? (
            <EmptyState
              icon="alert"
              title="No pudimos cargar tu flota"
              message={`${error} Tus autos siguen publicados; vuelve a intentarlo.`}
              action="Reintentar"
              onAction={onRetry}
            />
          ) : (
            <EmptyState
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
        <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === "ios" ? "padding" : "height"}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>Ajustar tarifa diaria</Text>
                <Text style={styles.modalSub}>
                  {editingCar?.marca} {editingCar?.modelo} · {editingCar?.patente}
                </Text>
              </View>
              <View style={styles.catBadge}>
                <Text style={styles.catBadgeText}>{tipoConfig?.labelCorto || tipoConfig?.label}</Text>
              </View>
            </View>

            <ScrollView
              style={styles.modalScroll}
              contentContainerStyle={styles.modalScrollContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <ControlTarifa
                tipo={tipoConfig}
                valor={tarifaSeleccionada}
                desglose={desgloseTarifa}
                onAjustar={handleAjustarTarifa}
                onFijar={handleFijarTarifa}
              />
            </ScrollView>

            <View style={styles.modalActions}>
              <Button variant="secondary" label="Cancelar" onPress={() => setEditingCar(null)} style={{ flex: 1 }} />
              <Button label="Guardar tarifa" onPress={handleSaveRate} loading={saving} style={{ flex: 1 }} />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { overflow: "hidden", padding: 0 },
  banner: { paddingHorizontal: theme.spacing.screen, paddingBottom: theme.spacing.md },
  imageWrap: { height: 150, backgroundColor: colors.surfaceSecondary },
  image: { width: "100%", height: "100%" },
  imageEmpty: { alignItems: "center", justifyContent: "center", backgroundColor: colors.primary100 },
  statusPill: {
    position: "absolute",
    top: theme.spacing.md,
    left: theme.spacing.md,
    backgroundColor: "rgba(255,255,255,0.94)",
  },
  body: { padding: theme.spacing.lg, gap: theme.spacing.md },
  carName: { fontSize: 16, fontWeight: "700", color: colors.text },
  carMeta: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  rateBox: { flexDirection: "row", alignItems: "center", gap: theme.spacing.md },
  rateLabel: { fontSize: 11, color: colors.textMuted, fontWeight: "600" },
  rateValue: { fontSize: 15, fontWeight: "800", color: colors.text, marginTop: 2 },
  editBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: theme.radius.sm,
    backgroundColor: colors.primary,
  },
  editBtnText: { fontSize: 12, fontWeight: "700", color: "#FFFFFF" },
  docsWarn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.warningBg,
    borderWidth: 1,
    borderColor: colors.warningBorder,
    borderRadius: theme.radius.sm,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  docsWarnText: { fontSize: 12, color: colors.warningText, fontWeight: "600" },
  switchRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  switchLabel: { fontSize: 13, color: colors.text },
  tools: { flexDirection: "row", gap: theme.spacing.sm },
  tool: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: colors.surfaceSubtle,
    paddingVertical: 10,
    borderRadius: theme.radius.field,
    borderWidth: 1,
    borderColor: colors.border,
  },
  toolText: { fontSize: 12, fontWeight: "600", color: colors.text },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(6,30,31,0.45)",
    justifyContent: "center",
    padding: theme.spacing.xl,
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderRadius: theme.radius.card,
    padding: theme.spacing.xl,
    borderWidth: 1,
    borderColor: colors.border,
    gap: theme.spacing.md,
    maxHeight: "90%",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  catBadge: {
    backgroundColor: colors.primary100,
    borderWidth: 1,
    borderColor: colors.primary200,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  catBadgeText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.primary,
  },
  modalTitle: { fontSize: 17, fontWeight: "700", color: colors.text },
  modalSub: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  modalScroll: { maxHeight: 440 },
  modalScrollContent: { gap: theme.spacing.md, paddingVertical: 4 },
  modalActions: { flexDirection: "row", gap: theme.spacing.md, marginTop: 4 },
});
