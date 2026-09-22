import React, { useEffect, useRef } from "react";
import { View, Text, TouchableOpacity, Animated } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "../theme/colors";
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
    <View className="absolute -top-1.5 -right-2.5 min-w-[17px] h-[17px] rounded-full px-1 bg-danger items-center justify-center">
      <Text className="text-[10px] font-bold text-white" allowFontScaling={false}>
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
      className="items-center gap-1 min-w-[60px] min-h-[48px] px-0.5"
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
        className={`text-[11px] ${activa ? "font-bold" : ""}`}
        style={{ color: activa ? colors.primary : apagado }}
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
    <View className="items-center gap-1 min-w-[60px] -mt-6">
      <Animated.View style={{ transform: [{ scale: escala }] }}>
        <TouchableOpacity
          onPress={accion.onPress}
          onPressIn={onPressIn}
          onPressOut={onPressOut}
          activeOpacity={0.9}
          accessibilityRole="button"
          accessibilityLabel={accion.label || "Agregar"}
          className="w-[58px] h-[58px] rounded-full bg-primary-900 items-center justify-center border-4 shadow-lg"
          style={{ borderColor: fondo }}
        >
          <Icon name={accion.icon || "plus"} size={28} color="#FFFFFF" strokeWidth={2.4} />
        </TouchableOpacity>
      </Animated.View>
      {accion.label ? <Text className="text-[11px] font-bold text-primary">{accion.label}</Text> : null}
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
      className={`border-t flex-row justify-around items-start pt-2.5 ${oscuro ? "bg-darkCard border-darkBorder" : "bg-surface border-border"}`}
      style={{ paddingBottom: Math.max(insets.bottom, 12) }}
      accessibilityRole="tablist"
    >
      {contenido}
    </View>
  );
}
