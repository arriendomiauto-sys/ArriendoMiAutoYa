import React, { useState } from "react";
import { View, Text, StatusBar, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button, Card, ScreenHeader, ApiClient, showAlert, msjError } from "@rentacar/mobile-shared";

export function CancelReservationModal({ reservation, onClose, onConfirmCancel }) {
  const insets = useSafeAreaInsets();
  const [cancelling, setCancelling] = useState(false);

  const montoHold = reservation?.monto_hold || 0;
  const horas = reservation?.fecha_inicio
    ? (new Date(reservation.fecha_inicio).getTime() - Date.now()) / 3_600_000
    : null;
  const menosDe24h = horas !== null && horas < 24 && horas > 0;

  const handleCancelar = async () => {
    if (cancelling) return;
    if (!reservation?.id) {
      onConfirmCancel();
      return;
    }
    setCancelling(true);
    try {
      const actualizada = await ApiClient.actualizarEstadoReserva(reservation.id, "cancelada");
      onConfirmCancel(actualizada);
    } catch (err) {
      showAlert("No se pudo cancelar", msjError(err, "Intenta de nuevo en unos segundos."));
    } finally {
      setCancelling(false);
    }
  };

  return (
    <View className="flex-1 bg-background">
      <StatusBar barStyle="dark-content" />
      <ScreenHeader title="Cancelar la reserva" onBack={onClose} />

      <ScrollView contentContainerClassName="p-4 gap-4" showsVerticalScrollIndicator={false}>
        {menosDe24h && (
          <View className="bg-red-50 rounded-xl p-4 gap-1">
            <Text className="text-[15px] font-bold text-red-600">Queda menos de 24 horas</Text>
            <Text className="text-[13px] text-red-600 leading-[19px]">
              El retiro está agendado muy pronto. Habla con el dueño antes de cancelar.
            </Text>
          </View>
        )}

        <Card padded style={{ gap: 12 }}>
          <Row label="Garantía retenida (hold)" value={`$${montoHold.toLocaleString("es-CL")}`} />
          {reservation?.fecha_inicio && (
            <Row
              label="Fecha de retiro acordada"
              value={new Date(reservation.fecha_inicio).toLocaleDateString("es-CL")}
            />
          )}
          <Text className="text-[13px] text-textMuted leading-[19px] border-t border-border pt-3">
            Al cancelar, liberamos tu garantía. Si faltan 24 horas o más para el retiro, también te
            devolvemos el arriendo completo. Si falta menos, soporte se comunicará contigo para
            coordinar el cobro del arriendo según la política de cancelación.
          </Text>
        </Card>
      </ScrollView>

      <View
        className="px-4 pt-3 bg-white border-t border-border gap-2"
        style={{ paddingBottom: Math.max(insets.bottom, 12) + 8 }}
      >
        <Button label="Confirmar cancelación" variant="danger" onPress={handleCancelar} loading={cancelling} />
        <Button variant="ghost" size="sm" label="Mantener mi reserva" onPress={onClose} />
      </View>
    </View>
  );
}

function Row({ label, value }) {
  return (
    <View className="flex-row justify-between items-center gap-3">
      <Text className="text-sm text-textMuted">{label}</Text>
      <Text className="text-sm text-textDark font-medium">{value}</Text>
    </View>
  );
}

