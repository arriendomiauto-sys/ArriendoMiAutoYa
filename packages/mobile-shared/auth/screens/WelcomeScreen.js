import React from "react";
import { View, Text, TouchableOpacity, StatusBar, ScrollView } from "react-native";
import { colors } from "../../theme/colors";
import { Icon } from "../../components/Icon";
import { BrandLogo } from "../../components/BrandLogo";
import { Button, Card, BottomBar } from "../../components/ui";
import { BotonesOAuth } from "../../components/BotonesOAuth";

// La app es un solo binario con dos experiencias. Acá el usuario elige con
// cuál partir; después alterna entre modos desde su perfil.
const ROLE_OPTIONS = [
  {
    key: "renter",
    cardIcon: "key",
    cardTitle: "Quiero arrendar",
    cardDesc: "Necesito un auto por unos días. Desde $22.000 el día.",
  },
  {
    key: "owner",
    cardIcon: "car",
    cardTitle: "Quiero publicar mi auto",
    cardDesc: "Tengo un auto parado y quiero que genere ingresos.",
  },
];

export function WelcomeScreen({ onNavigate, onSelectRole, role = "renter", fixedRole }) {
  return (
    <View className="flex-1 bg-surface justify-between">
      <StatusBar barStyle="dark-content" />

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 32, paddingTop: 40, gap: 32 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="h-12 justify-center">
          <BrandLogo size={52} />
        </View>

        <View className="gap-2">
          <Text className="text-[28px] leading-[34px] font-bold text-gray-900">El auto del vecino, arrendado en minutos</Text>
          <Text className="text-base leading-[25px] text-gray-500">
            Publica tu auto o arrienda el de otra persona, con garantía protegida
            y entrega 100% digital. ¿Qué quieres hacer?
          </Text>
        </View>

        {/* Selección de rol: define el modo con el que arranca la app.
            Con `fixedRole`, la app solo tiene un rol posible — se muestra
            nada más la tarjeta de ese rol, sin picker. */}
        <View className="gap-4 mt-2">
          {ROLE_OPTIONS.filter((opt) => !fixedRole || opt.key === fixedRole).map((opt) => {
            const selected = role === opt.key;
            return (
              <TouchableOpacity
                key={opt.key}
                onPress={() => onSelectRole?.(opt.key)}
                activeOpacity={fixedRole ? 1 : 0.85}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                disabled={!!fixedRole}
              >
                <Card
                  className={`p-5 gap-2 ${selected ? "border-[1.5px] border-primary-700" : ""}`}
                  elevated={selected}
                >
                  <View className="flex-row items-center gap-2">
                    <Icon name={opt.cardIcon} size={24} color={colors.primary} />
                    <Text className="text-base font-bold text-gray-900">{opt.cardTitle}</Text>
                  </View>
                  <Text className="text-sm text-gray-500">{opt.cardDesc}</Text>
                </Card>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      <BottomBar bordered={false} className="px-8 bg-transparent">
        <Button label="Crear mi cuenta" onPress={() => onNavigate("register")} />

        <BotonesOAuth preferredMode={role} />

        <TouchableOpacity
          testID="link-login"
          className="h-10 items-center justify-center"
          onPress={() => onNavigate("login")}
          activeOpacity={0.7}
        >
          <Text className="text-sm font-normal text-gray-500">
            Ya tengo cuenta <Text className="text-accent-700 font-semibold">Iniciar sesión</Text>
          </Text>
        </TouchableOpacity>
      </BottomBar>
    </View>
  );
}
