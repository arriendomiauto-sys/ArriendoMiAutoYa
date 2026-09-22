import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "../theme/colors";
import { theme } from "../theme/tokens";
import { Icon } from "../components/Icon";
import { Button } from "../components/ui";
import { ApiClient } from "../api/client";
import { showAlert } from "../utils/alert";
import { msjError } from "../utils/msjError";

export function PreCheckinModal({
  visible,
  reserva,
  role = "cliente", // 'cliente' | 'dueno'
  onClose,
  onConfirmed,
}) {
  let insets = { bottom: 0, top: 0, left: 0, right: 0 };
  try {
    insets = useSafeAreaInsets();
  } catch (e) {
    // Si no está envuelto en SafeAreaProvider en tests
  }
  const [loading, setLoading] = useState(false);
  const [asistencia, setAsistencia] = useState(false);
  const [lugarHora, setLugarHora] = useState(false);
  const [licenciaOAuto, setLicenciaOAuto] = useState(false);
  const [reglas, setReglas] = useState(false);
  const [notas, setNotas] = useState("");

  if (!reserva) return null;

  const auto = reserva.auto || {};
  const isDriver = role === "dueno";
  const yaConfirmado = isDriver ? Boolean(reserva.precheck_dueno_confirmado) : Boolean(reserva.precheck_cliente_confirmado);

  const todoMarcado = Boolean(asistencia && lugarHora && licenciaOAuto && reglas);
  const msHastaRetiro = reserva.fecha_inicio ? new Date(reserva.fecha_inicio).getTime() - Date.now() : null;
  const fueraDeVentana24h = msHastaRetiro !== null && msHastaRetiro > 24 * 3600000;
  const checksMarcados = [asistencia, lugarHora, licenciaOAuto, reglas].filter(Boolean).length;

  const handleConfirmar = async () => {
    if (loading) return;
    if (fueraDeVentana24h) {
      showAlert("Fuera de plazo", "El pre-checkin de confirmación se habilita 24 horas antes del retiro acordado.");
      return;
    }
    if (!todoMarcado) {
      showAlert("Confirmación requerida", "Por favor marca las 4 casillas de verificación para confirmar el viaje.");
      return;
    }

    setLoading(true);
    try {
      const res = await ApiClient.realizarPreCheckin(reserva.id, {
        rol: role,
        confirma_asistencia: asistencia,
        confirma_lugar_hora: lugarHora,
        confirma_licencia_vigente: !isDriver ? licenciaOAuto : undefined,
        confirma_auto_limpio_combustible: isDriver ? licenciaOAuto : undefined,
        notas: notas.trim() || undefined,
      });

      // Actualizar inmediatamente el estado en la app
      if (onConfirmed) {
        onConfirmed(res);
      }
      onClose();

      showAlert(
        "¡Pre-Checkin confirmado!",
        res.ambos_confirmados
          ? "Ambas partes han confirmado la entrega de mañana. ¡Todo listo para tu viaje!"
          : "Tu confirmación quedó registrada con éxito. Notificamos a la otra parte."
      );
    } catch (err) {
      showAlert("No se pudo completar el pre-checkin", msjError(err, "Inténtalo de nuevo."));
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
              <Icon name="check" size={24} color={colors.accent700} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>Verificación 24h antes</Text>
              <Text style={styles.subtitle}>
                {isDriver ? "Confirma que el vehículo está listo para entrega" : "Confirma tu viaje para mañana"}
              </Text>
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
            {/* Tarjeta de Información de Entrega */}
            <View style={styles.infoCard}>
              <Text style={styles.carName}>
                {auto.marca} {auto.modelo}
                {/* Al cliente la patente recién se le muestra al retirar el
                    auto (QR de entrega) — 24h antes no aporta nada y expone
                    de más. El dueño sí ve la de su propio vehículo. */}
                {isDriver && auto.patente ? ` (${auto.patente})` : ""}
              </Text>
              <View style={styles.infoRow}>
                <Icon name="location" size={15} color={colors.primary} />
                <Text style={styles.infoText}>{reserva.lugar_entrega_acordado || "Punto acordado"}</Text>
              </View>
              <View style={styles.securityPill}>
                <Icon name="shield" size={13} color={colors.accent800} />
                <Text style={styles.securityPillText}>Punto de encuentro público coordinado</Text>
              </View>
            </View>

            {/* Aviso si está fuera de la ventana de 24h */}
            {fueraDeVentana24h && (
              <View style={styles.warnCard}>
                <Icon name="clock" size={16} color="#D97706" />
                <Text style={styles.warnText}>
                  Este pre-checkin estará disponible 24 horas antes de la entrega acordada.
                </Text>
              </View>
            )}

            {/* Checklist interactivo */}
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Checklist de confirmación</Text>
              <Text style={[styles.counterBadge, todoMarcado && styles.counterBadgeOk]}>
                {checksMarcados}/4
              </Text>
            </View>

            <TouchableOpacity
              style={styles.checkRow}
              onPress={() => setAsistencia(!asistencia)}
              activeOpacity={0.8}
            >
              <View style={[styles.checkbox, asistencia && styles.checkboxActive]}>
                {asistencia && <Icon name="check" size={13} color="#FFFFFF" />}
              </View>
              <Text style={styles.checkLabel}>
                {isDriver
                  ? "Asistiré puntualmente a la hora acordada para la entrega con código QR."
                  : "Asistiré puntualmente a recibir el auto en el lugar acordado."}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.checkRow}
              onPress={() => setLugarHora(!lugarHora)}
              activeOpacity={0.8}
            >
              <View style={[styles.checkbox, lugarHora && styles.checkboxActive]}>
                {lugarHora && <Icon name="check" size={13} color="#FFFFFF" />}
              </View>
              <Text style={styles.checkLabel}>
                Confirmo que revisé la dirección y tengo planificado mi traslado.
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.checkRow}
              onPress={() => setLicenciaOAuto(!licenciaOAuto)}
              activeOpacity={0.8}
            >
              <View style={[styles.checkbox, licenciaOAuto && styles.checkboxActive]}>
                {licenciaOAuto && <Icon name="check" size={13} color="#FFFFFF" />}
              </View>
              <Text style={styles.checkLabel}>
                {isDriver
                  ? "El vehículo se encuentra limpio, con combustible y documentación al día."
                  : "Mi cédula y licencia de conducir física se encuentran vigentes para el viaje."}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.checkRow}
              onPress={() => setReglas(!reglas)}
              activeOpacity={0.8}
            >
              <View style={[styles.checkbox, reglas && styles.checkboxActive]}>
                {reglas && <Icon name="check" size={13} color="#FFFFFF" />}
              </View>
              <Text style={styles.checkLabel}>
                Acepto las normas de arriendo (prohibido fumar en el vehículo, cuidado y devolución puntual).
              </Text>
            </TouchableOpacity>

            {/* Notas adicionales opcionales */}
            <View style={styles.notesBox}>
              <Text style={styles.notesLabel}>Notas o mensaje para la contraparte (opcional)</Text>
              <TextInput
                style={styles.notesInput}
                placeholder="ej. Estaré esperándote frente a la entrada principal..."
                placeholderTextColor={colors.textPlaceholder}
                value={notas}
                onChangeText={setNotas}
                multiline
                numberOfLines={2}
              />
            </View>

            <Button
              label={isDriver ? "Confirmar disponibilidad del auto" : "Confirmar viaje para mañana"}
              onPress={handleConfirmar}
              loading={loading}
              disabled={!todoMarcado || fueraDeVentana24h}
              iconRight="check"
              style={{ marginTop: 10, opacity: (!todoMarcado || fueraDeVentana24h) ? 0.6 : 1 }}
            />

            {!todoMarcado && !fueraDeVentana24h && (
              <Text style={styles.helperText}>
                Debes marcar las 4 casillas del checklist para poder confirmar.
              </Text>
            )}
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
    maxHeight: "88%",
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
    backgroundColor: colors.accent100,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontSize: 18, fontWeight: "700", color: colors.text },
  subtitle: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  closeBtn: { padding: 4 },
  scrollContent: {
    padding: theme.spacing.screen,
    gap: theme.spacing.md,
  },
  infoCard: {
    backgroundColor: colors.surfaceSubtle,
    borderRadius: theme.radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: theme.spacing.md,
    gap: 8,
  },
  carName: { fontSize: 16, fontWeight: "700", color: colors.text },
  infoRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  infoText: { fontSize: 14, color: colors.text, fontWeight: "500", flex: 1 },
  securityPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.accent100,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: theme.radius.pill,
    alignSelf: "flex-start",
    marginTop: 2,
  },
  securityPillText: { fontSize: 12, color: colors.accent800, fontWeight: "600" },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginTop: 4,
  },
  checkRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    backgroundColor: colors.background,
    padding: 12,
    borderRadius: theme.radius.field,
    borderWidth: 1,
    borderColor: colors.border,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.borderDark,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  checkboxActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  checkLabel: {
    fontSize: 14,
    color: colors.text,
    lineHeight: 20,
    flex: 1,
  },
  notesBox: { gap: 6, marginTop: 4 },
  notesLabel: { fontSize: 12, color: colors.textMuted, fontWeight: "600" },
  notesInput: {
    backgroundColor: colors.background,
    borderRadius: theme.radius.field,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.text,
    minHeight: 56,
  },
  warnCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FEF3C7",
    padding: 12,
    borderRadius: theme.radius.card,
    borderWidth: 1,
    borderColor: "#FDE68A",
  },
  warnText: {
    fontSize: 13,
    color: "#92400E",
    fontWeight: "500",
    flex: 1,
    lineHeight: 18,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 4,
  },
  counterBadge: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.textMuted,
    backgroundColor: colors.surfaceSubtle,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  counterBadgeOk: {
    color: "#065F46",
    backgroundColor: "#D1FAE5",
    borderColor: "#A7F3D0",
  },
  helperText: {
    fontSize: 12,
    color: colors.textMuted,
    textAlign: "center",
    marginTop: 4,
  },
});
