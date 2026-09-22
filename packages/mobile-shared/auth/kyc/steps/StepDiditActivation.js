import React from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { Icon } from "../../../components/Icon";
import { colors } from "../../../theme/colors";

// ============================================================================
// Pantalla 1: Activación de la verificación rápida con Didit
// Explica el flujo (cédula + licencia + selfie) y abre la sesión hosted externa.
// El riel vertical se dibuja como secuencia real: carnet -> licencia -> selfie.
// ============================================================================

// Los 3 requisitos, en el orden en que Didit los pide dentro del flujo hosted.
const REQUIREMENTS = [
  {
    title: "Carnet de identidad",
    description: "Foto por ambos lados, sin reflejos.",
  },
  {
    title: "Licencia de conducir",
    description: "Vigente y Clase B.",
  },
  {
    title: "Selfie biométrica",
    description: "Prueba de vida para confirmar que eres tú.",
  },
];

// ----------------------------------------------------------------------------
// Nodo del riel: disco de menta con check y, salvo en el último, la línea que
// lo conecta con el siguiente paso.
// ----------------------------------------------------------------------------
function RailStep({ title, description, last }) {
  return (
    <View className="flex-row gap-3.5">
      <View className="w-7 h-7 rounded-full bg-accent-500 justify-center items-center">
        <Icon name="check" size={14} color={colors.textWhite} strokeWidth={2.6} />
        {!last && <View className="absolute top-7 left-[13px] w-0.5 h-10 bg-accent-200" />}
      </View>
      <View className="flex-1 pt-[3px]">
        <Text className="text-[14.5px] font-bold text-text">{title}</Text>
        <Text className="text-[12.5px] text-text-secondary mt-0.5">{description}</Text>
      </View>
    </View>
  );
}

export function StepDiditActivation({ onStartDidit, onTriggerFallback, isLoading }) {
  return (
    <View className="flex-1 bg-background">
      {/* Contenido con scroll: promesa, riel de requisitos y nota de privacidad */}
      <ScrollView
        contentContainerClassName="grow p-5"
        showsVerticalScrollIndicator={false}
      >
        {/* Bloque cabecera: emblema de seguridad y promesa del flujo */}
        <View className="mb-[26px]">
          <View className="w-[60px] h-[60px] rounded-[18px] bg-primary-700 justify-center items-center mb-[18px]">
            <Icon name="shield" size={30} color={colors.accent500} />
          </View>
          <Text className="text-[22px] font-extrabold leading-[27px] tracking-[-0.3px] text-primary-700 mb-2.5">
            Verificación rápida de identidad y licencia
          </Text>
          <Text className="text-sm leading-[21px] text-text-secondary">
            En menos de 2 minutos validamos tu cédula de identidad, tu licencia de
            conducir y una selfie biométrica.
          </Text>
        </View>

        {/* Bloque riel: los 3 pasos que corre Didit, como secuencia conectada */}
        <View className="gap-5">
          {REQUIREMENTS.map((item, index) => (
            <RailStep
              key={item.title}
              title={item.title}
              description={item.description}
              last={index === REQUIREMENTS.length - 1}
            />
          ))}
        </View>

        {/* Bloque privacidad: qué hace Didit con las fotos */}
        <View className="flex-row gap-2.5 items-start mt-6 p-3.5 rounded-xl bg-surface-subtle">
          <Icon name="lock" size={16} color={colors.accent800} strokeWidth={1.7} />
          <Text className="flex-1 text-[12.5px] leading-[18px] text-accent-800">
            Didit procesa tus fotos de forma cifrada. No quedan guardadas en el
            teléfono.
          </Text>
        </View>
      </ScrollView>

      {/* Bloque acciones: CTA primario (Didit) y salida manual como respaldo */}
      <View className="border-t border-border bg-surface pt-3 pb-4">
        <TouchableOpacity
          className="bg-primary-700 rounded-[14px] py-4 items-center justify-center mx-4 my-2"
          onPress={onStartDidit}
          disabled={isLoading}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="Iniciar verificación"
        >
          {isLoading ? (
            <ActivityIndicator size="small" color={colors.textWhite} />
          ) : (
            <Text className="text-white text-base font-bold">Iniciar verificación</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          className="bg-transparent rounded-[14px] py-3.5 items-center justify-center mx-4"
          onPress={onTriggerFallback}
          disabled={isLoading}
          accessibilityRole="button"
          accessibilityLabel="Subir fotos manualmente"
        >
          <Text className="text-primary-600 text-sm font-semibold">Subir fotos manualmente</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
