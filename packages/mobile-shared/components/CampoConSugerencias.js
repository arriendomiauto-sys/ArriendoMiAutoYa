import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, ScrollView } from "react-native";
import { colors } from "../theme/colors";

/**
 * Campo de texto con sugerencias de un catálogo cerrado o semiabierto.
 *
 * Nació para marca/modelo de auto (el catálogo de marcas es cerrado; el de
 * modelos no, así que el campo sigue aceptando texto libre) y se reutiliza
 * para banco. Elegir de la lista deja el nombre escrito igual para todos —
 * "Banco Estado", no "bco estado" ni "BancoEstado" — que es justo lo que un
 * campo libre no garantiza.
 *
 * `tone`: "light" (default, pantallas claras) | "dark" (superficies teal).
 */

function palette(tone) {
  const dark = tone === "dark";
  return {
    dark,
    surface: dark ? colors.darkCardSubtle : colors.surface,
    surfaceList: dark ? colors.darkCard : colors.surface,
    border: dark ? colors.darkBorder : colors.border,
    borderStrong: dark ? colors.darkBorderStrong : colors.borderLight,
    text: dark ? colors.textWhite : colors.text,
    textMuted: dark ? colors.textSilver : colors.textMuted,
    placeholder: dark ? colors.textSilver : colors.textPlaceholder,
  };
}

export function CampoConSugerencias({
  etiqueta,
  valor,
  onChange,
  onFocus,
  buscar,
  placeholder,
  ayuda,
  error,
  autoCapitalize = "words",
  tone = "light",
  className = "",
  style,
}) {
  const p = palette(tone);
  const [abierto, setAbierto] = useState(false);
  const opciones = buscar(valor);
  const yaEsExacta =
    opciones.length === 1 && opciones[0].toLowerCase() === (valor || "").trim().toLowerCase();
  const mostrarLista = abierto && opciones.length > 0 && !yaEsExacta;

  return (
    <View className={`gap-1.5 ${className}`} style={style}>
      {etiqueta ? (
        <Text className="text-xs font-semibold tracking-wider uppercase" style={{ color: p.textMuted }}>{etiqueta}</Text>
      ) : null}
      <TextInput
        className={`rounded-xl px-3.5 h-12 border-[1.5px] text-[15px] ${error ? "border-red-500" : ""}`}
        style={[
          { backgroundColor: p.surface, borderColor: error ? colors.danger : p.border, color: p.text },
        ]}
        placeholder={placeholder}
        placeholderTextColor={p.placeholder}
        value={valor}
        onChangeText={(t) => {
          onChange(t);
          setAbierto(true);
        }}
        onFocus={(e) => {
          setAbierto(true);
          onFocus && onFocus(e);
        }}
        // El retardo deja pasar el toque sobre una sugerencia: sin él, el
        // blur cierra la lista antes de que el toque llegue a registrarse.
        onBlur={() => setTimeout(() => setAbierto(false), 150)}
        autoCapitalize={autoCapitalize}
        autoCorrect={false}
        accessibilityLabel={etiqueta}
      />
      {ayuda && !error ? (
        <Text className="text-xs leading-4" style={{ color: p.textMuted }}>{ayuda}</Text>
      ) : null}
      {mostrarLista && (
        <View className="mt-1 rounded-xl border overflow-hidden" style={{ backgroundColor: p.surfaceList, borderColor: p.borderStrong }}>
          <ScrollView keyboardShouldPersistTaps="always" nestedScrollEnabled className="max-h-[220px]">
            {opciones.slice(0, 8).map((opcion) => (
              <TouchableOpacity
                key={opcion}
                className="py-3 px-3.5 border-b"
                style={{ borderBottomColor: p.border }}
                onPress={() => {
                  onChange(opcion);
                  setAbierto(false);
                }}
                accessibilityRole="button"
              >
                <Text className="text-[15px] font-medium" style={{ color: p.text }}>{opcion}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
}
