import React from "react";
import { View, Text } from "react-native";
import { colors } from "../theme/colors";
import { Icon } from "./Icon";

/**
 * Aviso de error dentro de la pantalla (en vez de un `showAlert` modal): queda
 * a la vista mientras la persona corrige el formulario. Se anuncia como alerta
 * y lleva ícono, así que no depende solo del rojo para entenderse.
 */
export function AlertaInline({ titulo, mensaje, testID, className = "", style }) {
  return (
    <View
      testID={testID}
      className={`flex-row items-start gap-2 p-3 rounded-xl border border-red-200 bg-red-50 ${className}`}
      style={style}
      accessibilityRole="alert"
    >
      <Icon name="alert" size={16} color={colors.dangerText} />
      <View className="flex-1">
        <Text className="text-[13px] leading-[18px] font-bold text-red-700">{titulo}</Text>
        <Text className="text-[13px] leading-[18px] text-red-700">{mensaje}</Text>
      </View>
    </View>
  );
}
