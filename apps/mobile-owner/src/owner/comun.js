import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { colors, Icon, BackButton } from "@rentacar/mobile-shared";

/**
 * Piezas compartidas de las pantallas del dueño usando NativeWind classes.
 */
export const OWNER_PREMIUM_BG = colors.primary900;
export const OWNER_PREMIUM_LINE = "rgba(47, 191, 155, 0.22)";

const MAX_GLOBO = 9;

/**
 * Botón de "Mensajes" para el header, con el globo real de no leídos. Antes
 * era un cuadrado gris chico (40x40, ícono apagado) que se perdía junto al
 * título -- ahora es más grande y con fondo sólido para que se note como una
 * acción real, no como un ícono decorativo más.
 */
export function BotonMensajes({ noLeidos = 0, onPress }) {
  const texto = noLeidos > MAX_GLOBO ? `${MAX_GLOBO}+` : String(noLeidos);
  return (
    <TouchableOpacity
      className="w-12 h-12 rounded-2xl bg-primary-700 items-center justify-center relative shadow-md active:opacity-85"
      onPress={onPress}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={noLeidos > 0 ? `Mensajes, ${noLeidos} sin leer` : "Mensajes"}
    >
      <Icon name="chat" size={23} color="#FFFFFF" />
      {noLeidos > 0 ? (
        <View className="absolute -top-1.5 -right-1.5 min-w-[20px] h-[20px] rounded-full px-1 bg-red-600 border-2 border-background items-center justify-center">
          <Text className="text-[11px] font-bold text-white" allowFontScaling={false}>
            {texto}
          </Text>
        </View>
      ) : null}
    </TouchableOpacity>
  );
}

/**
 * Cabecera estándar de una pantalla del dueño: título grande, bajada
 * opcional y (opcional) el botón de Mensajes con su globo.
 */
export function CabeceraOwner({ titulo, subtitulo, noLeidos, onMensajes, onBack, right }) {
  return (
    <View className="flex-row items-start gap-3 px-4 pt-2 pb-3">
      {onBack ? <BackButton onPress={onBack} /> : null}
      <View className="flex-1">
        <Text className="text-2xl font-bold text-textDark">{titulo}</Text>
        {subtitulo ? <Text className="text-[13px] text-textMuted mt-0.5">{subtitulo}</Text> : null}
      </View>
      {right}
      {onMensajes ? <BotonMensajes noLeidos={noLeidos || 0} onPress={onMensajes} /> : null}
    </View>
  );
}

/** Franja de resumen — el bloque hero premium (teal casi negro) del dueño. */
export function FranjaResumen({ items }) {
  return (
    <View className="flex-row items-stretch bg-primary-900 rounded-2xl border border-[rgba(47,191,155,0.22)] py-4 shadow-lg">
      {items.map((it, i) => (
        <React.Fragment key={it.label}>
          {i > 0 ? <View className="w-[1px] bg-[rgba(47,191,155,0.22)] my-1" /> : null}
          <View className="flex-1 items-center gap-0.5 px-1.5">
            <Text className="text-xl font-bold text-white tracking-tight">{it.value}</Text>
            <Text className="text-[11px] text-white/60 text-center tracking-[0.2px]">{it.label}</Text>
          </View>
        </React.Fragment>
      ))}
    </View>
  );
}

// Utilidades y clases predefinidas de Tailwind para pantallas de Owner
export const oc = {
  screen: "flex-1 bg-background",
  content: "p-4 gap-4",
  listContent: "px-4 gap-4",
  card: "bg-surface rounded-2xl border border-gray-200 shadow-sm",
  cardPadded: "p-4",
  cardTitle: "text-[15px] font-bold text-textDark",
  seccionMarca: "bg-primary-100 rounded-xl p-3.5",
  seccionSuave: "bg-surface-subtle rounded-xl p-3.5",
  pill: "flex-row items-center gap-1.5 py-1 px-2.5 rounded-full",
  pillDot: "w-1.5 h-1.5 rounded-full",
  pillText: "text-xs font-bold",
};
