import React, { useState } from "react";
import {
  View, Text, StyleSheet, Modal, TextInput, ScrollView,
  TouchableOpacity, KeyboardAvoidingView, Platform,
} from "react-native";
import {
  colors, theme, Icon, Button, Chip, SectionLabel, showAlert,
  ApiClient, CampoConSugerencias, buscarBancos, TIPOS_CUENTA_CHILE,
} from "@rentacar/mobile-shared";

const VACIO = { banco: "", tipo_cuenta: "", numero: "", titular: "", rut: "" };

export function CuentaCobroModal({ visible, onClose, onGuardada }) {
  const [form, setForm] = useState(VACIO);
  const [guardando, setGuardando] = useState(false);

  React.useEffect(() => {
    if (!visible) { setForm(VACIO); setGuardando(false); }
  }, [visible]);

  const guardar = async () => {
    if (guardando) return;
    if (!form.banco || !form.tipo_cuenta || !form.numero || !form.titular || !form.rut) {
      showAlert("Datos incompletos", "Completa el banco, el tipo de cuenta, el número, el titular y su RUT.");
      return;
    }
    setGuardando(true);
    try {
      const cuenta = await ApiClient.agregarCuentaCobro(form);
      onGuardada?.(cuenta);
      onClose?.();
    } catch (err) {
      showAlert("No se pudo guardar", err?.message || "Verifica el RUT e intenta de nuevo.");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.rowBetween}>
            <Text style={styles.title}>Nueva cuenta de cobro</Text>
            <TouchableOpacity onPress={onClose} hitSlop={theme.control.hitSlop}>
              <Icon name="close" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
          <Text style={styles.sub}>
            La cuenta de débito o vista donde recibes tus pagos. ¿Tienes CuentaRUT? Tu número de cuenta es tu RUT sin el dígito verificador.
          </Text>
          <ScrollView style={{ maxHeight: 380 }} keyboardShouldPersistTaps="handled">
            <View style={{ marginBottom: theme.spacing.md }}>
              <CampoConSugerencias
                etiqueta="Banco"
                valor={form.banco}
                onChange={(v) => setForm((p) => ({ ...p, banco: v }))}
                buscar={buscarBancos}
                placeholder="Escribe y elige de la lista"
              />
            </View>
            <View style={{ gap: 8, marginBottom: theme.spacing.md }}>
              <SectionLabel>Tipo de cuenta</SectionLabel>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.sm }}>
                {TIPOS_CUENTA_CHILE.map((tipo) => (
                  <Chip key={tipo} label={tipo} selected={form.tipo_cuenta === tipo}
                        onPress={() => setForm((p) => ({ ...p, tipo_cuenta: tipo }))} />
                ))}
              </View>
            </View>
            {[
              { k: "numero", label: "Número de cuenta", kb: "number-pad" },
              { k: "titular", label: "Nombre del titular" },
              { k: "rut", label: "RUT del titular", ph: "12.345.678-9" },
            ].map((f) => (
              <View key={f.k} style={{ gap: 6, marginBottom: theme.spacing.md }}>
                <SectionLabel>{f.label}</SectionLabel>
                <TextInput
                  style={styles.input}
                  value={form[f.k]}
                  onChangeText={(v) => setForm((p) => ({ ...p, [f.k]: v }))}
                  placeholder={f.ph || ""}
                  placeholderTextColor={colors.textPlaceholder}
                  keyboardType={f.kb || "default"}
                  accessibilityLabel={f.label}
                />
              </View>
            ))}
          </ScrollView>
          <Button label="Guardar cuenta" onPress={guardar} loading={guardando} />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(6,30,31,0.55)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: colors.surface, borderTopLeftRadius: theme.radius.lg,
    borderTopRightRadius: theme.radius.lg, padding: theme.spacing.xl,
    paddingBottom: theme.spacing.xxl, gap: theme.spacing.sm, maxHeight: "92%",
  },
  handle: { width: 40, height: 4, borderRadius: 999, backgroundColor: colors.border, alignSelf: "center" },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  title: { fontSize: 18, fontWeight: "800", color: colors.text },
  sub: { fontSize: 12.5, color: colors.textMuted, lineHeight: 17, marginBottom: theme.spacing.sm },
  input: {
    height: 48, borderWidth: 1.5, borderColor: colors.border, borderRadius: theme.radius.field,
    paddingHorizontal: theme.spacing.md, fontSize: 15, color: colors.text, backgroundColor: colors.surface,
  },
});
