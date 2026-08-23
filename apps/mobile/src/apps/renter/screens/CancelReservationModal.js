import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  ScrollView,
} from "react-native";
import { colors } from "../../../theme/colors";
import { Icon } from "../../../shared/components/Icon";

export function CancelReservationModal({
  reservation,
  onClose,
  onConfirmCancel,
}) {
  const [selectedReason, setSelectedReason] = useState("Cambiaron mis planes");

  const totalPaid = reservation?.totalAmount || 188020;
  const penalty = Math.round(totalPaid * 0.3);
  const refund = totalPaid - penalty;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />

      {/* Top Header (Pantalla 19) */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose}>
          <Icon name="arrow-left" size={20} color={colors.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Cancelar la reserva</Text>
      </View>

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        {/* Warning Penalty Box (<24h) */}
        <View style={styles.penaltyNoticeBox}>
          <Text style={styles.penaltyNoticeTitle}>Queda menos de 24 horas</Text>
          <Text style={styles.penaltyNoticeDesc}>
            El retiro es mañana a las 10:00, así que aplica la penalidad del 30%.
          </Text>
        </View>

        {/* Refund Calculations Card */}
        <View style={styles.calcCard}>
          <View style={styles.calcRow}>
            <Text style={styles.calcLabel}>Total pagado</Text>
            <Text style={styles.calcVal}>${totalPaid.toLocaleString("es-CL")}</Text>
          </View>
          <View style={styles.calcRow}>
            <Text style={styles.calcLabel}>Penalidad 30%</Text>
            <Text style={styles.penaltyVal}>−${penalty.toLocaleString("es-CL")}</Text>
          </View>
          <View style={[styles.calcRow, styles.calcDivider]}>
            <Text style={styles.refundTotalLabel}>Se le devuelve</Text>
            <Text style={styles.refundTotalVal}>${refund.toLocaleString("es-CL")}</Text>
          </View>
          <Text style={styles.guaranteeReleaseNote}>
            La garantía de $150.000 se libera completa. Puede tardar 5 días hábiles en su cupo.
          </Text>
        </View>

        {/* Motivo Selector */}
        <View style={styles.reasonSection}>
          <Text style={styles.reasonSectionTitle}>MOTIVO</Text>
          <View style={styles.reasonCard}>
            {["Cambiaron mis planes", "Encontré otro auto", "Problema con el dueño"].map(
              (reason, index) => {
                const isSelected = selectedReason === reason;
                return (
                  <TouchableOpacity
                    key={reason}
                    style={[
                      styles.reasonItem,
                      index === 2 && { borderBottomWidth: 0 },
                    ]}
                    onPress={() => setSelectedReason(reason)}
                    activeOpacity={0.8}
                  >
                    <View
                      style={[
                        styles.radioOuter,
                        isSelected && styles.radioOuterSelected,
                      ]}
                    >
                      {isSelected && <View style={styles.radioInner} />}
                    </View>
                    <Text style={styles.reasonItemText}>{reason}</Text>
                  </TouchableOpacity>
                );
              }
            )}
          </View>
        </View>
      </ScrollView>

      {/* Bottom CTA */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={styles.cancelDangerBtn}
          onPress={() => onConfirmCancel(refund)}
          activeOpacity={0.85}
        >
          <Text style={styles.cancelDangerBtnText}>
            Cancelar y aceptar la penalidad
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.keepReservationLink}
          onPress={onClose}
          activeOpacity={0.8}
        >
          <Text style={styles.keepReservationText}>Mantener mi reserva</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
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
