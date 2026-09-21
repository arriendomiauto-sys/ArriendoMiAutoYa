import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { colors, Icon, PASO_PRECIO_CLP } from "@rentacar/mobile-shared";

const fmt = (n) => `$${Number(n || 0).toLocaleString("es-CL")}`;

export function ControlTarifa({ tipo, valor, desglose, onAjustar, onFijar }) {
  const enPiso = valor <= tipo.min;
  const enTope = valor >= tipo.base;
  const conDescuento = valor < tipo.base;

  return (
    <>
      <View className="bg-white rounded-2xl border border-gray-100 p-4 gap-3 shadow-sm mb-4">
        <View className="flex-row items-center justify-between">
          <Text className="text-[13px] text-textMuted">Precio de tu categoría</Text>
          <View className="flex-row items-center gap-1 bg-surface-secondary rounded-full py-1 px-2">
            <Icon name="lock" size={11} color={colors.textMuted} />
            <Text className="text-[11px] font-bold text-textMuted">Fijado por RentACar</Text>
          </View>
        </View>
        <Text className={`text-base font-bold ${conDescuento ? "line-through text-gray-400" : "text-textDark"}`}>
          {fmt(tipo.base)}
        </Text>

        <View className="h-[1px] bg-gray-200" />

        <Text className="text-xs font-semibold tracking-wider uppercase text-textMuted">Tu tarifa por día</Text>

        <View className="flex-row items-center gap-3">
          <TouchableOpacity
            className={`w-[52px] h-[52px] rounded-xl border-[1.5px] items-center justify-center ${
              enPiso ? "border-gray-200 bg-gray-100" : "border-primary-200 bg-primary-100"
            }`}
            onPress={() => onAjustar(-PASO_PRECIO_CLP)}
            disabled={enPiso}
            accessibilityRole="button"
            accessibilityLabel="Bajar la tarifa cinco mil pesos"
            accessibilityState={{ disabled: enPiso }}
          >
            <Icon name="minus" size={20} color={enPiso ? colors.textPlaceholder : colors.primary} />
          </TouchableOpacity>

          <View className="flex-1 items-center">
            <Text className="text-[30px] font-extrabold -tracking-tight text-primary">{fmt(valor)}</Text>
          </View>

          <TouchableOpacity
            className={`w-[52px] h-[52px] rounded-xl border-[1.5px] items-center justify-center ${
              enTope ? "border-gray-200 bg-gray-100" : "border-primary-200 bg-primary-100"
            }`}
            onPress={() => onAjustar(PASO_PRECIO_CLP)}
            disabled={enTope}
            accessibilityRole="button"
            accessibilityLabel="Subir la tarifa cinco mil pesos"
            accessibilityState={{ disabled: enTope }}
          >
            <Icon name="plus" size={20} color={enTope ? colors.textPlaceholder : colors.primary} />
          </TouchableOpacity>
        </View>

        <View className="flex-row flex-wrap gap-1.5">
          {tipo.escalones.map((precio) => {
            const activo = precio === valor;
            return (
              <TouchableOpacity
                key={precio}
                className={`py-2 px-3 rounded-full border ${
                  activo ? "bg-primary border-primary" : "border-gray-200 bg-white"
                }`}
                onPress={() => onFijar(precio)}
                accessibilityRole="button"
                accessibilityState={{ selected: activo }}
              >
                <Text className={`text-[13px] font-semibold ${activo ? "text-white" : "text-textMuted"}`}>
                  {fmt(precio)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View className="flex-row items-start gap-2 bg-emerald-50 rounded-xl p-2.5">
          <Icon name="star" size={13} color={colors.accent} fill={colors.accent} />
          <Text className="flex-1 text-xs text-accent-700 leading-[17px]">
            Bajar tu tarifa te posiciona más arriba en las búsquedas y llena más días.
          </Text>
        </View>
      </View>

      <View className="bg-white rounded-2xl border border-gray-100 p-4 gap-3 shadow-sm mb-4">
        <View className="flex-row items-center justify-between">
          <View className="flex-1">
            <Text className="text-xs font-semibold tracking-wider uppercase text-textMuted">Recibes por día (85%)</Text>
            <Text className="text-[26px] font-extrabold -tracking-tight text-accent-700 mt-0.5">{fmt(desglose.gananciaDueno)}</Text>
          </View>
          <View className="bg-emerald-50 border border-emerald-200 rounded-md py-1 px-2">
            <Text className="text-[10px] font-bold uppercase tracking-wider text-accent-700">IVA 19% incl.</Text>
          </View>
        </View>
        <View className="h-[1px] bg-gray-200" />
        <Fila k="Tarifa al cliente" v={fmt(desglose.tarifaBruta)} fuerte />
        <Fila k="Valor neto" v={fmt(desglose.subtotalNeto)} />
        <Fila k="IVA (19%)" v={fmt(desglose.ivaMonto)} />
        <Fila k="Comisión plataforma (15%)" v={`-${fmt(desglose.comisionPlataforma)}`} />
        <Text className="text-[11px] text-gray-400 leading-[15px] mt-1">
          La plataforma retiene 15% por seguro, verificación de identidad y soporte 24/7.
        </Text>
      </View>
    </>
  );
}

function Fila({ k, v, fuerte }) {
  return (
    <View className="flex-row justify-between items-center py-0.5">
      <Text className={fuerte ? "text-xs font-bold text-textDark" : "text-[11px] text-textMuted"}>{k}</Text>
      <Text className={fuerte ? "text-xs font-bold text-textDark" : "text-[11px] text-textMuted"}>{v}</Text>
    </View>
  );
}
