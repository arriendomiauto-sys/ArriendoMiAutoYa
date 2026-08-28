import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { colors, Icon, ApiClient, showAlert } from "@rentacar/mobile-shared";

export function CancelReservationModal({
  reservation,
  onClose,
  onConfirmCancel,
}) {
  const [cancelling, setCancelling] = useState(false);

  const montoHold = reservation?.monto_hold || 0;
  const horasParaRetiro = reservation?.fecha_inicio
    ? (new Date(reservation.fecha_inicio).getTime() - Date.now()) / 3_600_000
    : null;
  const esMenosDe24h = horasParaRetiro !== null && horasParaRetiro < 24 && horasParaRetiro > 0;

  const handleCancelar = async () => {
    if (!reservation?.id) {
      onConfirmCancel();
      return;
    }
    setCancelling(true);
    try {
      const actualizada = await ApiClient.actualizarEstadoReserva(reservation.id, "cancelada");
      onConfirmCancel(actualizada);
    } catch (err) {
      showAlert("No se pudo cancelar", err.message);
    } finally {
      setCancelling(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />

      {/* Top Header (Pantalla 19) */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose}>
          <Icon name="arrow-left" size={20} color={colors.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Cancelar la reserva</Text>
      </View>

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        {esMenosDe24h && (
          <View style={styles.penaltyNoticeBox}>
            <Text style={styles.penaltyNoticeTitle}>Queda menos de 24 horas</Text>
            <Text style={styles.penaltyNoticeDesc}>
              El retiro está agendado muy pronto. Revisa con el dueño antes de cancelar.
            </Text>
          </View>
        )}

        {/* Resumen real de la reserva */}
        <View style={styles.calcCard}>
          <View style={styles.calcRow}>
            <Text style={styles.calcLabel}>Garantía retenida (hold)</Text>
            <Text style={styles.calcVal}>${montoHold.toLocaleString("es-CL")}</Text>
          </View>
          {reservation?.fecha_inicio && (
            <View style={styles.calcRow}>
              <Text style={styles.calcLabel}>Fecha de retiro acordada</Text>
              <Text style={styles.calcVal}>
                {new Date(reservation.fecha_inicio).toLocaleDateString("es-CL")}
              </Text>
            </View>
          )}
          <Text style={styles.guaranteeReleaseNote}>
            Al cancelar, tu garantía queda liberada. Si el retiro es en menos de 24 horas, nuestro
            equipo de soporte se comunicará contigo para coordinar cualquier ajuste según nuestra
            política de cancelación.
          </Text>
        </View>
      </ScrollView>

      {/* Bottom CTA */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={[styles.cancelDangerBtn, cancelling && styles.btnDisabled]}
          onPress={handleCancelar}
          disabled={cancelling}
          activeOpacity={0.85}
        >
          {cancelling ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.cancelDangerBtnText}>Confirmar cancelación</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.keepReservationLink}
          onPress={onClose}
          activeOpacity={0.8}
        >
          <Text style={styles.keepReservationText}>Mantener mi reserva</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: "space-between",
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: colors.text,
  },
  body: {
    padding: 20,
    gap: 16,
  },
  penaltyNoticeBox: {
    backgroundColor: "#FBE9E9",
    borderRadius: 12,
    padding: 16,
    gap: 6,
  },
  penaltyNoticeTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#A81B1B",
  },
  penaltyNoticeDesc: {
    fontSize: 14,
    color: "#A81B1B",
    lineHeight: 20,
  },
  calcCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 16,
    gap: 11,
  },
  calcRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  calcDivider: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 11,
  },
  calcLabel: {
    fontSize: 15,
    color: colors.textMuted,
  },
  calcVal: {
    fontSize: 15,
    color: colors.text,
  },
  penaltyVal: {
    fontSize: 15,
    color: "#DC2626",
    fontWeight: "600",
  },
  refundTotalLabel: {
    fontSize: 18,
    fontWeight: "600",
    color: colors.text,
  },
  refundTotalVal: {
    fontSize: 18,
    fontWeight: "600",
    color: colors.text,
  },
  guaranteeReleaseNote: {
    fontSize: 14,
    color: colors.textMuted,
    lineHeight: 20,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 11,
  },
  reasonSection: {
    gap: 10,
  },
  reasonSectionTitle: {
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.8,
    color: colors.textMuted,
    textTransform: "uppercase",
  },
  reasonCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    overflow: "hidden",
  },
  reasonItem: {
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  radioOuterSelected: {
    borderColor: colors.primary,
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.primary,
  },
  reasonItemText: {
    fontSize: 15,
    color: colors.text,
  },
  bottomBar: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 30,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: 10,
  },
  cancelDangerBtn: {
    height: 56,
    borderRadius: 12,
    backgroundColor: "#DC2626",
    alignItems: "center",
    justifyContent: "center",
  },
  btnDisabled: {
    opacity: 0.6,
  },
  cancelDangerBtnText: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "600",
  },
  keepReservationLink: {
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  keepReservationText: {
    color: colors.accent700,
    fontSize: 15,
    fontWeight: "600",
  },
});
