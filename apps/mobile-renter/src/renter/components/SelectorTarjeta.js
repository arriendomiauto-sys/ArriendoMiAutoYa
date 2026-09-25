import React from "react";
import { View, Text, TextInput, TouchableOpacity } from "react-native";
import { colors, Icon } from "@rentacar/mobile-shared";

// Sigla corta para el chip de la fila y color de fondo por marca.
const MARCA_CHIP = {
  visa: { sigla: "VISA", clase: "bg-[#1A3A8F]" },
  mastercard: { sigla: "MC", clase: "bg-[#2B2B33]" },
  amex: { sigla: "AMEX", clase: "bg-[#2E6DA4]" },
  diners: { sigla: "DINERS", clase: "bg-[#4A5568]" },
};
const CHIP_OTRA = { sigla: "TARJ", clase: "bg-[#6B7280]" };
const TIPO_LABEL = { credito: "Crédito", debito: "Débito" };

/**
 * Lista de radio para elegir una tarjeta en el checkout. Se usa dos veces:
 * una para el cobro del arriendo (tarjetas de débito) y otra para el hold de
 * garantía (tarjetas de crédito).
 *
 * @param tarjetas       lista ya filtrada por tipo (validadas)
 * @param seleccionadaId id elegido
 * @param onSeleccionar  (id) => void
 * @param onAgregar      () => void  — abre el alta de tarjeta
 * @param error          texto de error inline (SIN_CUPO / COBRO_RECHAZADO)
 * @param tipoVacio      "débito" | "crédito"  — para el copy del estado vacío
 * @param insignia       texto corto en una píldora junto al título (p. ej. quién procesa el pago)
 * @param pedirCvv       muestra el campo del código de seguridad de la tarjeta elegida
 * @param cvv / onCvv    valor y setter del código de seguridad
 */
export function SelectorTarjeta({
  titulo,
  subtitulo,
  tarjetas,
  seleccionadaId,
  onSeleccionar,
  onAgregar,
  error,
  tipoVacio,
  insignia,
  pedirCvv,
  cvv,
  onCvv,
}) {
  const seleccionada = tarjetas.find((t) => t.id === seleccionadaId);
  return (
    <View className="gap-2">
      <View className="gap-0.5">
        <View className="flex-row items-center justify-between gap-2">
          <Text className="flex-1 text-[13px] font-bold text-textMuted tracking-wider">{titulo}</Text>
          {insignia ? (
            <View className="rounded-full bg-primary-100 px-2.5 py-0.5">
              <Text className="text-[10.5px] font-bold text-primary-700">{insignia}</Text>
            </View>
          ) : null}
        </View>
        {subtitulo ? <Text className="text-xs text-textMuted leading-4">{subtitulo}</Text> : null}
      </View>

      {tarjetas.length === 0 ? (
        <View className="border-[1.5px] border-dashed border-gray-200 rounded-xl p-4 gap-2.5 bg-slate-50/70">
          <View className="flex-row items-center gap-2">
            <Icon name="card" size={18} color={colors.primary} />
            <Text className="text-sm font-bold text-textDark">
              {tipoVacio === "crédito"
                ? "Tarjeta de crédito para la garantía"
                : `Tarjeta de ${tipoVacio}`}
            </Text>
          </View>
          {tipoVacio === "crédito" ? (
            <Text className="text-xs text-textMuted leading-[17px]">
              La garantía de arriendo solo retiene cupo en tarjeta de crédito (no débito). No se cobra: se libera automáticamente al terminar el arriendo.
            </Text>
          ) : null}
          <TouchableOpacity
            className="flex-row items-center justify-center gap-2 bg-white border border-primary rounded-xl py-2.5 px-3 mt-1 active:opacity-85"
            onPress={onAgregar}
            activeOpacity={0.85}
          >
            <Icon name="plus" size={15} color={colors.primary} />
            <Text className="text-sm font-semibold text-primary">
              Agregar tarjeta de {tipoVacio}
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View className={`border border-gray-200 rounded-xl overflow-hidden bg-white ${error ? "border-red-500" : ""}`}>
          {tarjetas.map((t, idx) => {
            const activa = t.id === seleccionadaId;
            return (
              <TouchableOpacity
                key={t.id}
                testID={`tarjeta-${tipoVacio === "crédito" ? "credito" : "debito"}-${idx}`}
                className="flex-row items-center gap-3 py-3 px-3.5 border-b border-gray-200 active:opacity-80"
                onPress={() => onSeleccionar(t.id)}
                activeOpacity={0.8}
                accessibilityRole="radio"
                accessibilityState={{ selected: activa }}
              >
                <View className={`w-9 h-6 rounded items-center justify-center ${(MARCA_CHIP[t.marca] || CHIP_OTRA).clase}`}>
                  <Text className="text-[8.5px] font-extrabold text-white tracking-wide">
                    {(MARCA_CHIP[t.marca] || CHIP_OTRA).sigla}
                  </Text>
                </View>
                <View className="flex-1">
                  <Text className="text-sm text-textDark font-semibold">•••• {t.ultimos4}</Text>
                  {t.vencimiento ? (
                    <Text className="text-xs text-textMuted">Vence {t.vencimiento}</Text>
                  ) : null}
                </View>
                {TIPO_LABEL[t.tipo] ? (
                  <View className="rounded-md bg-gray-100 px-1.5 py-0.5">
                    <Text className="text-[10px] font-bold text-gray-600">{TIPO_LABEL[t.tipo]}</Text>
                  </View>
                ) : null}
                <View className={`w-5 h-5 rounded-full border-2 items-center justify-center ${activa ? "border-primary" : "border-gray-300"}`}>
                  {activa ? <View className="w-2.5 h-2.5 rounded-full bg-primary" /> : null}
                </View>
              </TouchableOpacity>
            );
          })}
          <TouchableOpacity className="flex-row items-center gap-2 py-3 px-3.5 active:opacity-70" onPress={onAgregar} activeOpacity={0.7}>
            <Icon name="plus" size={14} color={colors.primary} />
            <Text className="text-[13px] font-semibold text-primary">Usar otra tarjeta</Text>
          </TouchableOpacity>
        </View>
      )}

      {pedirCvv && seleccionada ? (
        <View className="flex-row items-center gap-3">
          <Text className="flex-1 text-xs text-textMuted leading-4">
            Código de seguridad de la •••• {seleccionada.ultimos4} (atrás de la tarjeta)
          </Text>
          <TextInput
            testID={`cvv-${tipoVacio === "crédito" ? "credito" : "debito"}`}
            className="w-[84px] h-11 border-[1.5px] border-gray-200 rounded-xl px-3 text-[15px] text-gray-900 bg-white text-center"
            value={cvv}
            onChangeText={(t) => onCvv(t.replace(/\D/g, "").slice(0, 4))}
            placeholder="CVV"
            placeholderTextColor={colors.textPlaceholder}
            keyboardType="number-pad"
            secureTextEntry
            maxLength={4}
            accessibilityLabel={`Código de seguridad de la tarjeta terminada en ${seleccionada.ultimos4}`}
          />
        </View>
      ) : null}

      {error ? (
        <View className="gap-2 bg-red-50/80 border border-red-200 rounded-xl p-3">
          <View className="flex-row items-start gap-1.5">
            <Icon name="alert" size={15} color={colors.dangerText} />
            <Text className="flex-1 text-[12.5px] text-red-700 leading-[17px]">{error}</Text>
          </View>
          <TouchableOpacity
            className="flex-row items-center justify-center gap-1.5 py-2 px-3 bg-white border border-red-300 rounded-lg active:opacity-85"
            onPress={onAgregar}
            activeOpacity={0.8}
          >
            <Icon name="plus" size={14} color={colors.primary} />
            <Text className="text-xs font-bold text-primary">
              {tipoVacio === "crédito"
                ? "Agregar otra tarjeta de crédito con cupo"
                : "Agregar otra tarjeta"}
            </Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );
}
