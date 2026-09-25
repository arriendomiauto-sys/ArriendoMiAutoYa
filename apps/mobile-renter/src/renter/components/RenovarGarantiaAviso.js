import React, { useState } from "react";
import { View, Text, TextInput } from "react-native";
import {
  colors,
  Icon,
  Button,
  ApiClient,
  useTarjetas,
  configMercadoPago,
  tokenizarTarjetaGuardada,
  hapticoExito,
  hapticoError,
} from "@rentacar/mobile-shared";

/**
 * Aviso para renovar la garantía cuando su retención en Mercado Pago vence
 * antes de que termine el arriendo. Pide el CVV de la misma tarjeta de crédito
 * (Mercado Pago lo exige para cada cobro) y toma un hold nuevo.
 * Sin garantía vigente, el dueño no puede registrar la entrega.
 */
export function RenovarGarantiaAviso({ reserva, onRenovada }) {
  const { validadas } = useTarjetas();
  const [cvv, setCvv] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState(null);

  if (!reserva?.garantia_por_renovar) return null;

  const tarjeta = validadas.find((t) => t.id === reserva.tarjeta_garantia_id);
  const pedirCvv = configMercadoPago().puedeContactarMP;

  const renovar = async () => {
    if (enviando) return;
    setError(null);
    setEnviando(true);
    try {
      const token_garantia = pedirCvv
        ? await tokenizarTarjetaGuardada({ cardId: tarjeta?.mp_card_id, cvv })
        : null;
      await ApiClient.renovarGarantia(reserva.id, { token_garantia });
      hapticoExito();
      onRenovada?.();
    } catch (e) {
      hapticoError();
      setCvv("");
      setError(e?.mensaje || e?.message || "No pudimos renovar la garantía. Intenta de nuevo.");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <View className="gap-3 p-4 rounded-2xl border border-amber-300 bg-amber-50">
      <View className="flex-row items-start gap-2">
        <Icon name="shield" size={18} color="#B45309" />
        <View className="flex-1 gap-1">
          <Text className="text-[15px] font-bold text-textDark">Renueva tu garantía</Text>
          <Text className="text-[13px] text-amber-800 leading-[19px]">
            La retención en tu tarjeta vence antes de que termine el arriendo. Confirma el código de
            seguridad para renovarla: no es un cobro, y la retención anterior se libera. Sin garantía
            vigente no se puede entregar el auto.
          </Text>
        </View>
      </View>

      {pedirCvv ? (
        <View className="flex-row items-center gap-3">
          <Text className="flex-1 text-xs text-textMuted leading-4">
            {tarjeta ? `Código de seguridad de la •••• ${tarjeta.ultimos4}` : "Código de seguridad de tu tarjeta de crédito"}
          </Text>
          <TextInput
            testID="cvv-renovar-garantia"
            className="w-[84px] h-11 border-[1.5px] border-gray-200 rounded-xl px-3 text-[15px] text-gray-900 bg-white text-center"
            value={cvv}
            onChangeText={(t) => {
              setCvv(t.replace(/\D/g, "").slice(0, 4));
              setError(null);
            }}
            placeholder="CVV"
            placeholderTextColor={colors.textPlaceholder}
            keyboardType="number-pad"
            secureTextEntry
            maxLength={4}
            accessibilityLabel="Código de seguridad de la tarjeta de la garantía"
          />
        </View>
      ) : null}

      {error ? <Text className="text-[12.5px] text-red-700 leading-[17px]">{error}</Text> : null}

      <Button
        label="Renovar garantía"
        onPress={renovar}
        loading={enviando}
        disabled={enviando || (pedirCvv && (!tarjeta || cvv.length < 3))}
      />
    </View>
  );
}
