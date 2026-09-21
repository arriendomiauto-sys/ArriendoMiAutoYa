import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { theme, Icon, BackButton } from "@rentacar/mobile-shared";

const PASOS = ["Auto", "Tarifa", "Fotos", "Docs"];

function Nodo({ indice, actual }) {
  const hecho = indice < actual;
  const activo = indice === actual;
  return (
    <View
      className={`w-7 h-7 rounded-full items-center justify-center ${
        hecho || activo ? "bg-primary" : "bg-white border-[1.5px] border-gray-200"
      }`}
    >
      {hecho ? (
        <Icon name="check" size={13} color="#FFFFFF" />
      ) : (
        <Text className={`text-[13px] font-bold ${activo || hecho ? "text-white" : "text-gray-400"}`}>
          {indice + 1}
        </Text>
      )}
    </View>
  );
}

export function WizardShell({
  paso,
  onBack,
  onNext,
  siguienteLabel,
  siguienteHabilitado = true,
  cargando = false,
  children,
}) {
  const insets = useSafeAreaInsets();
  const indice = paso - 1;

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-background"
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View className="px-4 pb-3 gap-3 bg-background" style={{ paddingTop: Math.max(insets.top, 12) + 8 }}>
        <View className="flex-row items-center gap-3">
          <BackButton onPress={onBack} />
          <Text className="text-[13px] font-semibold text-textMuted">{`Paso ${paso} de 4`}</Text>
        </View>

        <View className="flex-row items-center">
          {PASOS.map((label, i) => (
            <React.Fragment key={label}>
              {i > 0 ? (
                <View className={`flex-1 h-0.5 ${i <= indice ? "bg-primary" : "bg-gray-200"}`} />
              ) : null}
              <Nodo indice={i} actual={indice} />
            </React.Fragment>
          ))}
        </View>
        <View className="flex-row -mt-1">
          {PASOS.map((label, i) => (
            <Text
              key={label}
              className={`flex-1 text-center text-[11px] ${
                i <= indice
                  ? i === indice
                    ? "text-primary font-bold"
                    : "text-primary font-semibold"
                  : "text-gray-400"
              }`}
            >
              {label}
            </Text>
          ))}
        </View>
      </View>

      <View className="flex-1">{children}</View>

      <View
        className="flex-row items-center gap-3 px-4 pt-3 border-t border-gray-200 bg-white"
        style={{ paddingBottom: Math.max(insets.bottom, 14) + 12 }}
      >
        <TouchableOpacity onPress={onBack} hitSlop={theme.control.hitSlop} accessibilityRole="button">
          <Text className="text-sm font-semibold text-primary py-2 pr-1">Atrás</Text>
        </TouchableOpacity>
        <TouchableOpacity
          className={`flex-1 h-12 rounded-xl flex-row items-center justify-center gap-2 ${
            !siguienteHabilitado ? "bg-gray-200" : "bg-primary"
          }`}
          onPress={onNext}
          disabled={!siguienteHabilitado || cargando}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel={siguienteLabel}
          accessibilityState={{ disabled: !siguienteHabilitado || cargando, busy: cargando }}
        >
          {cargando ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <Text className="text-[15px] font-bold text-white">{siguienteLabel}</Text>
              <Icon name={paso === 4 ? "check" : "arrow-right"} size={18} color="#FFFFFF" />
            </>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}
