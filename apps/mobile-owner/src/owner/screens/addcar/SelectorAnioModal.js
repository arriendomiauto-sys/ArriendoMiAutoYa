import React from "react";
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  TouchableWithoutFeedback,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, theme, Icon } from "@rentacar/mobile-shared";

export function SelectorAnioModal({ visible, anioSeleccionado, onSelect, onClose }) {
  let insets = { bottom: 0, top: 0, left: 0, right: 0 };
  try {
    insets = useSafeAreaInsets();
  } catch {
    // Fuera de SafeAreaProvider en tests
  }
  const anioActual = new Date().getFullYear();
  const anioMaximo = anioActual + 1;
  const anioMinimo = 2000;

  const anios = React.useMemo(() => {
    const lista = [];
    for (let a = anioMaximo; a >= anioMinimo; a--) {
      lista.push(a);
    }
    return lista;
  }, [anioMaximo]);

  const aniosFrecuentes = React.useMemo(() => {
    return [anioActual, anioActual - 1, anioActual - 2, anioActual - 3, anioActual - 4, anioActual - 5];
  }, [anioActual]);

  const seleccionadoNum = parseInt(anioSeleccionado, 10);

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View className="flex-1 bg-[#0A1914]/55 justify-end">
          <TouchableWithoutFeedback>
            <View
              className="bg-white rounded-t-3xl max-h-[75%] px-5 pt-3"
              style={{ paddingBottom: Math.max(insets?.bottom || 0, 20) + 8 }}
            >
              <View className="w-10 h-1 rounded bg-gray-200 self-center mb-3.5" />

              <View className="flex-row justify-between items-start mb-4">
                <View>
                  <Text className="text-lg font-extrabold text-textDark -tracking-tight">Año de fabricación</Text>
                  <Text className="text-[12.5px] text-textMuted mt-0.5">
                    Aceptamos modelos desde el {anioMinimo} al {anioMaximo}
                  </Text>
                </View>
                <TouchableOpacity
                  className="p-1.5 rounded-full bg-surface-subtle"
                  onPress={onClose}
                  hitSlop={theme.control.hitSlop}
                  accessibilityLabel="Cerrar selector de año"
                >
                  <Icon name="close" size={20} color={colors.textMuted} />
                </TouchableOpacity>
              </View>

              <Text className="text-[11.5px] font-bold tracking-wider uppercase text-textMuted mb-2 mt-1.5">Más recientes</Text>
              <View className="flex-row flex-wrap gap-2 mb-3">
                {aniosFrecuentes.map((a) => {
                  const esActivo = seleccionadoNum === a;
                  return (
                    <TouchableOpacity
                      key={a}
                      className={`px-3.5 py-1.5 rounded-full border ${
                        esActivo ? "bg-primary border-primary" : "bg-surface-subtle border-gray-200"
                      }`}
                      onPress={() => {
                        onSelect(String(a));
                        onClose();
                      }}
                      accessibilityLabel={`Año ${a}`}
                      activeOpacity={0.8}
                    >
                      <Text className={`text-[13px] font-bold ${esActivo ? "text-white" : "text-textDark"}`}>
                        {a}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text className="text-[11.5px] font-bold tracking-wider uppercase text-textMuted mb-2 mt-1.5">
                Todos los años ({anioMaximo} - {anioMinimo})
              </Text>
              <ScrollView
                className="max-h-[260px]"
                contentContainerStyle={{ paddingBottom: 16, gap: 4 }}
                showsVerticalScrollIndicator={true}
              >
                {anios.map((a) => {
                  const esActivo = seleccionadoNum === a;
                  return (
                    <TouchableOpacity
                      key={a}
                      className={`flex-row items-center justify-between py-2.5 px-3.5 rounded-xl ${
                        esActivo ? "bg-primary-100" : ""
                      }`}
                      onPress={() => {
                        onSelect(String(a));
                        onClose();
                      }}
                      accessibilityLabel={`Año ${a}`}
                      activeOpacity={0.7}
                    >
                      <Text className={`text-[15px] ${esActivo ? "text-primary font-extrabold" : "font-semibold text-textDark"}`}>
                        {a}
                      </Text>
                      {esActivo ? (
                        <View className="w-[22px] h-[22px] rounded-full bg-primary items-center justify-center">
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
  );
}
