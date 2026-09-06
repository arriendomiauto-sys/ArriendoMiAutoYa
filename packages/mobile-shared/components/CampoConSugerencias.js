import React, { useState } from "react";
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView } from "react-native";
import { colors } from "../theme/colors";
import { theme } from "../theme/tokens";

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
}) {
  const p = palette(tone);
  const [abierto, setAbierto] = useState(false);
  const opciones = buscar(valor);
  const yaEsExacta =
    opciones.length === 1 && opciones[0].toLowerCase() === (valor || "").trim().toLowerCase();
  const mostrarLista = abierto && opciones.length > 0 && !yaEsExacta;

  return (
    <View style={styles.field}>
      {etiqueta ? (
        <Text style={[styles.fieldLabel, { color: p.textMuted }]}>{etiqueta}</Text>
      ) : null}
      <TextInput
        style={[
          styles.input,
          { backgroundColor: p.surface, borderColor: p.border, color: p.text },
          error && styles.inputError,
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
        <Text style={[styles.fieldHint, { color: p.textMuted }]}>{ayuda}</Text>
      ) : null}
      {mostrarLista && (
        <View style={[styles.suggestBox, { backgroundColor: p.surfaceList, borderColor: p.borderStrong }]}>
          <ScrollView keyboardShouldPersistTaps="always" nestedScrollEnabled style={styles.suggestScroll}>
            {opciones.slice(0, 8).map((opcion) => (
              <TouchableOpacity
                key={opcion}
                style={[styles.suggestRow, { borderBottomColor: p.border }]}
                onPress={() => {
                  onChange(opcion);
                  setAbierto(false);
                }}
                accessibilityRole="button"
              >
                <Text style={[styles.suggestText, { color: p.text }]}>{opcion}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: 6 },
  fieldLabel: {
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  input: {
    borderRadius: theme.radius.field,
    paddingHorizontal: 14,
    height: theme.control.height,
    borderWidth: 1.5,
    fontSize: 15,
  },
  inputError: { borderColor: colors.danger },
  fieldHint: { fontSize: 12, lineHeight: 16 },
  suggestBox: {
    marginTop: 4,
    borderRadius: theme.radius.field,
    borderWidth: 1,
    overflow: "hidden",
  },
  suggestScroll: { maxHeight: 220 },
  suggestRow: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
  },
  suggestText: { fontSize: 15, fontWeight: "500" },
});
