import React, { useState } from "react";
import {
  View,
  Text,
  Modal,
  ScrollView,
  TouchableOpacity,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { colors } from "../theme/colors";
import { Icon } from "./Icon";
import { Button, Card, ScreenHeader } from "./ui";

const KEY_MANDATO_PREFIX = "@mandato_dueno_aceptado_";

export function MandatoDuenoModal({
  visible,
  onClose,
  onAccepted,
  userId = "default",
}) {
  const [checked, setChecked] = useState(false);
  const [saving, setSaving] = useState(false);

  const storageKey = `${KEY_MANDATO_PREFIX}${userId || "default"}`;

  const handleAceptar = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await AsyncStorage.setItem(storageKey, new Date().toISOString());
      if (onAccepted) onAccepted();
      if (onClose) onClose();
    } catch (err) {
      console.warn("No se pudo guardar la aceptación del mandato:", err);
      if (onAccepted) onAccepted();
      if (onClose) onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View className="flex-1 bg-black/55 justify-end">
        <View className="bg-surface rounded-t-3xl px-5 pt-4 max-h-[92%] flex-1">
          <ScreenHeader
            title="Mandato de Arriendo"
            subtitle="Condiciones de intermediación y comisiones"
            onBack={onClose}
          />

          <ScrollView className="flex-1 mt-2" contentContainerStyle={{ paddingBottom: 28 }} showsVerticalScrollIndicator={false}>
            {/* Header Icon + Resumen */}
            <View className="items-center bg-primary-100 p-4 rounded-2xl border border-primary-200 mb-4 mt-1">
              <View className="w-[52px] h-[52px] rounded-full bg-white items-center justify-center mb-2.5">
                <Icon name="shield" size={28} color={colors.primary} />
              </View>
              <Text className="text-base font-bold text-primary-700 text-center">
                Autorización para arrendar tu vehículo
              </Text>
              <Text className="text-[13px] text-primary-800 text-center mt-1 leading-[18px]">
                Mandato especial de administración e intermediación a ARRIENDO MI AUTO SpA (RUT 78.493.457-8) bajo las siguientes condiciones:
              </Text>
            </View>

            {/* Condiciones Clave */}
            <Card padded className="gap-3 mb-4">
              <View className="flex-row gap-3 items-start">
                <View className="w-[26px] h-[26px] rounded-full bg-primary-700 items-center justify-center mt-0.5">
                  <Text className="text-white font-bold text-[13px]">1</Text>
                </View>
                <View className="flex-1">
                  <Text className="text-sm font-bold text-gray-900">Recibes el 85% neto de cada arriendo</Text>
                  <Text className="text-[12.5px] text-gray-500 mt-0.5 leading-[17px]">
                    ARRIENDO MI AUTO SpA percibe el valor del arriendo a tu nombre y transfiere el 85% neto acordado directamente a tu cuenta bancaria registrada.
                  </Text>
                </View>
              </View>

              <View className="h-[1px] bg-gray-200" />

              <View className="flex-row gap-3 items-start">
                <View className="w-[26px] h-[26px] rounded-full bg-primary-700 items-center justify-center mt-0.5">
                  <Text className="text-white font-bold text-[13px]">2</Text>
                </View>
                <View className="flex-1">
                  <Text className="text-sm font-bold text-gray-900">15% Comisión de intermediación</Text>
                  <Text className="text-[12.5px] text-gray-500 mt-0.5 leading-[17px]">
                    La comisión del 15% financia la plataforma, soporte operativo, verificación biométrica KYC de conductores y el programa de protección frente a siniestros.
                  </Text>
                </View>
              </View>

              <View className="h-[1px] bg-gray-200" />

              <View className="flex-row gap-3 items-start">
                <View className="w-[26px] h-[26px] rounded-full bg-primary-700 items-center justify-center mt-0.5">
                  <Text className="text-white font-bold text-[13px]">3</Text>
                </View>
                <View className="flex-1">
                  <Text className="text-sm font-bold text-gray-900">100% de los cargos adicionales para ti</Text>
                  <Text className="text-[12.5px] text-gray-500 mt-0.5 leading-[17px]">
                    El 100% de los cobros accesorios por atraso, combustible faltante o suciedad/lavado se transfiere íntegro a tu cuenta para costear los gastos incurridos.
                  </Text>
                </View>
              </View>

              <View className="h-[1px] bg-gray-200" />

              <View className="flex-row gap-3 items-start">
                <View className="w-[26px] h-[26px] rounded-full bg-primary-700 items-center justify-center mt-0.5">
                  <Text className="text-white font-bold text-[13px]">4</Text>
                </View>
                <View className="flex-1">
                  <Text className="text-sm font-bold text-gray-900">Deducible 15 UF (50/50) y Garantía</Text>
                  <Text className="text-[12.5px] text-gray-500 mt-0.5 leading-[17px]">
                    Ningún arrendatario retira tu auto sin garantía retenida ($800.000) y contrato digital firmado. Ante siniestros cubiertos, el deducible de 15 UF se absorbe 50% por la plataforma y 50% por el dueño.
                  </Text>
                </View>
              </View>

              <View className="h-[1px] bg-gray-200" />

              <View className="flex-row gap-3 items-start">
                <View className="w-[26px] h-[26px] rounded-full bg-primary-700 items-center justify-center mt-0.5">
                  <Text className="text-white font-bold text-[13px]">5</Text>
                </View>
                <View className="flex-1">
                  <Text className="text-sm font-bold text-gray-900">Cobro y gestión de peajes TAG y multas</Text>
                  <Text className="text-[12.5px] text-gray-500 mt-0.5 leading-[17px]">
                    Facultas expresamente a ARRIENDO MI AUTO SpA para cobrar y percibir del arrendatario los peajes, pasadas por pórticos TAG y multas de tránsito generadas durante el arriendo, transfiriéndolos a tu cuenta previa acreditación del comprobante.
                  </Text>
                </View>
              </View>
            </Card>

            {/* Checkbox de Aceptación */}
            <TouchableOpacity
              className="flex-row items-start gap-3 bg-white p-3.5 rounded-xl border border-gray-200"
              activeOpacity={0.8}
              onPress={() => setChecked(!checked)}
            >
              <View
                className={`w-[22px] h-[22px] rounded-md border-2 items-center justify-center mt-0.5 ${
                  checked ? "bg-primary-700 border-primary-700" : "border-gray-400"
                }`}
              >
                {checked && <Icon name="check" size={16} color="#FFFFFF" />}
              </View>
              <Text className="flex-1 text-[13px] text-gray-900 leading-[18px]">
                He leído y confiero mandato especial de administración e intermediación a ARRIENDO MI AUTO SpA (RUT 78.493.457-8) bajo las condiciones aquí estipuladas.
              </Text>
            </TouchableOpacity>

            {/* Botón de Confirmación */}
            <View className="mt-4">
              <Button
                label="Aceptar Mandato y Continuar"
                iconRight="arrow-right"
                disabled={!checked || saving}
                loading={saving}
                onPress={handleAceptar}
              />
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

export async function verificarMandatoAceptado(userId = "default") {
  try {
    const key = `${KEY_MANDATO_PREFIX}${userId || "default"}`;
    const valor = await AsyncStorage.getItem(key);
    return !!valor;
  } catch {
    return false;
  }
}
