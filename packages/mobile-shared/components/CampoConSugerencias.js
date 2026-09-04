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
 * Tono oscuro fijo: hoy solo se usa en pantallas del dueño (fondo oscuro).
 * Si el día de mañana hace falta en una pantalla clara, se le agrega un
 * prop `tone` en vez de duplicar el componente.
 */
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
}) {
  const [abierto, setAbierto] = useState(false);
  const opciones = buscar(valor);
  const yaEsExacta =
    opciones.length === 1 && opciones[0].toLowerCase() === (valor || "").trim().toLowerCase();
  const mostrarLista = abierto && opciones.length > 0 && !yaEsExacta;

  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{etiqueta}</Text>
      <TextInput
        style={[styles.input, error && styles.inputError]}
        placeholder={placeholder}
        placeholderTextColor={colors.textSilver}
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
      {ayuda && !error ? <Text style={styles.fieldHint}>{ayuda}</Text> : null}
      {mostrarLista && (
        <View style={styles.suggestBox}>
          <ScrollView keyboardShouldPersistTaps="always" nestedScrollEnabled style={styles.suggestScroll}>
            {opciones.slice(0, 8).map((opcion) => (
              <TouchableOpacity
                key={opcion}
                style={styles.suggestRow}
                onPress={() => {
                  onChange(opcion);
                  setAbierto(false);
                }}
                accessibilityRole="button"
              >
                <Text style={styles.suggestText}>{opcion}</Text>
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
    color: colors.textSilver,
    textTransform: "uppercase",
  },
  input: {
    backgroundColor: colors.darkCardSubtle,
    borderRadius: theme.radius.field,
    paddingHorizontal: 14,
    height: theme.control.height,
    borderWidth: 1,
    borderColor: colors.darkBorder,
    fontSize: 15,
    color: colors.textWhite,
  },
  inputError: { borderColor: colors.danger },
  fieldHint: { fontSize: 12, lineHeight: 16, color: colors.textSilver },
  suggestBox: {
    marginTop: 4,
    backgroundColor: colors.darkCard,
    borderRadius: theme.radius.field,
    borderWidth: 1,
    borderColor: colors.darkBorderStrong,
    overflow: "hidden",
  },
  suggestScroll: { maxHeight: 220 },
  suggestRow: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.darkBorder,
  },
  suggestText: { color: colors.textWhite, fontSize: 15, fontWeight: "500" },
});
