import React from "react";
import { View, Text } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, Icon, Button, ScreenHeader } from "@rentacar/mobile-shared";

export function TarjetaRequerida({ estado, onBack }) {
  const insets = useSafeAreaInsets();
  const enRevision = estado === "requiere_revision_manual";
  const rechazada = estado === "rechazada";

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: Math.max(insets.top, 12) }}>
      <ScreenHeader title="Publicar un auto" onBack={onBack} />
      <View className="flex-1 items-center justify-center gap-2 px-8">
        <View className="w-16 h-16 rounded-full items-center justify-center bg-primary-100 mb-2">
          <Icon name={enRevision ? "clock" : "card"} size={30} color={colors.primary} />
        </View>
        <Text className="text-textDark text-[19px] font-extrabold text-center">
          {enRevision ? "Estamos revisando tu tarjeta" : "Primero registra tu tarjeta"}
        </Text>
        <Text className="text-textMuted text-sm leading-5 text-center">
          {enRevision
            ? "Apenas quede validada podrás publicar tu auto. Te avisamos por notificación."
            : rechazada
              ? "Tu tarjeta fue rechazada. Registra otra desde tu perfil y vuelve a intentarlo."
              : "Necesitamos una tarjeta de crédito validada antes de publicar. Es de donde se cobran el deducible, los cargos de la devolución y los peajes que llegan a nombre de la patente."}
        </Text>
        {!enRevision ? (
          <Text className="text-primary text-[13px] font-bold text-center">La registras en tu perfil, en Métodos de pago.</Text>
        ) : null}
        <Button label="Entendido" onPress={onBack} style={{ marginTop: 16 }} />
      </View>
    </View>
  );
}
