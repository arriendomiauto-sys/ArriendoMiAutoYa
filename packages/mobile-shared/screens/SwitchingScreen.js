import React, { useEffect, useRef } from "react";
import { View, Text, ActivityIndicator, Animated } from "react-native";
import { colors } from "../theme/colors";
import { BrandLogo } from "../components/BrandLogo";
import { SuccessCheck } from "../components/SuccessCheck";

/**
 * Pantalla de transición. Se muestra mientras la app cambia de contexto y el
 * árbol de la experiencia destino todavía se está montando:
 *
 *   - cambio de rol (arrendatario ⇄ dueño) desde el perfil,
 *   - inicio y cierre de sesión (cambio de cuenta),
 *   - rehidratación de la sesión al abrir la app.
 *
 * Sin esto el cambio de modo desmontaba RenterApp y montaba OwnerApp en el
 * mismo frame: se veía un parpadeo de claro a oscuro con las pantallas a
 * medio pintar. Con `overlay` se dibuja encima del árbol nuevo, que así puede
 * montarse tapado y aparecer ya completo.
 *
 * Los dos modos comparten la misma base clara, así que la transición es
 * siempre clara (antes el destino "dueño" entraba en oscuro).
 */
export function SwitchingScreen({
  mode = "renter",
  title = "Un momento…",
  subtitle,
  overlay = false,
  exito = false,
}) {
  // Entra con un fundido corto. El título cambia (rol, cuenta, sesión) sin
  // que la pantalla se desmonte, así que también sirve como transición
  // suave entre un mensaje y el siguiente en vez de un corte seco de texto.
  const entrada = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    entrada.setValue(0);
    Animated.timing(entrada, { toValue: 1, duration: 350, useNativeDriver: true }).start();
  }, [entrada, title]);

  const contenido = (
    <Animated.View
      className="flex-1 items-center justify-center gap-6 px-8 bg-background"
      style={{ opacity: entrada }}
      accessibilityRole="progressbar"
      accessibilityLabel={title}
    >
      {/* `exito`: las credenciales ya se aceptaron; el check reemplaza al logo mientras carga el perfil. */}
      {exito ? <SuccessCheck size={80} iconSize={40} /> : <BrandLogo size={80} />}
      <View className="items-center gap-1.5">
        <Text className="text-xl font-bold text-text text-center">{title}</Text>
        {subtitle ? <Text className="text-sm leading-5 text-textMuted text-center">{subtitle}</Text> : null}
      </View>
      <ActivityIndicator size="small" color={colors.primary} />
    </Animated.View>
  );

  // `position:absolute` va en un envoltorio APARTE del que tiene `flex:1` +
  // la opacidad animada — mezclarlos en el mismo array de estilos dejaba,
  // en algunos builds de Android, la transición partiendo el alto en dos
  // con su hermano en vez de taparlo entero (se veía la pantalla de atrás
  // arriba y esto abajo). `elevation` es lo que de verdad decide el orden
  // de apilado en Android entre hermanos absolutos — el orden de render
  // solo alcanza en iOS.
  if (!overlay) return contenido;
  return (
    <View
      className="absolute inset-0 z-[999] [elevation:999]"
      style={{ position: "absolute", top: 0, bottom: 0, left: 0, right: 0, elevation: 999, zIndex: 999 }}
      pointerEvents="auto"
    >
      {contenido}
    </View>
  );
}
