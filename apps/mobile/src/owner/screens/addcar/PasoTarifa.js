import React from "react";
import { ScrollView, StyleSheet } from "react-native";
import { theme } from "@rentacar/mobile-shared";
import { TituloPaso } from "./comun";
import { ControlTarifa } from "./ControlTarifa";

export function PasoTarifa({ wizard }) {
  const { configTipo, tarifaActual, desglose, ajustarTarifa, fijarTarifa } = wizard;

  return (
    <ScrollView
      contentContainerStyle={estilos.scroll}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <TituloPaso
        titulo="Tu tarifa"
        bajada="La categoría que elegiste fija el precio base. Tú decides cuánto descontar."
      />

      <ControlTarifa
        tipo={configTipo}
        valor={tarifaActual}
        desglose={desglose}
        onAjustar={ajustarTarifa}
        onFijar={fijarTarifa}
      />
    </ScrollView>
  );
}

const estilos = StyleSheet.create({
  scroll: {
    paddingHorizontal: theme.spacing.screen,
    paddingTop: theme.spacing.md,
    paddingBottom: 40,
    gap: theme.spacing.lg,
  },
});
