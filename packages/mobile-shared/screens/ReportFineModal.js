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
import { DateTimeField, aISOLocal } from "../components/DateTimeField";
import { ApiClient } from "../api/client";
import { showAlert } from "../utils/alert";

const TIPOS_FALTAS = [
  { id: "fumar", label: "Fumar en el auto", sugerido: 50000, desc: "Olor a tabaco o cenizas en el interior" },
  { id: "lugar_no_acordado", label: "Lugar no acordado", sugerido: 60000, desc: "Devolución en sector no pactado" },
  { id: "mascotas", label: "Mascotas sin canil", sugerido: 25000, desc: "Pelos o suciedad en tapicería" },
  { id: "limpieza_estandar", label: "Suciedad excesiva", sugerido: 15000, desc: "Barro, arena o basura acumulada" },
  { id: "limpieza_profunda", label: "Limpieza profunda", sugerido: 35000, desc: "Manchas en tapiz o líquidos" },
  { id: "otro", label: "Otra falta", sugerido: 0, desc: "Infracción declarada con justificación" },
];

/**
 * Peajes y fotomultas no se ven en la devolución: las autopistas urbanas son
 * de flujo libre y la boleta llega semanas después, siempre a nombre del
 * titular de la patente. Por eso se cobran aparte, con la fecha del pórtico y
 * la boleta de respaldo, y solo dentro del plazo que fija la plataforma.
 */
const TIPOS_CARGO_POSTERIOR = [
  { id: "peajes_tag", label: "Peajes / TAG", sugerido: 0, desc: "Pórticos pasados durante el arriendo" },
  { id: "fotomulta", label: "Fotomulta", sugerido: 0, desc: "Parte cursado por fotorradar o control" },
];

const esCargoPosterior = (id) => TIPOS_CARGO_POSTERIOR.some((t) => t.id === id);

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
  const [fechaEvento, setFechaEvento] = useState(null);
  const [documentoUrl, setDocumentoUrl] = useState("");
  const [loading, setLoading] = useState(false);

  if (!reserva) return null;

  const cargoPosterior = esCargoPosterior(tipo);
  const inicioArriendo = reserva.fecha_inicio ? new Date(reserva.fecha_inicio) : undefined;
  const finArriendo = reserva.fecha_fin ? new Date(reserva.fecha_fin) : undefined;

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
    if (cargoPosterior) {
      if (!fechaEvento) {
        showAlert(
          "Falta la fecha",
          "Indica la fecha del pórtico o de la infracción: solo se cobra lo ocurrido durante el arriendo."
        );
        return;
      }
      if (!documentoUrl.trim()) {
        showAlert(
          "Falta el respaldo",
          "Adjunta la boleta de la concesionaria o el parte cursado que respalda el cobro."
        );
        return;
      }
    }

    setLoading(true);
    try {
      const res = await ApiClient.aplicarMultaReserva(reserva.id, {
        tipo,
        monto_clp: montoNum,
        motivo: motivo.trim(),
        fotos: fotoUrl.trim() ? [fotoUrl.trim()] : [],
        ...(cargoPosterior
          ? { fecha_evento: aISOLocal(fechaEvento), documento_url: documentoUrl.trim() }
          : {}),
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

            <Text style={styles.sectionTitle}>Cobros que llegan después</Text>
            <Text style={styles.sectionHelp}>
              Peajes y fotomultas se notifican a tu nombre semanas después. Se cobran a la
              tarjeta registrada del arrendatario, solo por lo ocurrido durante su arriendo.
            </Text>
            <View style={styles.typesGrid}>
              {TIPOS_CARGO_POSTERIOR.map((item) => {
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
                  </TouchableOpacity>
                );
              })}
            </View>

            {cargoPosterior && (
              <>
                <View style={styles.inputGroup}>
                  <DateTimeField
                    label="Fecha del pórtico o de la infracción"
                    value={fechaEvento}
                    onChange={setFechaEvento}
                    minimumDate={inicioArriendo}
                    maximumDate={finArriendo}
                    helper="Debe caer dentro del período de arriendo del cliente"
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>URL de la boleta o del parte</Text>
                  <TextInput
                    style={styles.input}
                    value={documentoUrl}
                    onChangeText={setDocumentoUrl}
                    autoCapitalize="none"
                    placeholder="https://..."
                    placeholderTextColor={colors.textPlaceholder}
                  />
                </View>
              </>
            )}

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>
                {cargoPosterior ? "Monto exacto de la boleta (CLP)" : "Monto de la multa (CLP)"}
              </Text>
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
  sectionHelp: {
    fontSize: 12,
    lineHeight: 17,
    color: colors.textMuted,
    marginTop: -4,
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
