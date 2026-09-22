import React from "react";
import { View, Text, StatusBar } from "react-native";
import { colors } from "../../theme/colors";
import { Icon } from "../../components/Icon";
import { Button } from "../../components/ui";

/**
 * Se muestra cuando no se pudo revisar la sesión por la red. Aclara que la
 * cuenta sigue guardada: no es un cierre de sesión, y por eso ofrece
 * reintentar en vez de mandar al login.
 */
export function SinConexionScreen({ onReintentar }) {
  return (
    <View className="flex-1 bg-surface justify-between px-8 py-[34px]">
      <StatusBar barStyle="dark-content" />

      <View className="flex-1 items-center justify-center gap-2.5">
        <View className="w-[68px] h-[68px] rounded-full items-center justify-center bg-amber-50 border border-amber-200">
          <Icon name="wifi-off" size={32} color={colors.warningText} strokeWidth={2} />
        </View>
        <Text className="text-2xl font-bold text-gray-900 mt-1">Sin conexión</Text>
        <Text className="text-sm text-gray-500 text-center max-w-[280px]">
          No pudimos revisar tu sesión. Tu cuenta sigue guardada en este teléfono.
        </Text>
      </View>

      <Button testID="btn-reintentar-sesion" label="Reintentar" onPress={onReintentar} />
    </View>
  );
}
