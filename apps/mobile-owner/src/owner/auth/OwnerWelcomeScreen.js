import React from "react";
import { View, Text, TouchableOpacity, ScrollView, StatusBar } from "react-native";
import { BotonesOAuth, Icon, colors } from "@rentacar/mobile-shared";
import { OwnerAuthHero } from "./OwnerAuthHero";
import { OwnerGradientButton } from "./OwnerGradientButton";

// Beneficios cortos que llenan el espacio entre el subtítulo y las
// acciones: antes era un spacer vacío (flex-grow) sin contenido.
const BENEFICIOS = [
  {
    icon: "zap",
    title: "Publica en minutos",
    desc: "Sube fotos y datos de tu auto, sin trámites complicados.",
  },
  {
    icon: "shield",
    title: "Garantía protegida",
    desc: "Cada arriendo queda cubierto para tu tranquilidad.",
  },
  {
    icon: "dollar",
    title: "Recibe tus ganancias",
    desc: "El pago se transfiere directo a tu cuenta.",
  },
];

// Bienvenida exclusiva de la app de dueño usando NativeWind
export function OwnerWelcomeScreen({ onNavigate }) {
  return (
    <View className="flex-1 bg-background">
      <StatusBar barStyle="light-content" />
      <OwnerAuthHero variant="full" />

      <ScrollView contentContainerClassName="flex-grow p-4 pb-8 gap-4" showsVerticalScrollIndicator={false}>
        <Text className="text-5xl font-bold text-primary-700 text-center mt-1">¡Bienvenido!</Text>
        <Text className="text-[14.5px] leading-[21px] text-textMuted text-center">
          Publica tu auto y empieza a generar ingresos en minutos.
        </Text>

        <View className="flex-grow gap-4 justify-center my-2">
          {BENEFICIOS.map((b) => (
            <View key={b.title} className="flex-row items-center gap-3">
              <View className="w-11 h-11 rounded-full bg-primary-100 items-center justify-center">
                <Icon name={b.icon} size={20} color={colors.primary700} />
              </View>
              <View className="flex-1">
                <Text className="text-[14px] font-semibold text-textDark">{b.title}</Text>
                <Text className="text-[12.5px] text-textMuted">{b.desc}</Text>
              </View>
            </View>
          ))}
        </View>

        <OwnerGradientButton label="Crear cuenta de dueño" onPress={() => onNavigate("register")} />

        <TouchableOpacity
          onPress={() => onNavigate("login")}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="Iniciar sesión"
          className="h-[50px] rounded-full border-[1.6px] border-primary-700 items-center justify-center active:opacity-80"
        >
          <Text className="text-[15.5px] font-semibold text-primary-700">Iniciar sesión</Text>
        </TouchableOpacity>

        <BotonesOAuth preferredMode="owner" />
      </ScrollView>
    </View>
  );
}
