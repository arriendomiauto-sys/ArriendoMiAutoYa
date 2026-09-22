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
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "../theme/colors";
import { theme } from "../theme/tokens";
import { Icon } from "../components/Icon";
import { Button } from "../components/ui";
import { AdjuntarFoto } from "../components/AdjuntarFoto";
import { ApiClient } from "../api/client";
import { showAlert } from "../utils/alert";
import { msjError } from "../utils/msjError";

/**
 * Peajes, TAG y fotomultas no se ven en la devolución: las autopistas
 * urbanas son de flujo libre y la boleta llega semanas después, siempre a
 * nombre del titular de la patente. Por eso se cobran aparte, dentro de los
 * 30 días que permite el backend (`POST /reservas/{id}/cobro-posterior`),
 * directo contra la tarjeta de crédito de garantía — nunca contra la
 * tarjeta de débito con la que ya se pagó el arriendo.
 *
 * `tipo` usa los mismos valores que espera el backend
 * (CobroPosteriorRequest: "tag" | "peaje" | "multa" | "otro").
 */
const TIPOS_COBRO = [
  { id: "tag", label: "TAG" },
  { id: "peaje", label: "Peaje" },
  { id: "multa", label: "Multa / Fotomulta" },
];

export function CobroPosteriorModal({ visible, reserva, onClose, onCobrado }) {
  let insets = { bottom: 0, top: 0, left: 0, right: 0 };
  try {
    insets = useSafeAreaInsets();
  } catch (e) {
    // Si corre fuera de SafeAreaProvider en tests
  }
  const [tipo, setTipo] = useState("tag");
  const [monto, setMonto] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [comprobanteUrl, setComprobanteUrl] = useState("");
  const [loading, setLoading] = useState(false);

  const formValido = Boolean(
    monto && parseInt(monto, 10) > 0 && descripcion.trim().length >= 3 && comprobanteUrl.trim()
  );

  if (!reserva) return null;

  const handleCobrar = async () => {
    if (loading) return;
    const montoNum = parseInt(monto, 10);
    if (isNaN(montoNum) || montoNum <= 0) {
      showAlert("Monto inválido", "Ingresa el monto exacto de la boleta en pesos chilenos.");
      return;
    }
    if (!descripcion.trim() || descripcion.trim().length < 3) {
      showAlert("Falta la descripción", "Describe brevemente el cobro (pórtico, fecha, patente, etc.).");
      return;
    }
    if (!comprobanteUrl.trim()) {
      showAlert("Falta el comprobante", "Adjunta la boleta de la concesionaria o el parte cursado que respalda el cobro.");
      return;
    }

    setLoading(true);
    try {
      const res = await ApiClient.cobrarPosterior(reserva.id, {
        tipo,
        monto: montoNum,
        descripcion: descripcion.trim(),
        comprobante_url: comprobanteUrl.trim(),
      });
      showAlert(
        "Cobro realizado",
        `Se cobró $${montoNum.toLocaleString("es-CL")} CLP a la tarjeta de garantía del arrendatario.`,
        [{ text: "OK", onPress: () => { onClose(); onCobrado && onCobrado(res); } }]
      );
    } catch (err) {
      showAlert("No se pudo realizar el cobro", msjError(err, "Inténtalo de nuevo."));
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
        <View style={[styles.sheet, { paddingBottom: Math.max(insets?.bottom || 0, 16) + 8 }]}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <View style={styles.iconCircle}>
              <Icon name="alert-triangle" size={24} color={colors.warning} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>Reportar peaje o fotomulta</Text>
              <Text style={styles.subtitle}>Se cobra a la tarjeta de garantía del arrendatario</Text>
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
            <Text style={styles.sectionHelp}>
              Peajes, TAG y fotomultas se notifican a tu nombre semanas después del arriendo. Se
              cobran a la tarjeta de crédito registrada del arrendatario, dentro de los 30 días
              siguientes al fin del arriendo.
            </Text>

            <Text style={styles.sectionTitle}>Tipo de cobro</Text>
            <View style={styles.typesGrid}>
              {TIPOS_COBRO.map((item) => {
                const selected = tipo === item.id;
                return (
                  <TouchableOpacity
                    key={item.id}
                    style={[styles.typeButton, selected && styles.typeButtonSelected]}
                    onPress={() => setTipo(item.id)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.typeButtonText, selected && styles.typeButtonTextSelected]}>
                      {item.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Monto exacto de la boleta (CLP)</Text>
              <TextInput
                style={styles.input}
                value={monto}
                onChangeText={setMonto}
                keyboardType="numeric"
                placeholder="ej. 3200"
                placeholderTextColor={colors.textPlaceholder}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Descripción</Text>
              <TextInput
                style={[styles.input, { minHeight: 64 }]}
                value={descripcion}
                onChangeText={setDescripcion}
                multiline
                numberOfLines={3}
                placeholder="Pórtico, fecha y hora del pase o de la infracción..."
                placeholderTextColor={colors.textPlaceholder}
              />
            </View>

            <AdjuntarFoto
              etiqueta="Boleta de la concesionaria o parte cursado"
              ayuda="Es el respaldo del cobro: el arrendatario lo puede revisar en su historial."
              url={comprobanteUrl}
              onUrl={setComprobanteUrl}
              bucket="evidencias"
              obligatorio
            />

            <Button
              label="Cobrar y notificar al arrendatario"
              onPress={handleCobrar}
              loading={loading}
              disabled={loading}
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
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.borderDark,
    alignSelf: "center",
    marginTop: 10,
    marginBottom: 2,
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
  sectionHelp: {
    fontSize: 12,
    lineHeight: 17,
    color: colors.textMuted,
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
