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
 *
 * `centerAction` (opcional): botón redondo elevado al centro, para la acción
 * principal de esa app (el dueño lo usa para "Publicar un auto"). Es
 * `{ icon, label, onPress }`. Si no se pasa, la barra se ve como siempre.
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
      testID={`tab-${tab.id}`}
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

function BotonCentral({ accion, fondo }) {
  const escala = useRef(new Animated.Value(1)).current;
  const onPressIn = () =>
    Animated.spring(escala, { toValue: 0.9, useNativeDriver: true, speed: 50, bounciness: 0 }).start();
  const onPressOut = () =>
    Animated.spring(escala, { toValue: 1, useNativeDriver: true, speed: 30, bounciness: 8 }).start();

  return (
    <View style={styles.centro}>
      <Animated.View style={{ transform: [{ scale: escala }] }}>
        <TouchableOpacity
          onPress={accion.onPress}
          onPressIn={onPressIn}
          onPressOut={onPressOut}
          activeOpacity={0.9}
          accessibilityRole="button"
          accessibilityLabel={accion.label || "Agregar"}
          style={[styles.fab, { borderColor: fondo }]}
        >
          <Icon name={accion.icon || "plus"} size={28} color="#FFFFFF" strokeWidth={2.4} />
        </TouchableOpacity>
      </Animated.View>
      {accion.label ? <Text style={styles.centroLabel}>{accion.label}</Text> : null}
    </View>
  );
}

export function TabBar({ tabs, activeTab, onChange, tone = "light", centerAction }) {
  const insets = useSafeAreaInsets();
  const oscuro = tone === "dark";

  const c = {
    fondo: oscuro ? colors.darkCard : colors.surface,
    borde: oscuro ? colors.darkBorder : colors.border,
    apagado: oscuro ? colors.textSilver : colors.textMuted,
  };

  const renderItem = (tab) => (
    <Item
      key={tab.id}
      tab={tab}
      activa={tab.id === activeTab}
      apagado={c.apagado}
      onPress={() => onChange(tab.id)}
    />
  );

  let contenido;
  if (centerAction) {
    // 4 tabs → 2 + botón + 2. El botón sobresale de la barra.
    const mitad = Math.ceil(tabs.length / 2);
    contenido = (
      <>
        {tabs.slice(0, mitad).map(renderItem)}
        <BotonCentral accion={centerAction} fondo={c.fondo} />
        {tabs.slice(mitad).map(renderItem)}
      </>
    );
  } else {
    contenido = tabs.map(renderItem);
  }

  return (
    <View
      style={[
        styles.barra,
        { backgroundColor: c.fondo, borderTopColor: c.borde, paddingBottom: Math.max(insets.bottom, 12) },
      ]}
      accessibilityRole="tablist"
    >
      {contenido}
    </View>
  );
}

const styles = StyleSheet.create({
  barra: {
    borderTopWidth: 1,
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "flex-start",
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
  centro: { alignItems: "center", gap: 4, minWidth: 60, marginTop: -24 },
  fab: {
    width: 58,
    height: 58,
    borderRadius: 29,
    // Acento premium del dueño: teal casi negro (el renter no usa centerAction).
    backgroundColor: colors.primary900,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 4,
    ...theme.shadow.lg,
  },
  centroLabel: { fontSize: 11, fontWeight: "700", color: colors.primary },
});
