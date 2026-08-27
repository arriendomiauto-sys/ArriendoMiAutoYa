import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  ActivityIndicator,
} from "react-native";
import { colors, Icon, ApiClient, showAlert } from "@rentacar/mobile-shared";

function formatearFecha(iso) {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleDateString("es-CL", { day: "2-digit", month: "long", year: "numeric" });
  } catch {
    return iso;
  }
}

export function CarMaintenanceScreen({ car, onBack }) {
  const [mantenciones, setMantenciones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [formTipo, setFormTipo] = useState("documento_legal");
  const [formNombre, setFormNombre] = useState("");
  const [formFecha, setFormFecha] = useState("");
  const [formKm, setFormKm] = useState("");
  const [formNotas, setFormNotas] = useState("");
  const [saving, setSaving] = useState(false);

  const cargar = useCallback(async () => {
    if (!car?.id) return;
    setLoading(true);
    setError(null);
    try {
      const data = await ApiClient.getMantenciones(car.id);
      setMantenciones(data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [car?.id]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const documentos = mantenciones.filter((m) => m.tipo === "documento_legal");
  const servicios = mantenciones.filter((m) => m.tipo === "servicio_mecanico");

  const handleGuardar = async () => {
    if (!formNombre.trim()) {
      showAlert("Nombre requerido", "Ingresa el nombre del documento o servicio.");
      return;
    }
    setSaving(true);
    try {
      await ApiClient.crearMantencion(car.id, {
        tipo: formTipo,
        nombre: formNombre.trim(),
        fecha_vencimiento: formTipo === "documento_legal" && formFecha ? new Date(formFecha).toISOString() : null,
        kilometraje: formTipo === "servicio_mecanico" && formKm ? parseInt(formKm, 10) : null,
        notas: formNotas.trim() || null,
      });
      setShowForm(false);
      setFormNombre("");
      setFormFecha("");
      setFormKm("");
      setFormNotas("");
      cargar();
    } catch (err) {
      showAlert("No se pudo guardar", err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Botón Volver */}
      <TouchableOpacity style={styles.backBtn} onPress={onBack}>
        <Icon name="arrow-left" size={14} color={colors.textWhite} style={{ marginRight: 4 }} />
        <Text style={styles.backBtnText}>Volver</Text>
      </TouchableOpacity>

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.badgePill}>
          <Text style={styles.badgePillText}>DOCUMENTACIÓN Y TALLER</Text>
        </View>
        <Text style={styles.title}>Control de Mantenimientos</Text>
        <Text style={styles.subtitle}>
          {car ? `${car.marca} ${car.modelo} (${car.patente || "—"})` : "Selecciona un auto"}
        </Text>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: 30 }} />
      ) : error ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : (
        <>
          {/* SECCIÓN 1: PAPELES Y REVISIÓN TÉCNICA */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Documentación Legal del Vehículo</Text>

            {documentos.length === 0 && (
              <Text style={styles.emptyText}>Sin documentos registrados todavía.</Text>
            )}

            {documentos.map((d) => (
              <View key={d.id} style={styles.docRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.docName}>{d.nombre}</Text>
                  <Text style={styles.docExpiry}>
                    {d.fecha_vencimiento ? `Vence: ${formatearFecha(d.fecha_vencimiento)}` : "Sin fecha de vencimiento"}
                  </Text>
                </View>
                <View style={styles.docStatusBadge}>
                  <Text style={styles.docStatusText}>Registrado</Text>
                </View>
              </View>
            ))}

            <TouchableOpacity
              style={styles.uploadDocBtn}
              onPress={() => {
                setFormTipo("documento_legal");
                setShowForm(true);
              }}
            >
              <Text style={styles.uploadDocBtnText}>+ Registrar Documento</Text>
            </TouchableOpacity>
          </View>

          {/* SECCIÓN 2: BITÁCORA DE TALLER Y MECÁNICA */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Bitácora de Taller y Kilometraje</Text>

            {servicios.length === 0 && (
              <Text style={styles.emptyText}>Sin servicios registrados todavía.</Text>
            )}

            {servicios.map((m) => (
              <View key={m.id} style={styles.maintRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.maintItem}>{m.nombre}</Text>
                  <Text style={styles.maintDetail}>
                    {m.kilometraje ? `A los ${m.kilometraje.toLocaleString("es-CL")} km` : formatearFecha(m.creado_en)}
                  </Text>
                </View>
                <View style={styles.maintStatusBadge}>
                  <Text style={styles.maintStatusText}>Registrado</Text>
                </View>
              </View>
            ))}

            <TouchableOpacity
              style={styles.addMaintBtn}
              onPress={() => {
                setFormTipo("servicio_mecanico");
                setShowForm(true);
              }}
            >
              <Text style={styles.addMaintBtnText}>+ Registrar Nueva Mantención</Text>
            </TouchableOpacity>
          </View>
        </>
      )}

      <Modal visible={showForm} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {formTipo === "documento_legal" ? "Nuevo Documento Legal" : "Nueva Mantención"}
            </Text>

            <TextInput
              style={styles.modalInput}
              placeholder={formTipo === "documento_legal" ? "ej. Revisión Técnica" : "ej. Cambio de aceite"}
              placeholderTextColor={colors.textMuted}
              value={formNombre}
              onChangeText={setFormNombre}
            />

            {formTipo === "documento_legal" ? (
              <TextInput
                style={styles.modalInput}
                placeholder="Fecha de vencimiento (AAAA-MM-DD)"
                placeholderTextColor={colors.textMuted}
                value={formFecha}
                onChangeText={setFormFecha}
              />
            ) : (
              <TextInput
                style={styles.modalInput}
                placeholder="Kilometraje (opcional)"
                placeholderTextColor={colors.textMuted}
                value={formKm}
                onChangeText={setFormKm}
                keyboardType="number-pad"
              />
            )}

            <TextInput
              style={[styles.modalInput, { height: 70 }]}
              placeholder="Notas (opcional)"
              placeholderTextColor={colors.textMuted}
              value={formNotas}
              onChangeText={setFormNotas}
              multiline
            />

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowForm(false)}>
                <Text style={styles.cancelBtnText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={handleGuardar} disabled={saving}>
                {saving ? <ActivityIndicator color={colors.dark} /> : <Text style={styles.saveBtnText}>Guardar</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.darkBg,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 5,
    paddingHorizontal: 8,
    alignSelf: "flex-start",
    marginBottom: 8,
    backgroundColor: colors.darkCard,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.darkBorder,
  },
  backBtnText: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.textWhite,
  },
  header: {
    marginBottom: 12,
  },
  badgePill: {
    backgroundColor: colors.accentMuted,
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 4,
    alignSelf: "flex-start",
    marginBottom: 6,
  },
  badgePillText: {
    color: colors.accent,
    fontSize: 9,
    fontWeight: "900",
  },
  title: {
    fontSize: 20,
    fontWeight: "900",
    color: colors.textWhite,
  },
  subtitle: {
    fontSize: 12,
    color: colors.textSilver,
    marginTop: 2,
  },
  errorText: {
    color: colors.danger,
    fontSize: 12,
    marginTop: 20,
    textAlign: "center",
  },
  emptyText: {
    fontSize: 11,
    color: colors.textMuted,
    paddingVertical: 8,
  },
  card: {
    backgroundColor: colors.darkCard,
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.darkBorder,
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: colors.textWhite,
    marginBottom: 10,
  },
  docRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.darkBorder,
  },
  docName: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.textWhite,
  },
  docExpiry: {
    fontSize: 10,
    color: colors.textMuted,
    marginTop: 1,
  },
  docStatusBadge: {
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 4,
  },
  docStatusText: {
    color: colors.success,
    fontSize: 9,
    fontWeight: "800",
  },
  uploadDocBtn: {
    marginTop: 10,
    paddingVertical: 8,
    alignItems: "center",
    borderRadius: 6,
    backgroundColor: colors.darkCardHover,
    borderWidth: 1,
    borderColor: colors.darkBorder,
  },
  uploadDocBtnText: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: "700",
  },
  maintRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.darkBorder,
  },
  maintItem: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.textWhite,
  },
  maintDetail: {
    fontSize: 10,
    color: colors.textMuted,
    marginTop: 1,
  },
  maintStatusBadge: {
    backgroundColor: colors.accentMuted,
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 4,
  },
  maintStatusText: {
    color: colors.accent,
    fontSize: 9,
    fontWeight: "800",
  },
  addMaintBtn: {
    marginTop: 10,
    paddingVertical: 8,
    alignItems: "center",
    borderRadius: 6,
    backgroundColor: colors.darkCardHover,
    borderWidth: 1,
    borderColor: colors.darkBorder,
  },
  addMaintBtnText: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: "700",
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
    gap: 10,
  },
  modalTitle: {
    fontSize: 15,
    fontWeight: "900",
    color: colors.textWhite,
    marginBottom: 4,
  },
  modalInput: {
    backgroundColor: colors.darkCardHover,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: colors.textWhite,
    borderWidth: 1,
    borderColor: colors.darkBorder,
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 6,
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
