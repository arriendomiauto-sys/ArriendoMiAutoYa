import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { colors } from "../theme/colors";
import { Icon } from "./Icon";

/**
 * Aviso persistente para incentivar a validar la identidad — la cuenta se
 * crea simple (sin RUT ni KYC), así que sin esto no hay señal visible de
 * que falta ese paso hasta que el usuario choca con el gate al reservar o
 * publicar. Va como PRIMER ítem de la lista de la pantalla principal de
 * cada modo mientras `estado_documentos !== "verificado"` — no un banner
 * flotante. Superficie pino oscuro con hairline menta, igual que los
 * bloques de seguridad del KYC.
 */
export function VerifyIdentityBanner({ onPress, role = "renter", className = "", style }) {
  return (
    <TouchableOpacity
      className={`flex-row items-center gap-3 bg-primary-900 rounded-2xl p-3.5 overflow-hidden relative ${className}`}
      style={style}
      onPress={onPress}
      activeOpacity={0.9}
      accessibilityRole="button"
      accessibilityLabel="Verifica tu identidad"
    >
      <View className="absolute top-0 left-3.5 right-3.5 h-[1px] bg-accent-500" />
      <View className="w-[34px] h-[34px] rounded-xl bg-accent-500/20 items-center justify-center">
        <Icon name="shield" size={16} color={colors.accent500} />
      </View>
      <View className="flex-1">
        <Text className="text-sm font-semibold text-white">Verifica tu identidad</Text>
        <Text className="text-[12.5px] text-accent-200 mt-0.5 leading-[17px]">
          {role === "owner"
            ? "Toma unos minutos y te habilita para publicar"
            : "Toma unos minutos y te habilita para reservar"}
        </Text>
      </View>
      <View className="px-3 py-2 rounded-full bg-accent-500">
        <Text className="text-[13px] font-bold text-primary-900">Empezar</Text>
      </View>
    </TouchableOpacity>
  );
}
