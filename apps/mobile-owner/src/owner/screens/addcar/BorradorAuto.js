import React from "react";
import { View, Text } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, Icon, Button, ScreenHeader } from "@rentacar/mobile-shared";

function tiempoDesde(ms) {
  if (!ms) return null;
  const min = Math.round((Date.now() - ms) / 60000);
  if (min < 1) return "hace un momento";
  if (min < 60) return `hace ${min} min`;
  const horas = Math.round(min / 60);
  if (horas < 24) return `hace ${horas} h`;
  const dias = Math.round(horas / 24);
  return `hace ${dias} ${dias === 1 ? "día" : "días"}`;
}

/**
 * Se muestra cuando se encuentra un auto sin terminar de publicar, guardado
 * automáticamente en el dispositivo (ver DRAFT_STORAGE_KEY en
 * useCarWizard.js). Antes, salir del wizard a mitad de camino -- o que la
 * app se cerrara sola mientras se subían las fotos -- borraba todo sin
 * aviso, aunque la pantalla decía "puedes salir y retomar después".
 */
export function BorradorAuto({ borrador, onRetomar, onDescartar, onBack }) {
  const insets = useSafeAreaInsets();
  const nombre = [borrador?.form?.marca, borrador?.form?.modelo].filter(Boolean).join(" ");
  const fotos = Object.keys(borrador?.fotosPorSlot || {}).length;
  const cuando = tiempoDesde(borrador?.guardadoEn);

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: Math.max(insets.top, 12) }}>
      <ScreenHeader title="Publicar un auto" onBack={onBack} />
      <View className="flex-1 items-center justify-center gap-2 px-8">
        <View className="w-16 h-16 rounded-full items-center justify-center bg-primary-100 mb-2">
          <Icon name="car" size={30} color={colors.primary} />
        </View>
        <Text className="text-textDark text-[19px] font-extrabold text-center">
          Tienes un auto sin terminar de publicar
        </Text>
        <Text className="text-textMuted text-sm leading-5 text-center">
          {nombre ? `${nombre}. ` : ""}
          {fotos > 0 ? `Ya tienes ${fotos} ${fotos === 1 ? "foto subida" : "fotos subidas"}. ` : ""}
          {cuando ? `Guardado ${cuando}.` : "Lo guardamos automáticamente en tu teléfono."}
        </Text>
        <Button label="Retomar donde quedé" onPress={onRetomar} className="mt-4 w-full" />
        <Button variant="ghost" label="Empezar un auto nuevo" onPress={onDescartar} className="w-full" />
      </View>
    </View>
  );
}
