import React, { useEffect, useRef } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Animated } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "../theme/colors";
import { theme } from "../theme/tokens";
import { Icon } from "./Icon";

/**
 * Barra de navegación inferior, compartida por dueño y arrendatario.
 *
 * Antes cada app repetía ~120 líneas de JSX casi idénticas, y cualquier
 * arreglo había que hacerlo dos veces. Peor: el globo rojo de "Mensajes"
 * estaba pintado a mano, sin condición, así que se veía encendido siempre.
 * Un aviso que nunca se apaga deja de ser un aviso — la gente aprende a
 * ignorarlo y también se pierde el mensaje que sí importaba. Acá el globo
 * muestra un número real y desaparece en cero.
 */

const MAXIMO_VISIBLE = 9;

function Globo({ cantidad }) {
  if (!cantidad || cantidad < 1) return null;
  const texto = cantidad > MAXIMO_VISIBLE ? `${MAXIMO_VISIBLE}+` : String(cantidad);
  return (
    <View style={styles.globo}>
      <Text style={styles.globoTexto} allowFontScaling={false}>
        {texto}
      </Text>
    </View>
  );
}

function Item({ tab, activa, apagado, onPress }) {
  const conAviso = tab.badge > 0;
  // El lector de pantalla anuncia el pendiente junto al nombre: sin esto, el
  // globo es información que solo existe para quien ve.
  const etiqueta = conAviso ? `${tab.label}, ${tab.badge} sin leer` : tab.label;

  // Un salto de tamaño (no solo el cambio de color) es lo que hace que el
  // dedo "sienta" que la pestaña respondió, en vez de que el color cambiara
  // solo porque sí. Sube y vuelve a bajar; no se queda agrandado.
  const escala = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!activa) return;
    escala.setValue(0.8);
    Animated.spring(escala, { toValue: 1, useNativeDriver: true, speed: 20, bounciness: 10 }).start();
  }, [activa, escala]);

  return (
    <TouchableOpacity
      style={styles.item}
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole="tab"
      accessibilityLabel={etiqueta}
      accessibilityState={{ selected: activa }}
      hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
    >
      <Animated.View style={{ transform: [{ scale: escala }] }}>
        <Icon name={tab.icon} size={24} color={activa ? colors.primary : apagado} />
        <Globo cantidad={tab.badge} />
      </Animated.View>
      <Text
        style={[styles.etiqueta, { color: activa ? colors.primary : apagado }, activa && styles.etiquetaActiva]}
        numberOfLines={1}
      >
        {tab.label}
      </Text>
    </TouchableOpacity>
  );
}

export function TabBar({ tabs, activeTab, onChange, tone = "light" }) {
  const insets = useSafeAreaInsets();
  const oscuro = tone === "dark";

  const c = {
    fondo: oscuro ? colors.darkCard : colors.surface,
    borde: oscuro ? colors.darkBorder : colors.border,
    apagado: oscuro ? colors.textSilver : colors.textMuted,
  };

  return (
    <View
      style={[
        styles.barra,
        { backgroundColor: c.fondo, borderTopColor: c.borde, paddingBottom: Math.max(insets.bottom, 12) },
      ]}
      accessibilityRole="tablist"
    >
      {tabs.map((tab) => (
        <Item
          key={tab.id}
          tab={tab}
          activa={tab.id === activeTab}
          apagado={c.apagado}
          onPress={() => onChange(tab.id)}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  barra: {
    borderTopWidth: 1,
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    paddingTop: 10,
  },
  // 48 de alto es el mínimo cómodo para tocar sin apuntar. Antes el área
  // efectiva era la del icono más su texto y quedaba corta.
  item: { alignItems: "center", gap: 4, minWidth: 60, minHeight: 48, paddingHorizontal: 2 },
  etiqueta: { fontSize: 11 },
  etiquetaActiva: { fontWeight: "700" },
  globo: {
    position: "absolute",
    top: -6,
    right: -10,
    minWidth: 17,
    height: 17,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: colors.danger,
    alignItems: "center",
    justifyContent: "center",
  },
  globoTexto: { fontSize: 10, fontWeight: "700", color: "#FFFFFF" },
});
