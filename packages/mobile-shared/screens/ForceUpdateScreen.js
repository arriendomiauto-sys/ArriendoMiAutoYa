import React from "react";
import { View, Text, Linking } from "react-native";
import { colors } from "../theme/colors";
import { Icon } from "../components/Icon";
import { Button } from "../components/ui";
import { BrandLogo } from "../components/BrandLogo";

/**
 * Pantalla bloqueante de actualización obligatoria. Sin `onBack`: no se
 * puede cerrar ni omitir — se muestra ANTES que cualquier otra pantalla,
 * incluido el login, cuando la versión instalada quedó por debajo de la
 * mínima soportada por el backend (ver useVersionCheck).
 */
export function ForceUpdateScreen({ urlStore }) {
  return (
    <View className="flex-1 items-center justify-center gap-5 px-8 bg-background">
      <BrandLogo size={72} />
      <View className="w-14 h-14 rounded-2xl bg-accent-100 items-center justify-center">
        <Icon name="refresh" size={28} color={colors.primary} />
      </View>
      <Text className="text-xl font-bold text-text text-center">Nueva versión disponible</Text>
      <Text className="text-sm leading-5 text-textMuted text-center">
        Actualizamos la app con mejoras importantes. Necesitas instalar la última versión para
        seguir usándola.
      </Text>
      <Button
        label="Actualizar ahora"
        onPress={() => urlStore && Linking.openURL(urlStore)}
        disabled={!urlStore}
        className="mt-3 w-full"
      />
    </View>
  );
}
