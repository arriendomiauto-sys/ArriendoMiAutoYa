import React, { useState } from "react";
import {
  View, Text, StyleSheet, Modal, TextInput, ScrollView,
  TouchableOpacity, KeyboardAvoidingView, Platform,
} from "react-native";
import {
  colors, theme, Icon, Button, Chip, SectionLabel, showAlert, msjError,
  ApiClient, CampoConSugerencias, buscarBancos, TIPOS_CUENTA_CHILE,
  useApp,
} from "@rentacar/mobile-shared";

const VACIO = { banco: "", tipo_cuenta: "", numero: "", titular: "", rut: "" };

export function CuentaCobroModal({
  visible,
  onClose,
  onGuardada,
  nombreTitular: propNombre,
  rutTitular: propRut,
  identidadVerificada: propVerificada,
}) {
  let currentUser = null;
  try {
    const app = useApp();
    currentUser = app?.currentUser;
  } catch {
    // Fuera de contexto AppProvider (ej. tests unitarios)
  }

  const nombreTitular = (propNombre !== undefined ? propNombre : currentUser?.nombre) || "";
  const rutTitular = (propRut !== undefined ? propRut : currentUser?.rut) || "";
  const identidadVerificada = propVerificada !== undefined ? propVerificada : (currentUser?.estado_documentos === "verificado");

  const [form, setForm] = useState(VACIO);
  const [guardando, setGuardando] = useState(false);

  React.useEffect(() => {
    if (!visible) {
      setForm(VACIO);
      setGuardando(false);
    } else {
      setForm((prev) => ({
        ...prev,
        titular: nombreTitular || prev.titular,
        rut: prev.rut || rutTitular,
      }));
    }
  }, [visible, nombreTitular, rutTitular]);

  const guardar = async () => {
    if (guardando) return;
    const titularFinal = (nombreTitular || form.titular || "").trim();
    if (!form.banco || !form.tipo_cuenta || !form.numero || !titularFinal || !form.rut) {
      showAlert("Datos incompletos", "Completa el banco, el tipo de cuenta, el número, el titular y su RUT.");
      return;
    }
    setGuardando(true);
    try {
      const cuenta = await ApiClient.agregarCuentaCobro({
        ...form,
        titular: titularFinal,
      });
      onGuardada?.(cuenta);
      onClose?.();
    } catch (err) {
      showAlert("No se pudo guardar", msjError(err, "Verifica el RUT e inténtalo de nuevo."));
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

            {/* Número de cuenta */}
            <View style={{ gap: 6, marginBottom: theme.spacing.md }}>
              <SectionLabel>Número de cuenta</SectionLabel>
              <TextInput
                style={styles.input}
                value={form.numero}
                onChangeText={(v) => setForm((p) => ({ ...p, numero: v }))}
                placeholder=""
                placeholderTextColor={colors.textPlaceholder}
                keyboardType="number-pad"
                accessibilityLabel="Número de cuenta"
              />
            </View>

            {/* Nombre del titular: bloqueado con el nombre oficial del registro y carnet KYC */}
            <View style={{ gap: 6, marginBottom: theme.spacing.md }}>
              <SectionLabel>Nombre del titular</SectionLabel>
              {nombreTitular ? (
                <View style={[styles.input, styles.inputBloqueado]}>
                  <Text style={styles.inputBloqueadoTexto}>{nombreTitular}</Text>
                  <Icon
                    name={identidadVerificada ? "check-circle" : "lock"}
                    size={16}
                    color={colors.primary}
                  />
                </View>
              ) : (
                <TextInput
                  style={styles.input}
                  value={form.titular}
                  onChangeText={(v) => setForm((p) => ({ ...p, titular: v }))}
                  placeholder="Como aparece en tu cuenta"
                  placeholderTextColor={colors.textPlaceholder}
                  accessibilityLabel="Nombre del titular"
                />
              )}
              {nombreTitular ? (
                <View style={styles.ayudaRow}>
                  <Icon
                    name={identidadVerificada ? "check-circle" : "shield"}
                    size={12}
                    color={identidadVerificada ? colors.primary : colors.accent700}
                  />
                  <Text style={[styles.ayudaBloqueo, identidadVerificada && { color: colors.primary }]}>
                    {identidadVerificada
                      ? "Nombre validado con tu carnet de identidad (KYC)."
                      : "Nombre de tu registro. Debe coincidir con tu carnet de identidad."}
                  </Text>
                </View>
              ) : null}
            </View>

            {/* RUT del titular */}
            <View style={{ gap: 6, marginBottom: theme.spacing.md }}>
              <SectionLabel>RUT del titular</SectionLabel>
              <TextInput
                style={styles.input}
                value={form.rut}
                onChangeText={(v) => setForm((p) => ({ ...p, rut: v }))}
                placeholder="12.345.678-9"
                placeholderTextColor={colors.textPlaceholder}
                accessibilityLabel="RUT del titular"
              />
            </View>
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
    justifyContent: "center",
  },
  inputBloqueado: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.surfaceMuted || "#F1F5F9",
    borderColor: colors.border,
  },
  inputBloqueadoTexto: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.text,
  },
  ayudaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 2,
  },
  ayudaBloqueo: {
    fontSize: 12,
    color: colors.textMuted,
    lineHeight: 16,
    flex: 1,
  },
});
