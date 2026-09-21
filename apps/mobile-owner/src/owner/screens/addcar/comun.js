import React from "react";
import { View, Text } from "react-native";

export const CATEGORIAS_CAMPO = [
  { v: "economico", label: "Económico" },
  { v: "sedan", label: "Sedán" },
  { v: "suv", label: "SUV" },
  { v: "camioneta", label: "Camioneta" },
  { v: "premium", label: "Premium" },
];

export const TRANSMISIONES = [
  { v: "automatica", label: "Automática" },
  { v: "mecanica", label: "Mecánica" },
];

export const COMBUSTIBLES = [
  { v: "bencina", label: "Bencina" },
  { v: "diesel", label: "Diésel" },
  { v: "hibrido", label: "Híbrido" },
  { v: "electrico", label: "Eléctrico" },
];

export const EQUIPAMIENTO = [
  { key: "ac", label: "Aire acondicionado / climatizador" },
  { key: "bluetooth", label: "Audio Bluetooth / Apple CarPlay" },
  { key: "camara_retroceso", label: "Cámara y sensores de retroceso" },
  { key: "doble_traccion", label: "Tracción 4x4 / AWD" },
  { key: "isofix", label: "Anclajes ISOFIX para silla de bebé" },
];

export function MensajeError({ texto }) {
  if (!texto) return null;
  return (
    <Text className="text-red-500 text-xs leading-[17px] mt-1.5" accessibilityRole="alert">
      {texto}
    </Text>
  );
}

export function Tarjeta({ children, style, className }) {
  return (
    <View
      className={`bg-white rounded-2xl border border-gray-100 p-4 gap-3 shadow-sm ${className || ""}`}
      style={style}
    >
      {children}
    </View>
  );
}

export function TituloPaso({ titulo, bajada }) {
  return (
    <View className="gap-1">
      <Text className="text-2xl font-extrabold -tracking-tight leading-[30px] text-textDark">{titulo}</Text>
      {bajada ? <Text className="text-sm text-textMuted leading-5">{bajada}</Text> : null}
    </View>
  );
}

export function BarraProgreso({ hechos, total, etiqueta }) {
  const pct = total > 0 ? Math.round((hechos / total) * 100) : 0;
  return (
    <View className="gap-2">
      <View className="flex-row justify-between items-center">
        <Text className="text-[13px] font-bold text-primary">{`${hechos} de ${total} ${etiqueta}`}</Text>
        {hechos < total ? (
          <Text className="text-[13px] text-textMuted">{`Faltan ${total - hechos}`}</Text>
        ) : (
          <Text className="text-[13px] font-bold text-emerald-600">Listo</Text>
        )}
      </View>
      <View className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
        <View className="h-full rounded-full bg-accent" style={{ width: `${Math.max(pct, hechos > 0 ? 6 : 0)}%` }} />
      </View>
    </View>
  );
}

export const comun = {
  card: "bg-white rounded-2xl border border-gray-100 p-4 gap-3 shadow-sm",
  tituloWrap: "gap-1",
  titulo: "text-2xl font-extrabold -tracking-tight leading-[30px] text-textDark",
  bajada: "text-sm text-textMuted leading-5",
  fieldLabel: "text-xs font-semibold tracking-wider uppercase text-textMuted",
  input: "bg-white rounded-xl px-3.5 h-12 border-[1.5px] border-gray-200 text-[15px] text-textDark",
  inputError: "border-red-500",
  mensajeError: "text-red-500 text-xs leading-[17px] mt-1.5",
  cardTitle: "text-[15px] font-bold text-textDark",
  chipsRow: "flex-row flex-wrap gap-2",
  field: "gap-1.5",
  row: "flex-row gap-3",
  progresoWrap: "gap-2",
  progresoFila: "flex-row justify-between items-center",
  progresoFuerte: "text-[13px] font-bold text-primary",
  progresoSuave: "text-[13px] text-textMuted",
  progresoOk: "text-[13px] font-bold text-emerald-600",
  progresoTrack: "h-1.5 rounded-full bg-gray-100 overflow-hidden",
  progresoFill: "h-full rounded-full bg-accent",
};
