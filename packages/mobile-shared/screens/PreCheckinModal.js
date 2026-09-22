import React, { useState } from "react";
import {
  View,
  Text,
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
        className="flex-1 bg-[#0a0f1d]/65 justify-end"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View
          className="bg-surface rounded-t-3xl max-h-[88%]"
          style={{ paddingBottom: Math.max(insets?.bottom || 0, 16) + 8 }}
        >
          <View className="w-10 h-1 rounded-full bg-borderDark self-center mt-2.5 mb-0.5" />
          <View className="flex-row items-center gap-3 px-4 pt-4 pb-3 border-b border-border">
            <View className="w-11 h-11 rounded-full bg-accent-100 items-center justify-center">
              <Icon name="check" size={24} color={colors.accent700} />
            </View>
            <View className="flex-1">
              <Text className="text-lg font-bold text-text">Verificación 24h antes</Text>
              <Text className="text-[13px] text-textMuted mt-0.5">
                {isDriver ? "Confirma que el vehículo está listo para entrega" : "Confirma tu viaje para mañana"}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={theme.control.hitSlop} className="p-1">
              <Icon name="close" size={20} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          <ScrollView
            contentContainerStyle={{ padding: 16, gap: 12 }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Tarjeta de Información de Entrega */}
            <View className="bg-surfaceSubtle rounded-2xl border border-border p-3 gap-2">
              <Text className="text-base font-bold text-text">
                {auto.marca} {auto.modelo}
                {/* Al cliente la patente recién se le muestra al retirar el
                    auto (QR de entrega) — 24h antes no aporta nada y expone
                    de más. El dueño sí ve la de su propio vehículo. */}
                {isDriver && auto.patente ? ` (${auto.patente})` : ""}
              </Text>
              <View className="flex-row items-center gap-1.5">
                <Icon name="location" size={15} color={colors.primary} />
                <Text className="text-sm text-text font-medium flex-1">{reserva.lugar_entrega_acordado || "Punto acordado"}</Text>
              </View>
              <View className="flex-row items-center gap-1.5 bg-accent-100 py-1 px-2.5 rounded-full self-start mt-0.5">
                <Icon name="shield" size={13} color={colors.accent800} />
                <Text className="text-xs text-accent-800 font-semibold">Punto de encuentro público coordinado</Text>
              </View>
            </View>

            {/* Aviso si está fuera de la ventana de 24h */}
            {fueraDeVentana24h && (
              <View className="flex-row items-center gap-2 bg-amber-50 p-3 rounded-2xl border border-amber-200">
                <Icon name="clock" size={16} color="#D97706" />
                <Text className="text-[13px] text-amber-800 font-medium flex-1 leading-[18px]">
                  Este pre-checkin estará disponible 24 horas antes de la entrega acordada.
                </Text>
              </View>
            )}

            {/* Checklist interactivo */}
            <View className="flex-row justify-between items-center mt-1">
              <Text className="text-sm font-bold text-textMuted uppercase tracking-wider">Checklist de confirmación</Text>
              <Text
                className={`text-xs font-bold px-2 py-0.5 rounded-full border ${
                  todoMarcado
                    ? "text-emerald-800 bg-emerald-100 border-emerald-200"
                    : "text-textMuted bg-surfaceSubtle border-border"
                }`}
              >
                {checksMarcados}/4
              </Text>
            </View>

            <TouchableOpacity
              className="flex-row items-start gap-3 bg-background p-3 rounded-xl border border-border"
              onPress={() => setAsistencia(!asistencia)}
              activeOpacity={0.8}
            >
              <View className={`w-[22px] h-[22px] rounded-md border-[1.5px] items-center justify-center mt-0.5 ${asistencia ? "bg-accent border-accent" : "border-borderDark"}`}>
                {asistencia && <Icon name="check" size={13} color="#FFFFFF" />}
              </View>
              <Text className="text-sm text-text leading-5 flex-1">
                {isDriver
                  ? "Asistiré puntualmente a la hora acordada para la entrega con código QR."
                  : "Asistiré puntualmente a recibir el auto en el lugar acordado."}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              className="flex-row items-start gap-3 bg-background p-3 rounded-xl border border-border"
              onPress={() => setLugarHora(!lugarHora)}
              activeOpacity={0.8}
            >
              <View className={`w-[22px] h-[22px] rounded-md border-[1.5px] items-center justify-center mt-0.5 ${lugarHora ? "bg-accent border-accent" : "border-borderDark"}`}>
                {lugarHora && <Icon name="check" size={13} color="#FFFFFF" />}
              </View>
              <Text className="text-sm text-text leading-5 flex-1">
                Confirmo que revisé la dirección y tengo planificado mi traslado.
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              className="flex-row items-start gap-3 bg-background p-3 rounded-xl border border-border"
              onPress={() => setLicenciaOAuto(!licenciaOAuto)}
              activeOpacity={0.8}
            >
              <View className={`w-[22px] h-[22px] rounded-md border-[1.5px] items-center justify-center mt-0.5 ${licenciaOAuto ? "bg-accent border-accent" : "border-borderDark"}`}>
                {licenciaOAuto && <Icon name="check" size={13} color="#FFFFFF" />}
              </View>
              <Text className="text-sm text-text leading-5 flex-1">
                {isDriver
                  ? "El vehículo se encuentra limpio, con combustible y documentación al día."
                  : "Mi cédula y licencia de conducir física se encuentran vigentes para el viaje."}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              className="flex-row items-start gap-3 bg-background p-3 rounded-xl border border-border"
              onPress={() => setReglas(!reglas)}
              activeOpacity={0.8}
            >
              <View className={`w-[22px] h-[22px] rounded-md border-[1.5px] items-center justify-center mt-0.5 ${reglas ? "bg-accent border-accent" : "border-borderDark"}`}>
                {reglas && <Icon name="check" size={13} color="#FFFFFF" />}
              </View>
              <Text className="text-sm text-text leading-5 flex-1">
                Acepto las normas de arriendo (prohibido fumar en el vehículo, cuidado y devolución puntual).
              </Text>
            </TouchableOpacity>

            {/* Notas adicionales opcionales */}
            <View className="gap-1.5 mt-1">
              <Text className="text-xs text-textMuted font-semibold">Notas o mensaje para la contraparte (opcional)</Text>
              <TextInput
                className="bg-background rounded-xl border border-border px-3.5 py-2.5 text-sm text-text min-h-[56px]"
                placeholder="ej. Estaré esperándote frente a la entrada principal..."
                placeholderTextColor={colors.textPlaceholder}
                value={notas}
                onChangeText={setNotas}
                multiline
                numberOfLines={2}
              />
            </View>

            <Button
              className="mt-2.5"
              style={{ opacity: (!todoMarcado || fueraDeVentana24h) ? 0.6 : 1 }}
              label={isDriver ? "Confirmar disponibilidad del auto" : "Confirmar viaje para mañana"}
              onPress={handleConfirmar}
              loading={loading}
              disabled={!todoMarcado || fueraDeVentana24h}
              iconRight="check"
            />

            {!todoMarcado && !fueraDeVentana24h && (
              <Text className="text-xs text-textMuted text-center mt-1">
                Debes marcar las 4 casillas del checklist para poder confirmar.
              </Text>
            )}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}


