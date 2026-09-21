import React, { useMemo, useRef, useState } from "react";
import { View, Text, PanResponder, TouchableOpacity } from "react-native";
import { colors, Icon } from "@rentacar/mobile-shared";

const fmt = (n) => `$${Number(n || 0).toLocaleString("es-CL")}`;

export function SelectorCategoria({ tipos, seleccionado, onSelect }) {
  const [ancho, setAncho] = useState(0);
  const anchoRef = useRef(0);
  const indice = Math.max(
    0,
    tipos.findIndex((t) => t.id === seleccionado)
  );
  const total = tipos.length;
  const tipo = tipos[indice] || tipos[0];

  const seleccionarPorX = (x) => {
    const w = anchoRef.current;
    if (!w || total < 2) return;
    const frac = Math.min(1, Math.max(0, x / w));
    const idx = Math.round(frac * (total - 1));
    const nuevo = tipos[idx];
    if (nuevo && nuevo.id !== seleccionado) onSelect(nuevo.id);
  };

  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (e) => seleccionarPorX(e.nativeEvent.locationX),
        onPanResponderMove: (e) => seleccionarPorX(e.nativeEvent.locationX),
      }),
    [seleccionado, tipos]
  );

  const pos = total > 1 ? (indice / (total - 1)) * 100 : 0;

  return (
    <View className="bg-white rounded-2xl border border-gray-100 p-4 gap-3 shadow-sm">
      <View className="flex-row items-center gap-3">
        <View className="w-11 h-11 rounded-xl bg-primary-100 items-center justify-center">
          <Icon name={tipo.icon} size={22} color={colors.primary} />
        </View>
        <View className="flex-1">
          <Text className="text-lg font-extrabold -tracking-tight text-textDark">{tipo.labelCorto}</Text>
          <Text className="text-xs text-textMuted mt-0.5" numberOfLines={1}>
            {tipo.ejemplos}
          </Text>
        </View>
      </View>

      <Text className="text-[13px] text-textMuted leading-[18px]">{tipo.descripcion}</Text>

      <View className="py-3 px-1" {...pan.panHandlers}>
        <View
          className="h-2 rounded-full bg-gray-100 justify-center"
          onLayout={(e) => {
            anchoRef.current = e.nativeEvent.layout.width;
            setAncho(e.nativeEvent.layout.width);
          }}
        >
          <View className="absolute left-0 top-0 bottom-0 rounded-full bg-primary" style={{ width: `${pos}%` }} />
          {ancho > 0 &&
            tipos.map((t, i) => (
              <View
                key={t.id}
                className={`absolute w-1 h-1 rounded-full -ml-0.5 ${i <= indice ? "bg-white" : "bg-gray-300"}`}
                style={{ left: `${(i / (total - 1)) * 100}%` }}
              />
            ))}
          <View
            className="absolute w-[26px] h-[26px] rounded-full -ml-[13px] bg-white border-[3px] border-primary shadow-sm"
            style={{ left: `${pos}%` }}
          />
        </View>
      </View>

      <View className="flex-row">
        {tipos.map((t, i) => {
          const isSelected = t.id === seleccionado;
          return (
            <TouchableOpacity
              key={t.id}
              className="flex-1"
              onPress={() => onSelect(t.id)}
              hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
            >
              <Text
                className={`text-[10px] ${
                  isSelected ? "text-primary font-bold" : "text-gray-400"
                } ${i === 0 ? "text-left" : i === total - 1 ? "text-right" : "text-center"}`}
              >
                {t.labelCorto}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View className="flex-row items-center justify-center gap-1.5 bg-surface-subtle rounded-xl py-2">
        <Text className="text-xs text-textMuted">Rango de la categoría</Text>
        <Text className="text-xs font-bold text-primary">
          {fmt(tipo.min)} – {fmt(tipo.base)}
        </Text>
      </View>
    </View>
  );
}
