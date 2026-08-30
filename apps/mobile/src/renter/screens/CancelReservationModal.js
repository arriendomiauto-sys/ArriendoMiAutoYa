import React, { useState } from "react";
import { View, Text, StyleSheet, StatusBar, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, theme, Button, Card, ScreenHeader, ApiClient, showAlert } from "@rentacar/mobile-shared";

export function CancelReservationModal({ reservation, onClose, onConfirmCancel }) {
  const insets = useSafeAreaInsets();
  const [cancelling, setCancelling] = useState(false);

  const montoHold = reservation?.monto_hold || 0;
  const horas = reservation?.fecha_inicio
    ? (new Date(reservation.fecha_inicio).getTime() - Date.now()) / 3_600_000
    : null;
  const menosDe24h = horas !== null && horas < 24 && horas > 0;

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
      <ScreenHeader title="Cancelar la reserva" onBack={onClose} />

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        {menosDe24h && (
          <View style={styles.warnBox}>
            <Text style={styles.warnTitle}>Queda menos de 24 horas</Text>
            <Text style={styles.warnText}>
              El retiro está agendado muy pronto. Habla con el dueño antes de cancelar.
            </Text>
          </View>
        )}

        <Card padded style={{ gap: theme.spacing.md }}>
          <Row label="Garantía retenida (hold)" value={`$${montoHold.toLocaleString("es-CL")}`} />
          {reservation?.fecha_inicio && (
            <Row
              label="Fecha de retiro acordada"
              value={new Date(reservation.fecha_inicio).toLocaleDateString("es-CL")}
            />
          )}
          <Text style={styles.note}>
            Al cancelar, tu garantía queda liberada. Si el retiro es en menos de 24 horas, soporte se
            comunicará contigo para coordinar cualquier ajuste según la política de cancelación.
          </Text>
        </Card>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) + 8 }]}>
        <Button label="Confirmar cancelación" variant="danger" onPress={handleCancelar} loading={cancelling} />
        <Button variant="ghost" size="sm" label="Mantener mi reserva" onPress={onClose} />
      </View>
    </View>
  );
}

function Row({ label, value }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  body: { padding: theme.spacing.screen, gap: theme.spacing.lg },
  warnBox: { backgroundColor: colors.dangerBg, borderRadius: theme.radius.field, padding: theme.spacing.lg, gap: 4 },
  warnTitle: { fontSize: 15, fontWeight: "700", color: colors.dangerText },
  warnText: { fontSize: 13, color: colors.dangerText, lineHeight: 19 },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: theme.spacing.md },
  rowLabel: { fontSize: 14, color: colors.textMuted },
  rowValue: { fontSize: 14, color: colors.text, fontWeight: "500" },
  note: {
    fontSize: 13,
    color: colors.textMuted,
    lineHeight: 19,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: theme.spacing.md,
  },
  footer: {
    paddingHorizontal: theme.spacing.screen,
    paddingTop: theme.spacing.md,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: theme.spacing.sm,
  },
});
