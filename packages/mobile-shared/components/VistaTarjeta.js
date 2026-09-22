import React from "react";
import { View, Text } from "react-native";
import Svg, { Defs, LinearGradient, Stop, Rect } from "react-native-svg";
import { colors } from "../theme/colors";
import { detectarMarca } from "./FormularioTarjeta";

const NOMBRE_MARCA = { visa: "VISA", mastercard: "MASTERCARD", amex: "AMEX", diners: "DINERS", otra: "TARJETA" };

/** "4242 42" -> "4242 42•• •••• ••••": rellena hasta 16 dígitos en grupos de 4. */
function numeroConPuntos(numero) {
  const digitos = (numero || "").replace(/\D/g, "").slice(0, 16);
  return (digitos + "•".repeat(16)).slice(0, 16).replace(/(.{4})/g, "$1 ").trim();
}

/**
 * Tarjeta ilustrada que sigue lo que el usuario escribe en el formulario de
 * alta. Es solo visual: no guarda ni envía nada, y lo que muestra es lo mismo
 * que ya está en pantalla en los campos.
 */
export function VistaTarjeta({ numero, vencimiento, titular }) {
  const marca = detectarMarca(numero);
  return (
    <View
      className="h-[156px] rounded-[18px] p-4 justify-between overflow-hidden shadow-lg"
      style={{ elevation: 6 }}
      accessible
      accessibilityLabel="Vista previa de tu tarjeta"
    >
      <View className="absolute inset-0" pointerEvents="none">
        <Svg width="100%" height="100%">
          <Defs>
            <LinearGradient id="vistaTarjetaGrad" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={colors.primary800} />
              <Stop offset="0.6" stopColor={colors.primary600} />
              <Stop offset="1" stopColor={colors.accent600} />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#vistaTarjetaGrad)" />
        </Svg>
      </View>

      <View className="flex-row justify-between items-end">
        <View className="w-[34px] h-6 rounded-md bg-[#D9C27C]" />
        <Text className="text-white text-xs font-extrabold tracking-wider">{NOMBRE_MARCA[marca]}</Text>
      </View>

      <Text
        className="text-white text-lg tracking-widest"
        style={{ fontVariant: ["tabular-nums"] }}
      >
        {numeroConPuntos(numero)}
      </Text>

      <View className="flex-row justify-between items-end">
        <View className="shrink gap-[1px]">
          <Text className="text-white/70 text-[9px] tracking-widest uppercase">Titular</Text>
          <Text className="text-white text-[11.5px] font-semibold" numberOfLines={1}>
            {(titular || "").trim().toUpperCase() || "TU NOMBRE"}
          </Text>
        </View>
        <View className="items-end shrink-0 ml-3 gap-[1px]">
          <Text className="text-white/70 text-[9px] tracking-widest uppercase">Vence</Text>
          <Text className="text-white text-[11.5px] font-semibold">{vencimiento || "MM/AA"}</Text>
        </View>
      </View>
    </View>
  );
}
