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
import { colors, Icon, ApiClient, showAlert, VerifyIdentityBanner } from "@rentacar/mobile-shared";

// `cars`/`setCars` vienen como props (la flota real del dueño, desde
// OwnerApp) — no del contexto global, que es el marketplace público
// completo y mostraría autos de otros dueños.
export function MyCarsScreen({
  cars,
  setCars,
  onAddNewCar,
  onOpenCalendar,
  onOpenMaintenance,
  identidadVerificada,
  onVerifyIdentity,
}) {
  const [editingCar, setEditingCar] = useState(null);
  const [newTarifa, setNewTarifa] = useState("");
  const [saving, setSaving] = useState(false);

  const toggleCarAvailability = async (car) => {
    const nuevoEstado = car.estado === "pausado" ? "activo" : "pausado";
    // Optimista: refleja el cambio de inmediato y revierte si el backend falla.
    setCars((prev) => prev.map((c) => (c.id === car.id ? { ...c, estado: nuevoEstado } : c)));
    try {
      await ApiClient.actualizarAuto(car.id, { estado: nuevoEstado });
    } catch (err) {
      setCars((prev) => prev.map((c) => (c.id === car.id ? { ...c, estado: car.estado } : c)));
      showAlert("No se pudo actualizar", err.message);
    }
  };

  const handleOpenRateModal = (car) => {
    setEditingCar(car);
    setNewTarifa(String(car.tarifa_dia || 38000));
  };

  const handleSaveRate = async () => {
    if (!editingCar || !newTarifa) return;
    const tarifaNum = parseInt(newTarifa, 10);
    if (isNaN(tarifaNum) || tarifaNum < 15000) {
      showAlert("Tarifa Inválida", "La tarifa mínima sugerida es de $15.000 CLP/día.");
      return;
    }
    setSaving(true);
    try {
      const actualizado = await ApiClient.actualizarAuto(editingCar.id, { tarifa_dia: tarifaNum });
      setCars((prev) => prev.map((c) => (c.id === editingCar.id ? actualizado : c)));
      setEditingCar(null);
      showAlert("Tarifa Actualizada", `Nueva tarifa diaria: $${tarifaNum.toLocaleString("es-CL")} CLP.`);
    } catch (err) {
      showAlert("No se pudo guardar la tarifa", err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.title}>Mis Vehículos Publicados</Text>
          <Text style={styles.subtitle}>
            Administra tarifas, calendarios y mantenciones en Los Ángeles
          </Text>
        </View>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={onAddNewCar}
          activeOpacity={0.85}
        >
          <Text style={styles.addBtnText} numberOfLines={1}>
            + Publicar
          </Text>
        </TouchableOpacity>
      </View>

      {!identidadVerificada && (
        <View style={styles.bannerWrap}>
          <VerifyIdentityBanner role="owner" onPress={onVerifyIdentity} />
        </View>
      )}

      {/* Lista de Flota */}
      <FlatList
        data={cars}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => {
          const isDisponible = item.estado === "activo";
          const tarifa = item.tarifa_dia || 38000;
          const gananciaNeta = Math.round(tarifa * 0.8);

          return (
            <View style={styles.card}>
              <Image
                source={{
                  uri:
                    item.fotos && item.fotos.length > 0
                      ? item.fotos[0]
                      : "https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?w=800",
                }}
                style={styles.carImage}
              />

              <View style={styles.cardBody}>
                <View style={styles.carHeaderRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.carName}>
                      {item.marca} {item.modelo}
                    </Text>
                    <Text style={styles.carLocation}>
                      {item.ubicacion_base || "Los Ángeles, Chile"} • {item.patente || "BBCL-10"}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.statusPill,
                      isDisponible ? styles.statusPillActive : styles.statusPillInactive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusPillText,
                        isDisponible ? styles.textSuccess : styles.textMuted,
                      ]}
                    >
                      {isDisponible ? "Disponible" : "Pausado"}
                    </Text>
                  </View>
                </View>

                {/* Tarifas y Ganancias */}
                <View style={styles.rateBox}>
                  <View style={styles.rateCol}>
                    <Text style={styles.rateLabel}>Tarifa por Día</Text>
                    <Text style={styles.rateVal}>${tarifa.toLocaleString("es-CL")} CLP</Text>
                  </View>
                  <View style={styles.rateCol}>
                    <Text style={styles.rateLabel}>Tu Ganancia Neta (80%)</Text>
                    <Text style={styles.gainVal}>${gananciaNeta.toLocaleString("es-CL")} CLP</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.editRateBtn}
                    onPress={() => handleOpenRateModal(item)}
                  >
                    <Text style={styles.editRateText}>Editar</Text>
                  </TouchableOpacity>
                </View>

                {/* Switch Disponibilidad */}
                <View style={styles.switchRow}>
                  <Text style={styles.switchLabel}>Disponible para arriendos inmediatos</Text>
                  <Switch
                    value={isDisponible}
                    onValueChange={() => toggleCarAvailability(item)}
                    trackColor={{ false: colors.darkBorder, true: colors.accent }}
                    thumbColor={isDisponible ? colors.white : colors.textMuted}
                  />
                </View>

                {/* Accesos a Calendario y Mantenimiento */}
                <View style={styles.toolsRow}>
                  {onOpenCalendar && (
                    <TouchableOpacity style={styles.toolBtn} onPress={onOpenCalendar}>
                      <Icon name="calendar" size={13} color={colors.accent} style={{ marginRight: 5 }} />
                      <Text style={styles.toolBtnText}>Calendario</Text>
                    </TouchableOpacity>
                  )}
                  {onOpenMaintenance && (
                    <TouchableOpacity style={styles.toolBtn} onPress={onOpenMaintenance}>
                      <Icon name="gear" size={13} color={colors.accent} style={{ marginRight: 5 }} />
                      <Text style={styles.toolBtnText}>Mantenciones</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            </View>
          );
        }}
      />

      {/* Modal Editor de Tarifa */}
      <Modal visible={!!editingCar} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Ajustar Tarifa Diaria</Text>
            <Text style={styles.modalSub}>
              {editingCar?.marca} {editingCar?.modelo} ({editingCar?.patente})
            </Text>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Tarifa por Día (CLP)</Text>
              <TextInput
                style={styles.rateInput}
                value={newTarifa}
                onChangeText={setNewTarifa}
                keyboardType="number-pad"
                placeholder="ej. 42000"
                placeholderTextColor={colors.textMuted}
              />
            </View>

            {newTarifa && !isNaN(parseInt(newTarifa, 10)) && (
              <View style={styles.simBox}>
                <Text style={styles.simTitle}>SIMULACIÓN DE INGRESOS</Text>
                <View style={styles.simRow}>
                  <Text style={styles.simLabel}>Cobro al cliente:</Text>
                  <Text style={styles.simVal}>
                    ${parseInt(newTarifa, 10).toLocaleString("es-CL")} CLP
                  </Text>
                </View>
                <View style={styles.simRow}>
                  <Text style={styles.simLabel}>Tu ingreso líquido (80%):</Text>
                  <Text style={styles.simValGain}>
                    ${Math.round(parseInt(newTarifa, 10) * 0.8).toLocaleString("es-CL")} CLP
                  </Text>
                </View>
              </View>
            )}

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setEditingCar(null)}
              >
                <Text style={styles.cancelBtnText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={handleSaveRate}>
                <Text style={styles.saveBtnText}>Guardar Tarifa</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.darkBg,
    padding: 16,
  },
  bannerWrap: {
    marginBottom: 14,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    marginBottom: 14,
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: "900",
    color: colors.textWhite,
  },
  subtitle: {
    fontSize: 11,
    color: colors.textSilver,
    marginTop: 2,
  },
  addBtn: {
    flexShrink: 0,
    backgroundColor: colors.accent,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  addBtnText: {
    color: colors.dark,
    fontWeight: "800",
    fontSize: 13,
  },
  listContent: {
    paddingBottom: 40,
  },
  card: {
    backgroundColor: colors.darkCard,
    borderRadius: 12,
    overflow: "hidden",
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.darkBorder,
  },
  carImage: {
    width: "100%",
    height: 140,
  },
  cardBody: {
    padding: 12,
  },
  carHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 10,
  },
  carName: {
    fontSize: 13,
    fontWeight: "800",
    color: colors.textWhite,
  },
  carLocation: {
    fontSize: 10,
    color: colors.textSilver,
    marginTop: 1,
  },
  statusPill: {
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 4,
  },
  statusPillActive: {
    backgroundColor: "rgba(16, 185, 129, 0.15)",
  },
  statusPillInactive: {
    backgroundColor: colors.darkCardHover,
  },
  statusPillText: {
    fontSize: 9,
    fontWeight: "800",
  },
  textSuccess: { color: colors.success },
  textMuted: { color: colors.textMuted },
  rateBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.darkCardHover,
    padding: 10,
    borderRadius: 8,
    marginBottom: 8,
  },
  rateCol: {
    flex: 1,
  },
  rateLabel: {
    fontSize: 9,
    color: colors.textMuted,
    fontWeight: "600",
  },
  rateVal: {
    fontSize: 12,
    fontWeight: "800",
    color: colors.textWhite,
    marginTop: 1,
  },
  gainVal: {
    fontSize: 12,
    fontWeight: "900",
    color: colors.accent,
    marginTop: 1,
  },
  editRateBtn: {
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: 4,
    backgroundColor: colors.primaryLight,
  },
  editRateText: {
    fontSize: 10,
    fontWeight: "700",
    color: colors.textWhite,
  },
  switchRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: colors.darkBorder,
    marginBottom: 8,
  },
  switchLabel: {
    fontSize: 10,
    color: colors.textSilver,
    fontWeight: "600",
  },
  toolsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.darkBorder,
  },
  toolBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.darkCardHover,
    paddingVertical: 7,
    borderRadius: 6,
    marginHorizontal: 3,
    borderWidth: 1,
    borderColor: colors.darkBorder,
  },
  toolBtnText: {
    fontSize: 10,
    fontWeight: "700",
    color: colors.textWhite,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
    padding: 20,
  },
  modalCard: {
    backgroundColor: colors.darkCard,
    borderRadius: 12,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.darkBorder,
  },
  modalTitle: {
    fontSize: 15,
    fontWeight: "900",
    color: colors.textWhite,
  },
  modalSub: {
    fontSize: 11,
    color: colors.textSilver,
    marginTop: 2,
    marginBottom: 12,
  },
  inputGroup: {
    marginBottom: 10,
  },
  inputLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: colors.textSilver,
    marginBottom: 4,
  },
  rateInput: {
    backgroundColor: colors.darkCardHover,
    borderRadius: 6,
    paddingHorizontal: 12,
    height: 42,
    fontSize: 14,
    color: colors.textWhite,
    fontWeight: "800",
    borderWidth: 1,
    borderColor: colors.darkBorder,
  },
  simBox: {
    backgroundColor: colors.darkCardHover,
    padding: 10,
    borderRadius: 6,
    marginBottom: 12,
  },
  simTitle: {
    fontSize: 8,
    fontWeight: "900",
    color: colors.textMuted,
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  simRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 2,
  },
  simLabel: {
    fontSize: 10,
    color: colors.textSilver,
  },
  simVal: {
    fontSize: 10,
    color: colors.textWhite,
    fontWeight: "700",
  },
  simValGain: {
    fontSize: 11,
    color: colors.accent,
    fontWeight: "900",
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    marginRight: 4,
  },
  cancelBtnText: {
    color: colors.textSilver,
    fontWeight: "700",
    fontSize: 12,
  },
  saveBtn: {
    flex: 1.5,
    backgroundColor: colors.accent,
    paddingVertical: 10,
    borderRadius: 6,
    alignItems: "center",
    marginLeft: 4,
  },
  saveBtnText: {
    color: colors.dark,
    fontWeight: "800",
    fontSize: 12,
  },
});
