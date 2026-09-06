import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, theme, Icon, Button, Badge, ApiClient, showAlert } from "@rentacar/mobile-shared";
import { CabeceraOwner, oc } from "../comun";

function fmtFecha(iso) {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleDateString("es-CL", { day: "2-digit", month: "long", year: "numeric" });
  } catch {
    return iso;
  }
}

// A nivel de módulo: si vive dentro del componente, cada tecleo en el modal
// recrea el tipo y React desmonta y vuelve a montar las dos secciones enteras.
function SeccionMantencion({ titulo, lista, render, onAdd, ctaLabel }) {
  return (
    <View style={[oc.card, oc.cardPadded, styles.sec]}>
      <Text style={oc.cardTitle}>{titulo}</Text>
      {lista.length === 0 ? (
        <Text style={styles.empty}>Sin registros todavía.</Text>
      ) : (
        lista.map((m, i) => (
          <View key={m.id} style={[styles.row, i === lista.length - 1 && { borderBottomWidth: 0 }]}>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowName}>{m.nombre}</Text>
              <Text style={styles.rowMeta}>{render(m)}</Text>
            </View>
            <Badge variant="success" label="Registrado" />
          </View>
        ))
      )}
      <TouchableOpacity style={styles.addBtn} onPress={onAdd} activeOpacity={0.85}>
        <Icon name="plus" size={15} color={colors.accentDark} />
        <Text style={styles.addBtnText}>{ctaLabel}</Text>
      </TouchableOpacity>
    </View>
  );
}

export function CarMaintenanceScreen({ car, onBack }) {
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [form, setForm] = useState(null); // { tipo } | null
  const [f, setF] = useState({ nombre: "", fecha: "", km: "", notas: "" });
  const [saving, setSaving] = useState(false);

  const cargar = useCallback(async () => {
    if (!car?.id) return;
    setLoading(true);
    setError(null);
    try {
      setItems((await ApiClient.getMantenciones(car.id)) || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [car?.id]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const { documentos, servicios } = useMemo(
    () => ({
      documentos: items.filter((m) => m.tipo === "documento_legal"),
      servicios: items.filter((m) => m.tipo === "servicio_mecanico"),
    }),
    [items]
  );

  const guardar = async () => {
    if (!f.nombre.trim()) {
      showAlert("Falta el nombre", "Ingresa el nombre del documento o servicio.");
      return;
    }
    setSaving(true);
    try {
      const nuevo = await ApiClient.crearMantencion(car.id, {
        tipo: form.tipo,
        nombre: f.nombre.trim(),
        fecha_vencimiento: form.tipo === "documento_legal" && f.fecha ? new Date(f.fecha).toISOString() : null,
        kilometraje: form.tipo === "servicio_mecanico" && f.km ? parseInt(f.km, 10) : null,
        notas: f.notas.trim() || null,
      });
      setForm(null);
      setF({ nombre: "", fecha: "", km: "", notas: "" });
      // El endpoint devuelve el registro creado: se antepone en vez de re-pedir
      // toda la lista.
      if (nuevo?.id) setItems((p) => [nuevo, ...p]);
      else cargar();
    } catch (err) {
      showAlert("No se pudo guardar", err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={[oc.screen, { paddingTop: Math.max(insets.top, 12) }]}>
      <CabeceraOwner
        titulo="Mantenimientos"
        subtitulo={car ? `${car.marca} ${car.modelo} · ${car.patente || "—"}` : "Selecciona un auto"}
        onBack={onBack}
      />

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        {loading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 30 }} />
        ) : error ? (
          <Text style={styles.errorText}>{error}</Text>
        ) : (
          <>
            <SeccionMantencion
              titulo="Documentación legal"
              lista={documentos}
              render={(d) => (d.fecha_vencimiento ? `Vence: ${fmtFecha(d.fecha_vencimiento)}` : "Sin fecha de vencimiento")}
              onAdd={() => setForm({ tipo: "documento_legal" })}
              ctaLabel="Registrar documento"
            />
            <SeccionMantencion
              titulo="Bitácora de taller"
              lista={servicios}
              render={(m) => (m.kilometraje ? `A los ${m.kilometraje.toLocaleString("es-CL")} km` : fmtFecha(m.creado_en))}
              onAdd={() => setForm({ tipo: "servicio_mecanico" })}
              ctaLabel="Registrar mantención"
            />
          </>
        )}
      </ScrollView>

      <Modal visible={!!form} transparent animationType="fade" onRequestClose={() => setForm(null)}>
        <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === "ios" ? "padding" : "height"}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {form?.tipo === "documento_legal" ? "Nuevo documento legal" : "Nueva mantención"}
            </Text>
            <ScrollView
              style={styles.modalScroll}
              contentContainerStyle={styles.modalScrollContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <TextInput
                style={styles.input}
                placeholder={form?.tipo === "documento_legal" ? "ej. Revisión técnica" : "ej. Cambio de aceite"}
                placeholderTextColor={colors.textPlaceholder}
                value={f.nombre}
                onChangeText={(v) => setF((p) => ({ ...p, nombre: v }))}
              />
              {form?.tipo === "documento_legal" ? (
                <TextInput
                  style={styles.input}
                  placeholder="Vencimiento (AAAA-MM-DD)"
                  placeholderTextColor={colors.textPlaceholder}
                  value={f.fecha}
                  onChangeText={(v) => setF((p) => ({ ...p, fecha: v }))}
                />
              ) : (
                <TextInput
                  style={styles.input}
                  placeholder="Kilometraje (opcional)"
                  placeholderTextColor={colors.textPlaceholder}
                  value={f.km}
                  onChangeText={(v) => setF((p) => ({ ...p, km: v }))}
                  keyboardType="number-pad"
                />
              )}
              <TextInput
                style={[styles.input, { minHeight: 72, textAlignVertical: "top" }]}
                placeholder="Notas (opcional)"
                placeholderTextColor={colors.textPlaceholder}
                value={f.notas}
                onChangeText={(v) => setF((p) => ({ ...p, notas: v }))}
                multiline
              />
            </ScrollView>
            <View style={styles.modalActions}>
              <Button variant="secondary" label="Cancelar" onPress={() => setForm(null)} style={{ flex: 1 }} />
              <Button label="Guardar" onPress={guardar} loading={saving} style={{ flex: 1 }} />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { padding: theme.spacing.screen, gap: theme.spacing.lg, paddingBottom: theme.spacing.xxxl },
  errorText: { color: colors.danger, fontSize: 13, marginTop: 20, textAlign: "center" },
  sec: { gap: theme.spacing.sm },
  empty: { fontSize: 13, color: colors.textMuted, paddingVertical: 6 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing.md,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rowName: { fontSize: 14, fontWeight: "600", color: colors.text },
  rowMeta: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 4,
    paddingVertical: 11,
    borderRadius: theme.radius.field,
    backgroundColor: colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: colors.borderDark,
    borderStyle: "dashed",
  },
  addBtnText: { color: colors.accentDark, fontSize: 13, fontWeight: "600" },
  overlay: { flex: 1, backgroundColor: "rgba(6,30,31,0.45)", justifyContent: "center", padding: theme.spacing.xl },
  modalCard: {
    backgroundColor: colors.surface,
    borderRadius: theme.radius.card,
    padding: theme.spacing.xl,
    borderWidth: 1,
    borderColor: colors.border,
    gap: theme.spacing.md,
  },
  modalTitle: { fontSize: 17, fontWeight: "700", color: colors.text },
  modalScroll: { maxHeight: 300 },
  modalScrollContent: { gap: theme.spacing.md, paddingVertical: 2 },
  input: {
    backgroundColor: colors.surface,
    borderRadius: theme.radius.field,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.text,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  modalActions: { flexDirection: "row", gap: theme.spacing.md, marginTop: 4 },
});
