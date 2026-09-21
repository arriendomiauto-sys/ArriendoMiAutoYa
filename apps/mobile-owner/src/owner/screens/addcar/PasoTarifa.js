import React from "react";
import { ScrollView } from "react-native";
import { TituloPaso } from "./comun";
import { ControlTarifa } from "./ControlTarifa";

export function PasoTarifa({ wizard }) {
  const { configTipo, tarifaActual, desglose, ajustarTarifa, fijarTarifa } = wizard;

  return (
    <ScrollView
      contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 40, gap: 16 }}
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
