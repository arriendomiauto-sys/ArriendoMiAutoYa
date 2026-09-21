import React from "react";
import { View, Text, StyleSheet } from "react-native";
import Svg, { Defs, LinearGradient, Stop, Rect } from "react-native-svg";
import { colors } from "../theme/colors";
import { detectarMarca } from "./FormularioTarjeta";

const NOMBRE_MARCA = { visa: "VISA", mastercard: "MASTERCARD", amex: "AMEX", diners: "DINERS", otra: "TARJETA" };

/** "4242 42" -> "4242 42•• •••• ••••": rellena hasta 16 dígitos en grupos de 4. */
function numeroConPuntos(numero) {
  const digitos = (numero || "").replace(/\D/g, "").slice(0, 16);
  return (digitos + "•".repeat(16)).slice(0, 16).replace(/(.{4})/g, "$1 ").trim();
}

/**
 * Tarjeta ilustrada que sigue lo que el usuario escribe en el formulario de
 * alta. Es solo visual: no guarda ni envía nada, y lo que muestra es lo mismo
 * que ya está en pantalla en los campos.
 */
export function VistaTarjeta({ numero, vencimiento, titular }) {
  const marca = detectarMarca(numero);
  return (
    <View style={styles.tarjeta} accessible accessibilityLabel="Vista previa de tu tarjeta">
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <Svg width="100%" height="100%">
          <Defs>
            <LinearGradient id="vistaTarjetaGrad" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={colors.primary800} />
              <Stop offset="0.6" stopColor={colors.primary600} />
              <Stop offset="1" stopColor={colors.accent600} />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#vistaTarjetaGrad)" />
        </Svg>
      </View>

      <View style={styles.fila}>
        <View style={styles.chip} />
        <Text style={styles.marca}>{NOMBRE_MARCA[marca]}</Text>
      </View>

      <Text style={styles.numero}>{numeroConPuntos(numero)}</Text>

      <View style={styles.fila}>
        <View style={styles.dato}>
          <Text style={styles.etiqueta}>Titular</Text>
          <Text style={styles.valor} numberOfLines={1}>
            {(titular || "").trim().toUpperCase() || "TU NOMBRE"}
          </Text>
        </View>
        <View style={[styles.dato, styles.datoDerecha]}>
          <Text style={styles.etiqueta}>Vence</Text>
          <Text style={styles.valor}>{vencimiento || "MM/AA"}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  tarjeta: {
    height: 156,
    borderRadius: 18,
    padding: 16,
    justifyContent: "space-between",
    overflow: "hidden",
    boxShadow: "0 10px 22px rgba(15, 61, 62, 0.28)",
    elevation: 6,
  },
  fila: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" },
  chip: { width: 34, height: 24, borderRadius: 6, backgroundColor: "#D9C27C" },
  marca: { color: colors.textWhite, fontSize: 12, fontWeight: "800", letterSpacing: 0.6 },
  numero: {
    color: colors.textWhite,
    fontSize: 18,
    letterSpacing: 1.2,
    fontVariant: ["tabular-nums"],
  },
  dato: { flexShrink: 1, gap: 1 },
  datoDerecha: { alignItems: "flex-end", flexShrink: 0, marginLeft: 12 },
  etiqueta: { color: "rgba(255,255,255,0.65)", fontSize: 9, letterSpacing: 1, textTransform: "uppercase" },
  valor: { color: colors.textWhite, fontSize: 11.5, fontWeight: "600" },
});
