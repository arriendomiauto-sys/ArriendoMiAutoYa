import React from "react";
import { View, Text, ScrollView, StatusBar } from "react-native";
import {
  Card,
  ScreenHeader,
  Button,
  DateTimeField,
  formatearFechaHora,
} from "@rentacar/mobile-shared";

const precioCLP = (n) => `$${(n || 0).toLocaleString("es-CL")}`;

/**
 * Pantalla dedicada a elegir retiro y devolución — separada de la ficha del
 * auto (Lote de rediseño: la ficha solo muestra auto + anfitrión, y "Siguiente"
 * trae al usuario acá antes de pasar al resumen de la reserva).
 */
export function DateSelectionScreen({
  car,
  fechaInicio,
  fechaFin,
  onChangeInicio,
  onChangeFin,
  ahora,
  minimumDateFin,
  rangosOcupados,
  disponibilidadError,
  dias,
  montoCobro,
  dateError,
  onBack,
  onConfirm,
}) {
  const nombreAuto = [car?.marca, car?.modelo, car?.anio].filter(Boolean).join(" ");

  return (
    <View className="flex-1 bg-background">
      <StatusBar barStyle="dark-content" />
      <ScreenHeader title="Elige tus fechas" subtitle={nombreAuto || "Vehículo"} onBack={onBack} />
      <ScrollView contentContainerClassName="p-4 gap-4" showsVerticalScrollIndicator={false}>
        {disponibilidadError && (
          <View className="bg-amber-50 rounded-xl p-4 gap-1">
            <Text className="text-sm font-bold text-amber-800">No pudimos verificar disponibilidad</Text>
            <Text className="text-[13px] text-amber-800 leading-[19px]">
              Reintenta antes de elegir fechas — así evitamos que reserves un día ya tomado.
            </Text>
          </View>
        )}

        <View className="flex-row gap-3">
          <DateTimeField
            label="Retiro"
            value={fechaInicio}
            onChange={onChangeInicio}
            minimumDate={ahora}
            rangosBloqueados={rangosOcupados}
            disabled={disponibilidadError}
          />
          <DateTimeField
            label="Devolución"
            value={fechaFin}
            onChange={onChangeFin}
            minimumDate={minimumDateFin}
            rangosBloqueados={rangosOcupados}
            disabled={disponibilidadError}
          />
        </View>

        {dateError && (
          <View className="bg-amber-50 rounded-xl p-4 gap-1">
            <Text className="text-sm font-bold text-amber-800">Fechas inválidas</Text>
            <Text className="text-[13px] text-amber-800 leading-[19px]">{dateError}</Text>
          </View>
        )}

        <Card className="flex-row items-center gap-3" padded>
          <View className="flex-1">
            <Text className="text-[15px] font-semibold text-textDark">
              {dias > 0 ? `${dias} ${dias === 1 ? "día" : "días"} de arriendo` : "Elige fechas válidas"}
            </Text>
            {dias > 0 && (
              <Text className="text-[13px] text-textMuted mt-0.5">
                {formatearFechaHora(fechaInicio)} → {formatearFechaHora(fechaFin)}
              </Text>
            )}
          </View>
          <Text className="text-lg font-bold text-textDark">{precioCLP(montoCobro)}</Text>
        </Card>
      </ScrollView>

      <View className="px-4 pt-3 pb-4 bg-white border-t border-border">
        <Button
          label="Confirmar fechas"
          iconRight="arrow-right"
          onPress={onConfirm}
          disabled={dias === 0 || disponibilidadError}
        />
      </View>
    </View>
  );
}

