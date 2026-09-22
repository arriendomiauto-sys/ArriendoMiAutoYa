import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Icon } from "../../../components/Icon";
import { colors } from "../../../theme/colors";

// ============================================================================
// Paso de Estado: Caso en Revisión Manual
// Informa al usuario que un ejecutivo de soporte está revisando sus documentos
// ============================================================================
export function StepReviewPending({ onGoToHome }) {
  return (
    <View className="flex-1 bg-surface">
      <View className="flex-1 justify-center items-center px-6">
        <View className="w-20 h-20 rounded-full bg-primary-100 justify-center items-center mb-6">
          <Icon name="clock" size={40} color={colors.primary600} />
        </View>

        <Text className="text-[22px] font-extrabold text-primary-700 text-center mb-3">Verificación en Revisión</Text>
        <Text className="text-[15px] text-gray-900 text-center leading-[22px] mb-4">
          Hemos recibido tus documentos. Un ejecutivo está validando tu cuenta manualmente para garantizar la seguridad en la plataforma.
        </Text>
        <Text className="text-[13px] text-gray-500 text-center leading-[18px]">
          Te notificaremos mediante la app y por correo en cuanto tu cuenta esté activa.
        </Text>
      </View>

      <TouchableOpacity className="bg-primary-700 rounded-[14px] py-4 items-center justify-center mx-4 my-2" onPress={onGoToHome}>
        <Text className="text-white text-base font-bold">Ir al Inicio</Text>
      </TouchableOpacity>
    </View>
  );
}
