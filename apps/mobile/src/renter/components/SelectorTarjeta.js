import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { colors, theme, Icon } from "@rentacar/mobile-shared";

const MARCA_LABEL = { visa: "Visa", mastercard: "Mastercard", amex: "American Express", diners: "Diners" };

/**
 * Lista de radio para elegir una tarjeta en el checkout. Se usa dos veces:
 * una para el cobro del arriendo (tarjetas de débito) y otra para el hold de
 * garantía (tarjetas de crédito).
 *
 * @param tarjetas       lista ya filtrada por tipo (validadas)
 * @param seleccionadaId id elegido
 * @param onSeleccionar  (id) => void
 * @param onAgregar      () => void  — abre el alta de tarjeta
 * @param error          texto de error inline (SIN_CUPO / COBRO_RECHAZADO)
 * @param tipoVacio      "débito" | "crédito"  — para el copy del estado vacío
 */
export function SelectorTarjeta({
  titulo,
  subtitulo,
  tarjetas,
  seleccionadaId,
  onSeleccionar,
  onAgregar,
  error,
  tipoVacio,
}) {
  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <Text style={styles.titulo}>{titulo}</Text>
        {subtitulo ? <Text style={styles.subtitulo}>{subtitulo}</Text> : null}
      </View>

      {tarjetas.length === 0 ? (
        <TouchableOpacity style={styles.vacio} onPress={onAgregar} activeOpacity={0.85}>
          <Icon name="plus" size={16} color={colors.primary} />
          <Text style={styles.vacioTexto}>Agrega una tarjeta de {tipoVacio}</Text>
        </TouchableOpacity>
      ) : (
        <View style={[styles.lista, error && styles.listaError]}>
          {tarjetas.map((t, idx) => {
            const activa = t.id === seleccionadaId;
            return (
              <TouchableOpacity
                key={t.id}
                testID={`tarjeta-${tipoVacio === "crédito" ? "credito" : "debito"}-${idx}`}
                style={styles.fila}
                onPress={() => onSeleccionar(t.id)}
                activeOpacity={0.8}
                accessibilityRole="radio"
                accessibilityState={{ selected: activa }}
              >
                <Icon name="card" size={18} color={activa ? colors.primary : colors.textMuted} />
                <Text style={styles.filaTexto}>
                  {MARCA_LABEL[t.marca] || "Tarjeta"} ·{" "}
                  <Text style={styles.filaDigitos}>•••• {t.ultimos4}</Text>
                </Text>
                <View style={[styles.radio, activa && styles.radioOn]}>
                  {activa ? <View style={styles.radioDot} /> : null}
                </View>
              </TouchableOpacity>
            );
          })}
          <TouchableOpacity style={styles.otra} onPress={onAgregar} activeOpacity={0.7}>
            <Icon name="plus" size={14} color={colors.primary} />
            <Text style={styles.otraTexto}>Usar otra tarjeta</Text>
          </TouchableOpacity>
        </View>
      )}

      {error ? (
        <View style={styles.errorRow}>
          <Icon name="alert" size={14} color={colors.dangerText} />
          <Text style={styles.errorTexto}>{error}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: theme.spacing.sm },
  head: { gap: 2 },
  titulo: { fontSize: 13, fontWeight: "700", color: colors.textMuted, letterSpacing: 0.3 },
  subtitulo: { fontSize: 12, color: colors.textMuted, lineHeight: 16 },
  vacio: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: colors.border,
    borderRadius: theme.radius.field,
    padding: theme.spacing.md,
  },
  vacioTexto: { fontSize: 14, fontWeight: "600", color: colors.primary },
  lista: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: theme.radius.field,
    overflow: "hidden",
    backgroundColor: colors.surface,
  },
  listaError: { borderColor: colors.danger },
  fila: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  filaTexto: { flex: 1, fontSize: 14, color: colors.text, fontWeight: "500" },
  filaDigitos: { fontVariant: ["tabular-nums"] },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  radioOn: { borderColor: colors.primary },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary },
  otra: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
  },
  otraTexto: { fontSize: 13, fontWeight: "600", color: colors.primary },
  errorRow: { flexDirection: "row", alignItems: "flex-start", gap: 6 },
  errorTexto: { flex: 1, fontSize: 12.5, color: colors.dangerText, lineHeight: 17 },
});
