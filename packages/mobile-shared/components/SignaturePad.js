import React, { useRef, useState } from "react";
import { View, StyleSheet, PanResponder, Text, TouchableOpacity } from "react-native";
import Svg, { Path } from "react-native-svg";
import { colors } from "../theme/colors";
import { theme } from "../theme/tokens";

/**
 * Pad de firma dibujada con el dedo, en SVG puro (react-native-svg, ya
 * bundleado en Expo Go — no hace falta una librería de captura de pantalla
 * ni un rebuild nativo). Guarda el trazo como un `d` de SVG, no como
 * imagen: es liviano y perfectamente reproducible en el PDF del contrato
 * más adelante si hace falta.
 */
export function SignaturePad({ onChange, height = 180 }) {
  const [trazos, setTrazos] = useState([]); // Array<Array<{x,y}>>
  const trazoActual = useRef([]);

  const emitir = (siguientes) => {
    setTrazos(siguientes);
    const vacio = siguientes.length === 0 || siguientes.every((t) => t.length < 2);
    onChange && onChange(vacio ? null : aPathD(siguientes));
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        trazoActual.current = [{ x: evt.nativeEvent.locationX, y: evt.nativeEvent.locationY }];
        setTrazos((prev) => [...prev, trazoActual.current]);
      },
      onPanResponderMove: (evt) => {
        trazoActual.current = [
          ...trazoActual.current,
          { x: evt.nativeEvent.locationX, y: evt.nativeEvent.locationY },
        ];
        // Redibuja en vivo: se ve el trazo mientras se dibuja, no recién al soltar.
        setTrazos((prev) => [...prev.slice(0, -1), trazoActual.current]);
      },
      onPanResponderRelease: () => {
        setTrazos((prev) => {
          const siguientes = [...prev.slice(0, -1), trazoActual.current];
          const vacio = siguientes.every((t) => t.length < 2);
          onChange && onChange(vacio ? null : aPathD(siguientes));
          return siguientes;
        });
      },
    })
  ).current;

  const limpiar = () => {
    trazoActual.current = [];
    emitir([]);
  };

  const vacio = trazos.length === 0 || trazos.every((t) => t.length < 2);

  return (
    <View style={styles.wrap}>
      <View style={[styles.canvas, { height }]} {...panResponder.panHandlers}>
        {vacio && <Text style={styles.placeholder}>Firma aquí con el dedo</Text>}
        <Svg style={StyleSheet.absoluteFill}>
          {trazos.map(
            (t, i) =>
              t.length > 1 && (
                <Path key={i} d={trazoAPathD(t)} stroke={colors.text} strokeWidth={2.5} fill="none" />
              )
          )}
        </Svg>
      </View>
      <TouchableOpacity onPress={limpiar} style={styles.clearBtn} disabled={vacio}>
        <Text style={[styles.clearText, vacio && styles.clearTextDisabled]}>Borrar y firmar de nuevo</Text>
      </TouchableOpacity>
    </View>
  );
}

function trazoAPathD(trazo) {
  return trazo
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(" ");
}

function aPathD(trazos) {
  return trazos
    .filter((t) => t.length > 1)
    .map(trazoAPathD)
    .join(" ");
}

const styles = StyleSheet.create({
  wrap: { gap: theme.spacing.sm },
  canvas: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderStyle: "dashed",
    borderRadius: theme.radius.field,
    backgroundColor: colors.surface,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  placeholder: { fontSize: 14, color: colors.textMuted },
  clearBtn: { alignSelf: "center", padding: 6 },
  clearText: { fontSize: 13, fontWeight: "600", color: colors.primary },
  clearTextDisabled: { color: colors.textMuted },
});
