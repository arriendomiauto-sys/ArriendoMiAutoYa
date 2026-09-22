import React, { useState } from "react";
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "../theme/colors";
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
        className="flex-1 bg-slate-900/65 justify-end"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View className="bg-surface rounded-t-3xl max-h-[90%]" style={{ paddingBottom: Math.max(insets?.bottom || 0, 16) + 8 }}>
          <View className="w-10 h-1 rounded-full bg-borderDark self-center mt-2.5 mb-0.5" />
          <View className="flex-row items-center gap-3 px-4 pt-4 pb-3 border-b border-border">
            <View className="w-11 h-11 rounded-full bg-amber-50 items-center justify-center">
              <Icon name="alert-triangle" size={24} color={colors.warning} />
            </View>
            <View className="flex-1">
              <Text className="text-[17px] font-bold text-textDark">Reportar peaje o fotomulta</Text>
              <Text className="text-xs text-textMuted mt-0.5">Se cobra a la tarjeta de garantía del arrendatario</Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} className="p-1">
              <Icon name="close" size={20} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          <ScrollView
            contentContainerStyle={{ padding: 16, gap: 12 }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <Text className="text-xs leading-[17px] text-textMuted">
              Peajes, TAG y fotomultas se notifican a tu nombre semanas después del arriendo. Se
              cobran a la tarjeta de crédito registrada del arrendatario, dentro de los 30 días
              siguientes al fin del arriendo.
            </Text>

            <Text className="text-[13px] font-bold text-textMuted uppercase tracking-wider">Tipo de cobro</Text>
            <View className="flex-row flex-wrap gap-2">
              {TIPOS_COBRO.map((item) => {
                const selected = tipo === item.id;
                return (
                  <TouchableOpacity
                    key={item.id}
                    className={`py-2 px-3 rounded-full border items-center ${
                      selected ? "border-accent bg-accent-100" : "border-border bg-background"
                    }`}
                    onPress={() => setTipo(item.id)}
                    activeOpacity={0.7}
                  >
                    <Text className={`text-[13px] font-semibold ${selected ? "text-accent-800" : "text-textDark"}`}>
                      {item.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View className="gap-1.5">
              <Text className="text-[13px] font-semibold text-textDark">Monto exacto de la boleta (CLP)</Text>
              <TextInput
                className="bg-background rounded-xl border border-border px-3.5 py-2.5 text-sm text-textDark"
                value={monto}
                onChangeText={setMonto}
                keyboardType="numeric"
                placeholder="ej. 3200"
                placeholderTextColor={colors.textPlaceholder}
              />
            </View>

            <View className="gap-1.5">
              <Text className="text-[13px] font-semibold text-textDark">Descripción</Text>
              <TextInput
                className="bg-background rounded-xl border border-border px-3.5 py-2.5 text-sm text-textDark min-h-[64px]"
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
              className="mt-2"
            />
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
