import React, { useState, useEffect, useCallback } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, TextInput, ActivityIndicator } from "react-native";
import { colors, theme, Icon, Button, Badge, ScreenHeader, ApiClient, showAlert } from "@rentacar/mobile-shared";

function fmtFecha(iso) {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleDateString("es-CL", { day: "2-digit", month: "long", year: "numeric" });
  } catch {
    return iso;
  }
}

export function CarMaintenanceScreen({ car, onBack }) {
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

  const documentos = items.filter((m) => m.tipo === "documento_legal");
  const servicios = items.filter((m) => m.tipo === "servicio_mecanico");

  const guardar = async () => {
    if (!f.nombre.trim()) {
      showAlert("Falta el nombre", "Ingresa el nombre del documento o servicio.");
      return;
    }
    setSaving(true);
    try {
      await ApiClient.crearMantencion(car.id, {
        tipo: form.tipo,
        nombre: f.nombre.trim(),
        fecha_vencimiento: form.tipo === "documento_legal" && f.fecha ? new Date(f.fecha).toISOString() : null,
        kilometraje: form.tipo === "servicio_mecanico" && f.km ? parseInt(f.km, 10) : null,
        notas: f.notas.trim() || null,
      });
      setForm(null);
      setF({ nombre: "", fecha: "", km: "", notas: "" });
      cargar();
    } catch (err) {
      showAlert("No se pudo guardar", err.message);
    } finally {
      setSaving(false);
    }
  };

  const Seccion = ({ titulo, lista, tipo, render }) => (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{titulo}</Text>
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
      <TouchableOpacity style={styles.addBtn} onPress={() => setForm({ tipo })} activeOpacity={0.85}>
        <Icon name="plus" size={15} color={colors.accent} />
        <Text style={styles.addBtnText}>
          {tipo === "documento_legal" ? "Registrar documento" : "Registrar mantención"}
        </Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      <ScreenHeader
        tone="dark"
        title="Mantenimientos"
        subtitle={car ? `${car.marca} ${car.modelo} · ${car.patente || "—"}` : "Selecciona un auto"}
        onBack={onBack}
      />

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        {loading ? (
          <ActivityIndicator color={colors.accent} style={{ marginTop: 30 }} />
        ) : error ? (
          <Text style={styles.errorText}>{error}</Text>
        ) : (
          <>
            <Seccion
              titulo="Documentación legal"
              lista={documentos}
              tipo="documento_legal"
              render={(d) => (d.fecha_vencimiento ? `Vence: ${fmtFecha(d.fecha_vencimiento)}` : "Sin fecha de vencimiento")}
            />
            <Seccion
              titulo="Bitácora de taller"
              lista={servicios}
              tipo="servicio_mecanico"
              render={(m) => (m.kilometraje ? `A los ${m.kilometraje.toLocaleString("es-CL")} km` : fmtFecha(m.creado_en))}
            />
          </>
        )}
      </ScrollView>

      <Modal visible={!!form} transparent animationType="fade" onRequestClose={() => setForm(null)}>
        <View style={styles.overlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {form?.tipo === "documento_legal" ? "Nuevo documento legal" : "Nueva mantención"}
            </Text>
            <TextInput
              style={styles.input}
              placeholder={form?.tipo === "documento_legal" ? "ej. Revisión técnica" : "ej. Cambio de aceite"}
              placeholderTextColor={colors.textSilver}
              value={f.nombre}
              onChangeText={(v) => setF((p) => ({ ...p, nombre: v }))}
            />
            {form?.tipo === "documento_legal" ? (
              <TextInput
                style={styles.input}
                placeholder="Vencimiento (AAAA-MM-DD)"
                placeholderTextColor={colors.textSilver}
                value={f.fecha}
                onChangeText={(v) => setF((p) => ({ ...p, fecha: v }))}
              />
            ) : (
              <TextInput
                style={styles.input}
                placeholder="Kilometraje (opcional)"
                placeholderTextColor={colors.textSilver}
                value={f.km}
                onChangeText={(v) => setF((p) => ({ ...p, km: v }))}
                keyboardType="number-pad"
              />
            )}
            <TextInput
              style={[styles.input, { minHeight: 72, textAlignVertical: "top" }]}
              placeholder="Notas (opcional)"
              placeholderTextColor={colors.textSilver}
              value={f.notas}
              onChangeText={(v) => setF((p) => ({ ...p, notas: v }))}
              multiline
            />
            <View style={styles.modalActions}>
              <Button tone="dark" variant="secondary" label="Cancelar" onPress={() => setForm(null)} style={{ flex: 1 }} />
              <Button tone="dark" label="Guardar" onPress={guardar} loading={saving} style={{ flex: 1 }} />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.darkBg },
  body: { padding: theme.spacing.screen, gap: theme.spacing.lg, paddingBottom: theme.spacing.xxxl },
  errorText: { color: colors.danger, fontSize: 13, marginTop: 20, textAlign: "center" },
  card: {
    backgroundColor: colors.darkCard,
    borderRadius: theme.radius.card,
    padding: theme.spacing.lg,
    borderWidth: 1,
    borderColor: colors.darkBorder,
    gap: theme.spacing.sm,
  },
  cardTitle: { fontSize: 15, fontWeight: "700", color: colors.textWhite },
  empty: { fontSize: 13, color: colors.darkTextMuted, paddingVertical: 6 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing.md,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.darkBorder,
  },
  rowName: { fontSize: 14, fontWeight: "600", color: colors.textWhite },
  rowMeta: { fontSize: 12, color: colors.darkTextMuted, marginTop: 2 },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 4,
    paddingVertical: 11,
    borderRadius: theme.radius.field,
    backgroundColor: colors.darkCardSubtle,
    borderWidth: 1,
    borderColor: colors.darkBorderStrong,
    borderStyle: "dashed",
  },
  addBtnText: { color: colors.accent, fontSize: 13, fontWeight: "600" },
  overlay: { flex: 1, backgroundColor: "rgba(6,30,31,0.75)", justifyContent: "center", padding: theme.spacing.xl },
  modalCard: {
    backgroundColor: colors.darkCard,
    borderRadius: theme.radius.card,
    padding: theme.spacing.xl,
    borderWidth: 1,
    borderColor: colors.darkBorderStrong,
    gap: theme.spacing.md,
  },
  modalTitle: { fontSize: 17, fontWeight: "700", color: colors.textWhite },
  input: {
    backgroundColor: colors.darkCardSubtle,
    borderRadius: theme.radius.field,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.textWhite,
    borderWidth: 1,
    borderColor: colors.darkBorder,
  },
  modalActions: { flexDirection: "row", gap: theme.spacing.md, marginTop: 4 },
});
