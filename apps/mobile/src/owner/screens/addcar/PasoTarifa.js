import React from "react";
import { ScrollView, StyleSheet } from "react-native";
import { theme } from "@rentacar/mobile-shared";
import { TituloPaso } from "./comun";
import { SelectorCategoria } from "./SelectorCategoria";
import { ControlTarifa } from "./ControlTarifa";

export function PasoTarifa({ wizard }) {
  const { tipos, form, configTipo, tarifaActual, desglose, elegirCategoria, ajustarTarifa, fijarTarifa } = wizard;

  return (
    <ScrollView
      contentContainerStyle={estilos.scroll}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <TituloPaso
        titulo="Tu categoría y tu tarifa"
        bajada="La categoría fija el precio base. Tú decides cuánto descontar."
      />

      <SelectorCategoria tipos={tipos} seleccionado={form.categoria} onSelect={elegirCategoria} />

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
