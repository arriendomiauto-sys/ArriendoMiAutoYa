import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { colors } from "../theme/colors";
import { theme } from "../theme/tokens";
import { Icon } from "../components/Icon";
import { Button } from "../components/ui";
import { ApiClient } from "../api/client";
import { showAlert } from "../utils/alert";

const TIPOS_FALTAS = [
  { id: "fumar", label: "Fumar en el auto", sugerido: 50000, desc: "Olor a tabaco o cenizas en el interior" },
  { id: "lugar_no_acordado", label: "Lugar no acordado", sugerido: 60000, desc: "Devolución en sector no pactado" },
  { id: "mascotas", label: "Mascotas sin canil", sugerido: 25000, desc: "Pelos o suciedad en tapicería" },
  { id: "limpieza_estandar", label: "Suciedad excesiva", sugerido: 15000, desc: "Barro, arena o basura acumulada" },
  { id: "limpieza_profunda", label: "Limpieza profunda", sugerido: 35000, desc: "Manchas en tapiz o líquidos" },
  { id: "peajes_tag", label: "Peajes / TAG", sugerido: 0, desc: "Cobro de pórticos o peajes" },
  { id: "otro", label: "Otra falta", sugerido: 0, desc: "Infracción declarada con justificación" },
];

export function ReportFineModal({
  visible,
  reserva,
  onClose,
  onApplied,
}) {
  const [tipo, setTipo] = useState("fumar");
  const [monto, setMonto] = useState("50000");
  const [motivo, setMotivo] = useState("");
  const [fotoUrl, setFotoUrl] = useState("");
  const [loading, setLoading] = useState(false);

  if (!reserva) return null;

  const handleSelectTipo = (item) => {
    setTipo(item.id);
    if (item.sugerido > 0) {
      setMonto(item.sugerido.toString());
    }
  };

  const handleAplicar = async () => {
    const montoNum = parseInt(monto, 10);
    if (isNaN(montoNum) || montoNum <= 0) {
      showAlert("Monto inválido", "Ingresa un monto válido para el cargo en pesos chilenos.");
      return;
    }
    if (!motivo.trim() || motivo.trim().length < 4) {
      showAlert("Motivo requerido", "Por favor ingresa una explicación detallada de la falta.");
      return;
    }

    setLoading(true);
    try {
      const res = await ApiClient.aplicarMultaReserva(reserva.id, {
        tipo,
        monto_clp: montoNum,
        motivo: motivo.trim(),
        fotos: fotoUrl.trim() ? [fotoUrl.trim()] : [],
      });
      showAlert(
        "Multa aplicada",
        `Se registró el cargo de $${montoNum.toLocaleString("es-CL")} CLP correctamente y se notificó al arrendatario.`,
        [{ text: "OK", onPress: () => { onClose(); onApplied && onApplied(res); } }]
      );
    } catch (err) {
      showAlert("No se pudo aplicar la multa", err.message || "Inténtalo de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.sheet}>
          <View style={styles.header}>
            <View style={styles.iconCircle}>
              <Icon name="alert-triangle" size={24} color={colors.warning} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>Reportar falta o penalización</Text>
              <Text style={styles.subtitle}>Se descontará del hold de garantía y liquidará a tu favor</Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={theme.control.hitSlop} style={styles.closeBtn}>
              <Icon name="close" size={20} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={styles.sectionTitle}>Tipo de falta</Text>
            <View style={styles.typesGrid}>
              {TIPOS_FALTAS.map((item) => {
                const selected = tipo === item.id;
                return (
                  <TouchableOpacity
                    key={item.id}
                    style={[styles.typeButton, selected && styles.typeButtonSelected]}
                    onPress={() => handleSelectTipo(item)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.typeButtonText, selected && styles.typeButtonTextSelected]}>
                      {item.label}
                    </Text>
                    {item.sugerido > 0 && (
                      <Text style={[styles.typeButtonPrice, selected && styles.typeButtonPriceSelected]}>
                        ${item.sugerido.toLocaleString("es-CL")}
                      </Text>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Monto de la multa (CLP)</Text>
              <TextInput
                style={styles.input}
                value={monto}
                onChangeText={setMonto}
                keyboardType="numeric"
                placeholder="ej. 50000"
                placeholderTextColor={colors.textPlaceholder}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Explicación / Justificación</Text>
              <TextInput
                style={[styles.input, { minHeight: 64 }]}
                value={motivo}
                onChangeText={setMotivo}
                multiline
                numberOfLines={3}
                placeholder="Describe la falta observada en la entrega/devolución..."
                placeholderTextColor={colors.textPlaceholder}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>URL de foto de evidencia (opcional)</Text>
              <TextInput
                style={styles.input}
                value={fotoUrl}
                onChangeText={setFotoUrl}
                autoCapitalize="none"
                placeholder="https://..."
                placeholderTextColor={colors.textPlaceholder}
              />
            </View>

            <Button
              label="Aplicar cargo y notificar"
              onPress={handleAplicar}
              loading={loading}
              variant="primary"
              style={{ marginTop: 8 }}
            />
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(10, 15, 29, 0.65)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: theme.radius.xl,
    borderTopRightRadius: theme.radius.xl,
    maxHeight: "90%",
    paddingBottom: 24,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.md,
    paddingHorizontal: theme.spacing.screen,
    paddingTop: theme.spacing.lg,
    paddingBottom: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.warningSubtle,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontSize: 17, fontWeight: "700", color: colors.text },
  subtitle: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  closeBtn: { padding: 4 },
  scrollContent: {
    padding: theme.spacing.screen,
    gap: theme.spacing.md,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  typesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  typeButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    alignItems: "center",
  },
  typeButtonSelected: {
    borderColor: colors.accent,
    backgroundColor: colors.accent100,
  },
  typeButtonText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.text,
  },
  typeButtonTextSelected: {
    color: colors.accentDark,
  },
  typeButtonPrice: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },
  typeButtonPriceSelected: {
    color: colors.accent800,
    fontWeight: "700",
  },
  inputGroup: { gap: 6 },
  inputLabel: { fontSize: 13, fontWeight: "600", color: colors.text },
  input: {
    backgroundColor: colors.background,
    borderRadius: theme.radius.field,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.text,
  },
});
