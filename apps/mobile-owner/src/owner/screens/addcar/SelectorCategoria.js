import React, { useMemo, useRef, useState } from "react";
import { View, Text, StyleSheet, PanResponder, TouchableOpacity } from "react-native";
import { colors, theme, Icon } from "@rentacar/mobile-shared";

const fmt = (n) => `$${Number(n || 0).toLocaleString("es-CL")}`;

/**
 * Slider de categoría: 5 topes discretos. Se puede arrastrar el tirador o
 * tocar una etiqueta. Arriba, la tarjeta de la categoría elegida con sus
 * ejemplos y su rango de tarifa.
 */
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
    // seleccionado se lee vía closure fresca en cada render de este memo
    [seleccionado, tipos]
  );

  const pos = total > 1 ? (indice / (total - 1)) * 100 : 0;

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <View style={styles.iconoWrap}>
          <Icon name={tipo.icon} size={22} color={colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.nombre}>{tipo.labelCorto}</Text>
          <Text style={styles.ejemplos} numberOfLines={1}>
            {tipo.ejemplos}
          </Text>
        </View>
      </View>

      <Text style={styles.descripcion}>{tipo.descripcion}</Text>

      <View style={styles.sliderZona} {...pan.panHandlers}>
        <View
          style={styles.track}
          onLayout={(e) => {
            anchoRef.current = e.nativeEvent.layout.width;
            setAncho(e.nativeEvent.layout.width);
          }}
        >
          <View style={[styles.fill, { width: `${pos}%` }]} />
          {ancho > 0 &&
            tipos.map((t, i) => (
              <View
                key={t.id}
                style={[styles.tick, { left: `${(i / (total - 1)) * 100}%` }, i <= indice && styles.tickOn]}
              />
            ))}
          <View style={[styles.thumb, { left: `${pos}%` }]} />
        </View>
      </View>

      <View style={styles.labels}>
        {tipos.map((t, i) => (
          <TouchableOpacity
            key={t.id}
            style={styles.labelBtn}
            onPress={() => onSelect(t.id)}
            hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
            accessibilityRole="button"
            accessibilityState={{ selected: t.id === seleccionado }}
          >
            <Text
              style={[
                styles.label,
                i === 0 && { textAlign: "left" },
                i === total - 1 && { textAlign: "right" },
                t.id === seleccionado && styles.labelOn,
              ]}
            >
              {t.labelCorto}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.rango}>
        <Text style={styles.rangoLabel}>Rango de la categoría</Text>
        <Text style={styles.rangoValor}>
          {fmt(tipo.min)} – {fmt(tipo.base)}
        </Text>
      </View>
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
  head: { flexDirection: "row", alignItems: "center", gap: theme.spacing.md },
  iconoWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.primary100,
    alignItems: "center",
    justifyContent: "center",
  },
  nombre: { fontSize: 18, fontWeight: "800", letterSpacing: -0.2, color: colors.text },
  ejemplos: { fontSize: 12, color: colors.textMuted, marginTop: 1 },
  descripcion: { fontSize: 13, color: colors.textMuted, lineHeight: 18 },
  sliderZona: { paddingVertical: 12, paddingHorizontal: 4 },
  track: { height: 8, borderRadius: 999, backgroundColor: colors.surfaceSecondary, justifyContent: "center" },
  fill: { position: "absolute", left: 0, top: 0, bottom: 0, borderRadius: 999, backgroundColor: colors.primary },
  tick: {
    position: "absolute",
    width: 4,
    height: 4,
    borderRadius: 2,
    marginLeft: -2,
    backgroundColor: colors.borderLight,
  },
  tickOn: { backgroundColor: "#FFFFFF" },
  thumb: {
    position: "absolute",
    width: 26,
    height: 26,
    borderRadius: 13,
    marginLeft: -13,
    backgroundColor: "#FFFFFF",
    borderWidth: 3,
    borderColor: colors.primary,
    ...theme.shadow.sm,
  },
  labels: { flexDirection: "row" },
  labelBtn: { flex: 1 },
  label: { fontSize: 10, color: colors.textPlaceholder, textAlign: "center" },
  labelOn: { color: colors.primary, fontWeight: "700" },
  rango: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: colors.surfaceSubtle,
    borderRadius: 10,
    paddingVertical: 8,
  },
  rangoLabel: { fontSize: 12, color: colors.textMuted },
  rangoValor: { fontSize: 12, fontWeight: "700", color: colors.primary },
});
