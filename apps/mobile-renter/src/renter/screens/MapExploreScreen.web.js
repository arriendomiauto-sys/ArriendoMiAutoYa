import React from "react";
import { View, Text, StatusBar } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icon, Button } from "@rentacar/mobile-shared";

// react-native-maps es un módulo nativo y no existe en web. La versión web
// muestra una alternativa; el mapa real vive en MapExploreScreen.js (nativo).
export function MapExploreScreen({ onBack }) {
  const insets = useSafeAreaInsets();
  return (
    <View className="flex-1 bg-background">
      <StatusBar barStyle="dark-content" />
      <View className="flex-1 items-center px-8 gap-3" style={{ paddingTop: insets.top + 40 }}>
        <View className="w-16 h-16 rounded-full bg-teal-50 items-center justify-center">
          <Icon name="pin" size={30} color="#0F766E" />
        </View>
        <Text className="text-lg font-bold text-textDark text-center">El mapa está en la app</Text>
        <Text className="text-sm text-textMuted text-center leading-5">
          La vista de mapa usa mapas nativos y no está disponible en la versión web.
          Abre ArriendoMiAutoYa en tu teléfono para explorar los autos en el mapa.
        </Text>
        <Button
          label="Volver al listado"
          onPress={onBack}
          fullWidth={false}
          className="mt-3"
        />
      </View>
    </View>
  );
}

