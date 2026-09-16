import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { colors, theme } from "@rentacar/mobile-shared";

/**
 * Piezas visuales compartidas por los 4 pasos del asistente de publicación.
 * El asistente vive en tono claro: fondo crema, tarjetas blancas, el teal de
 * marca solo para acentos y secciones chicas.
 */

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

/**
 * Mensaje de error bajo un campo. Lleva rol de alerta para que un lector de
 * pantalla lo anuncie en vez de dejarlo solo en el color rojo.
 */
export function MensajeError({ texto }) {
  if (!texto) return null;
  return (
    <Text style={comun.mensajeError} accessibilityRole="alert">
      {texto}
    </Text>
  );
}

export function Tarjeta({ children, style }) {
  return <View style={[comun.card, style]}>{children}</View>;
}

export function TituloPaso({ titulo, bajada }) {
  return (
    <View style={comun.tituloWrap}>
      <Text style={comun.titulo}>{titulo}</Text>
      {bajada ? <Text style={comun.bajada}>{bajada}</Text> : null}
    </View>
  );
}

export function BarraProgreso({ hechos, total, etiqueta }) {
  const pct = total > 0 ? Math.round((hechos / total) * 100) : 0;
  return (
    <View style={comun.progresoWrap}>
      <View style={comun.progresoFila}>
        <Text style={comun.progresoFuerte}>{`${hechos} de ${total} ${etiqueta}`}</Text>
        {hechos < total ? (
          <Text style={comun.progresoSuave}>{`Faltan ${total - hechos}`}</Text>
        ) : (
          <Text style={comun.progresoOk}>Listo</Text>
        )}
      </View>
      <View style={comun.progresoTrack}>
        <View style={[comun.progresoFill, { width: `${Math.max(pct, hechos > 0 ? 6 : 0)}%` }]} />
      </View>
    </View>
  );
}

export const comun = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: theme.radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
    ...theme.shadow.sm,
  },
  tituloWrap: { gap: 4 },
  titulo: { fontSize: 24, fontWeight: "800", letterSpacing: -0.5, lineHeight: 30, color: colors.text },
  bajada: { fontSize: 14, color: colors.textMuted, lineHeight: 20 },
  fieldLabel: {
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.4,
    textTransform: "uppercase",
    color: colors.textMuted,
  },
  input: {
    backgroundColor: colors.surface,
    borderRadius: theme.radius.field,
    paddingHorizontal: 14,
    height: theme.control.height,
    borderWidth: 1.5,
    borderColor: colors.border,
    fontSize: 15,
    color: colors.text,
  },
  inputError: { borderColor: colors.danger },
  mensajeError: { color: colors.danger, fontSize: 12, lineHeight: 17, marginTop: 6 },
  cardTitle: { fontSize: 15, fontWeight: "700", color: colors.text },
  chipsRow: { flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.sm },
  field: { gap: 6 },
  row: { flexDirection: "row", gap: theme.spacing.md },
  progresoWrap: { gap: 8 },
  progresoFila: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  progresoFuerte: { fontSize: 13, fontWeight: "700", color: colors.primary },
  progresoSuave: { fontSize: 13, color: colors.textMuted },
  progresoOk: { fontSize: 13, fontWeight: "700", color: colors.success },
  progresoTrack: { height: 6, borderRadius: 3, backgroundColor: colors.surfaceSecondary, overflow: "hidden" },
  progresoFill: { height: "100%", borderRadius: 3, backgroundColor: colors.accent },
});
