import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { colors, theme, Icon, PASO_PRECIO_CLP } from "@rentacar/mobile-shared";

const fmt = (n) => `$${Number(n || 0).toLocaleString("es-CL")}`;

/**
 * Control de tarifa: el dueño parte del precio `base` que fija RentACar y
 * solo puede bajarlo, de $5.000 en $5.000, hasta el piso `min` de su
 * categoría. Sin campo de texto libre: stepper + píldoras con montos
 * cerrados. Debajo, cuánto recibe con el desglose de IVA y comisión.
 */
export function ControlTarifa({ tipo, valor, desglose, onAjustar, onFijar }) {
  const enPiso = valor <= tipo.min;
  const enTope = valor >= tipo.base;
  const conDescuento = valor < tipo.base;

  return (
    <>
      <View style={styles.card}>
        <View style={styles.cabecera}>
          <Text style={styles.cabeceraLabel}>Precio de tu categoría</Text>
          <View style={styles.candado}>
            <Icon name="lock" size={11} color={colors.textMuted} />
            <Text style={styles.candadoText}>Fijado por RentACar</Text>
          </View>
        </View>
        <Text style={[styles.base, conDescuento && styles.baseTachado]}>{fmt(tipo.base)}</Text>

        <View style={styles.divisor} />

        <Text style={styles.tuTarifaLabel}>Tu tarifa por día</Text>

        <View style={styles.stepper}>
          <TouchableOpacity
            style={[styles.stepBtn, enPiso && styles.stepBtnOff]}
            onPress={() => onAjustar(-PASO_PRECIO_CLP)}
            disabled={enPiso}
            accessibilityRole="button"
            accessibilityLabel="Bajar la tarifa cinco mil pesos"
            accessibilityState={{ disabled: enPiso }}
          >
            <Icon name="minus" size={20} color={enPiso ? colors.textPlaceholder : colors.primary} />
          </TouchableOpacity>

          <View style={styles.montoWrap}>
            <Text style={styles.monto}>{fmt(valor)}</Text>
          </View>

          <TouchableOpacity
            style={[styles.stepBtn, enTope && styles.stepBtnOff]}
            onPress={() => onAjustar(PASO_PRECIO_CLP)}
            disabled={enTope}
            accessibilityRole="button"
            accessibilityLabel="Subir la tarifa cinco mil pesos"
            accessibilityState={{ disabled: enTope }}
          >
            <Icon name="plus" size={20} color={enTope ? colors.textPlaceholder : colors.primary} />
          </TouchableOpacity>
        </View>

        <View style={styles.pills}>
          {tipo.escalones.map((precio) => {
            const activo = precio === valor;
            return (
              <TouchableOpacity
                key={precio}
                style={[styles.pill, activo && styles.pillOn]}
                onPress={() => onFijar(precio)}
                accessibilityRole="button"
                accessibilityState={{ selected: activo }}
              >
                <Text style={[styles.pillText, activo && styles.pillTextOn]}>{fmt(precio)}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.tip}>
          <Icon name="star" size={13} color={colors.accent} fill={colors.accent} />
          <Text style={styles.tipText}>
            Bajar tu tarifa te posiciona más arriba en las búsquedas y llena más días.
          </Text>
        </View>
      </View>

      <View style={styles.card}>
        <View style={styles.recibeFila}>
          <View style={{ flex: 1 }}>
            <Text style={styles.recibeLabel}>Recibes por día (80%)</Text>
            <Text style={styles.recibeMonto}>{fmt(desglose.gananciaDueno)}</Text>
          </View>
          <View style={styles.ivaBadge}>
            <Text style={styles.ivaBadgeText}>IVA 19% incl.</Text>
          </View>
        </View>
        <View style={styles.divisor} />
        <Fila k="Tarifa al cliente" v={fmt(desglose.tarifaBruta)} fuerte />
        <Fila k="Valor neto" v={fmt(desglose.subtotalNeto)} />
        <Fila k="IVA (19%)" v={fmt(desglose.ivaMonto)} />
        <Fila k="Comisión plataforma (20%)" v={`-${fmt(desglose.comisionPlataforma)}`} />
        <Text style={styles.recibeNota}>
          La plataforma retiene 20% por seguro, verificación de identidad y soporte 24/7.
        </Text>
      </View>
    </>
  );
}

function Fila({ k, v, fuerte }) {
  return (
    <View style={styles.fila}>
      <Text style={[styles.filaK, fuerte && styles.filaFuerte]}>{k}</Text>
      <Text style={[styles.filaV, fuerte && styles.filaFuerte]}>{v}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: theme.radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
    ...theme.shadow.sm,
  },
  cabecera: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  cabeceraLabel: { fontSize: 13, color: colors.textMuted },
  candado: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: 999,
    paddingVertical: 4,
    paddingHorizontal: 9,
  },
  candadoText: { fontSize: 11, fontWeight: "700", color: colors.textMuted },
  base: { fontSize: 16, fontWeight: "700", color: colors.textPlaceholder },
  baseTachado: { textDecorationLine: "line-through" },
  divisor: { height: 1, backgroundColor: colors.border },
  tuTarifaLabel: {
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.4,
    textTransform: "uppercase",
    color: colors.textMuted,
  },
  stepper: { flexDirection: "row", alignItems: "center", gap: theme.spacing.md },
  stepBtn: {
    width: 52,
    height: 52,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.primary200,
    backgroundColor: colors.primary100,
    alignItems: "center",
    justifyContent: "center",
  },
  stepBtnOff: { borderColor: colors.border, backgroundColor: colors.surfaceSecondary },
  montoWrap: { flex: 1, alignItems: "center" },
  monto: { fontSize: 30, fontWeight: "800", letterSpacing: -0.8, color: colors.primary },
  pills: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  pill: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  pillOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  pillText: { fontSize: 13, fontWeight: "600", color: colors.textMuted },
  pillTextOn: { color: "#FFFFFF" },
  tip: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    backgroundColor: colors.accent100,
    borderRadius: 10,
    padding: 10,
  },
  tipText: { flex: 1, fontSize: 12, color: colors.accentDark, lineHeight: 17 },
  recibeFila: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  recibeLabel: {
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.4,
    textTransform: "uppercase",
    color: colors.textMuted,
  },
  recibeMonto: { fontSize: 26, fontWeight: "800", letterSpacing: -0.5, color: colors.accentDark, marginTop: 2 },
  ivaBadge: {
    backgroundColor: colors.accent100,
    borderWidth: 1,
    borderColor: colors.successBorder,
    borderRadius: 6,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  ivaBadgeText: { fontSize: 10, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5, color: colors.accentText },
  fila: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 1 },
  filaK: { fontSize: 11, color: colors.textMuted },
  filaV: { fontSize: 11, color: colors.textMuted },
  filaFuerte: { fontSize: 12, fontWeight: "700", color: colors.text },
  recibeNota: { fontSize: 11, color: colors.textPlaceholder, lineHeight: 15, marginTop: 4 },
});
