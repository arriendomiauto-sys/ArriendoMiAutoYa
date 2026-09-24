import React, { useState } from "react";
import { View, Text, TouchableOpacity, Modal, ScrollView, TouchableWithoutFeedback } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, theme, Icon } from "@rentacar/mobile-shared";

const fmt = (n) => `$${Number(n || 0).toLocaleString("es-CL")}`;

/**
 * Antes esto era un slider para arrastrar entre categorías -- poco intuitivo
 * (nada indicaba que se podía arrastrar) y difícil de tocar con precisión.
 * Ahora es un campo desplegable estándar: se toca, se abre una lista con las
 * 5 categorías completas (ícono, ejemplos, rango de tarifa) y se elige una,
 * mismo patrón que el selector de año.
 */
export function SelectorCategoria({ tipos, seleccionado, onSelect }) {
  const [abierto, setAbierto] = useState(false);
  let insets = { bottom: 0, top: 0, left: 0, right: 0 };
  try {
    insets = useSafeAreaInsets();
  } catch {
    // Fuera de SafeAreaProvider en tests
  }

  const tipo = tipos.find((t) => t.id === seleccionado) || tipos[0];

  return (
    <>
      <TouchableOpacity
        className="bg-white rounded-xl px-3.5 h-14 border-[1.5px] border-gray-200 flex-row items-center gap-3"
        onPress={() => setAbierto(true)}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel={`Categoría del auto, ${tipo?.labelCorto || "sin elegir"}`}
      >
        <View className="w-9 h-9 rounded-lg bg-primary-100 items-center justify-center">
          <Icon name={tipo?.icon || "car"} size={18} color={colors.primary} />
        </View>
        <View className="flex-1">
          <Text className="text-[15px] font-bold text-textDark">{tipo?.labelCorto || "Elige una categoría"}</Text>
          <Text className="text-[11.5px] text-textMuted" numberOfLines={1}>
            {tipo ? `${fmt(tipo.min)} – ${fmt(tipo.base)}` : "Toca para elegir"}
          </Text>
        </View>
        <Icon name="chevronDown" size={16} color={colors.textMuted} />
      </TouchableOpacity>

      <Modal visible={abierto} animationType="fade" transparent onRequestClose={() => setAbierto(false)}>
        <TouchableWithoutFeedback onPress={() => setAbierto(false)}>
          <View className="flex-1 bg-[#0A1914]/55 justify-end">
            <TouchableWithoutFeedback>
              <View
                className="bg-white rounded-t-3xl max-h-[80%] px-5 pt-3"
                style={{ paddingBottom: Math.max(insets?.bottom || 0, 20) + 8 }}
              >
                <View className="w-10 h-1 rounded bg-gray-200 self-center mb-3.5" />

                <View className="flex-row justify-between items-start mb-3">
                  <View>
                    <Text className="text-lg font-extrabold text-textDark -tracking-tight">Categoría del auto</Text>
                    <Text className="text-[12.5px] text-textMuted mt-0.5">Define la tarifa de referencia y el requisito de licencia</Text>
                  </View>
                  <TouchableOpacity
                    className="p-1.5 rounded-full bg-surface-subtle"
                    onPress={() => setAbierto(false)}
                    hitSlop={theme.control.hitSlop}
                    accessibilityLabel="Cerrar selector de categoría"
                  >
                    <Icon name="close" size={20} color={colors.textMuted} />
                  </TouchableOpacity>
                </View>

                <ScrollView
                  className="max-h-[420px]"
                  contentContainerStyle={{ paddingBottom: 16, gap: 8 }}
                  showsVerticalScrollIndicator={false}
                >
                  {tipos.map((t) => {
                    const esActivo = t.id === seleccionado;
                    return (
                      <TouchableOpacity
                        key={t.id}
                        className={`flex-row items-center gap-3 p-3 rounded-xl border ${
                          esActivo ? "bg-primary-100 border-primary-700" : "border-gray-100"
                        }`}
                        onPress={() => {
                          onSelect(t.id);
                          setAbierto(false);
                        }}
                        accessibilityRole="button"
                        accessibilityState={{ selected: esActivo }}
                        accessibilityLabel={t.labelCorto}
                        activeOpacity={0.8}
                      >
                        <View className="w-11 h-11 rounded-xl bg-white items-center justify-center border border-gray-100">
                          <Icon name={t.icon} size={22} color={colors.primary} />
                        </View>
                        <View className="flex-1">
                          <Text className={`text-[15px] font-bold ${esActivo ? "text-primary-700" : "text-textDark"}`}>
                            {t.labelCorto}
                          </Text>
                          <Text className="text-[11.5px] text-textMuted" numberOfLines={1}>
                            {t.ejemplos}
                          </Text>
                          <Text className="text-[11.5px] font-semibold text-textMuted mt-0.5">
                            {fmt(t.min)} – {fmt(t.base)}
                          </Text>
                        </View>
                        {esActivo ? (
                          <View className="w-[22px] h-[22px] rounded-full bg-primary-700 items-center justify-center">
                            <Icon name="check" size={14} color="#FFFFFF" />
                          </View>
                        ) : null}
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </>
  );
}
