import React from "react";
import { View, Text, ScrollView } from "react-native";
import { Card, ScreenHeader, SectionLabel } from "@rentacar/mobile-shared";
import { CasoSiniestroCard } from "@rentacar/mobile-shared/siniestros/CasoSiniestroCard";

/**
 * El dueño ve el accidente que reportó el arrendatario: el caso, las fotos y
 * todo lo que soporte informó (lo mismo que recibe el arrendatario).
 */
export function CasoAccidenteScreen({ reservaId, onBack }) {
  return (
    <View className="flex-1 bg-background">
      <ScreenHeader title="Accidente en tu auto" subtitle="Lo atiende el soporte 24/7" onBack={onBack} />
      <ScrollView contentContainerClassName="p-4 gap-4">
        <CasoSiniestroCard reservaId={reservaId} />
        <Card padded className="gap-2">
          <SectionLabel>Qué pasa ahora</SectionLabel>
          <Text className="text-[13px] text-textDark">• Un agente de soporte te llama para contarte el detalle.</Text>
          <Text className="text-[13px] text-textDark">
            • La garantía del arrendatario queda asegurada hasta que se decida qué se cobra.
          </Text>
          <Text className="text-[13px] text-textDark">
            • Cada decisión te llega por escrito, en la app y por correo, igual que al arrendatario.
          </Text>
        </Card>
      </ScrollView>
    </View>
  );
}
