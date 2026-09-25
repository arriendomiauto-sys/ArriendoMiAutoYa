import React from "react";
import { View, Text } from "react-native";
import { colors } from "../../theme/colors";
import { Icon } from "../../components/Icon";

let Animated = null;
let ZoomIn = null;
let FadeInDown = null;
try {
  const reanimated = require("react-native-reanimated");
  Animated = reanimated.default || reanimated;
  ZoomIn = reanimated.ZoomIn;
  FadeInDown = reanimated.FadeInDown;
} catch {
  // react-native-reanimated no disponible en el binario nativo: sin animación.
}

/**
 * Cómo funciona el servicio, en cuatro pasos, para la bienvenida de la app de
 * arrendatario. Reemplaza al recuadro fijo "Quiero arrendar": en una app que
 * solo sirve para arrendar, elegir eso no decía nada, y esta es la pantalla
 * donde alguien decide si crea la cuenta.
 *
 * Cada paso es una ilustración armada con íconos (un ícono grande al centro y
 * dos "insignias" chicas alrededor), así no depende de imágenes ni videos que
 * haya que mantener aparte.
 */
export const PASOS_SERVICIO = [
  {
    id: "buscar",
    titulo: "Encuentra un auto cerca",
    texto: "Autos de personas de tu ciudad, por día o por semana, con el precio total a la vista.",
    icono: "search",
    fondo: colors.primary100,
    color: colors.primary,
    insignias: ["location", "car"],
  },
  {
    id: "verificar",
    titulo: "Verifica tu identidad una vez",
    texto: "Carnet, licencia y antecedentes. Lo revisamos para que las dos partes sepan con quién tratan.",
    icono: "shield",
    fondo: colors.accentMuted,
    color: colors.accent800,
    insignias: ["user", "document"],
  },
  {
    id: "reservar",
    titulo: "Reserva con garantía protegida",
    texto: "La garantía queda retenida en tu tarjeta, no se cobra, y se libera al devolver el auto.",
    icono: "card",
    fondo: colors.primary100,
    color: colors.primary,
    insignias: ["lock", "check"],
  },
  {
    id: "entregar",
    titulo: "Entrega 100% digital",
    texto: "Fotos del auto, contrato y firma en el celular. Todo queda registrado para los dos.",
    icono: "key",
    fondo: colors.accentMuted,
    color: colors.accent800,
    insignias: ["camera", "contract"],
  },
];

function Aparecer({ activo, animacion, style, children }) {
  // La animación corre cada vez que el paso pasa a estar a la vista: la `key`
  // cambia con `activo` y React vuelve a montar el Animated.View.
  if (!Animated || !animacion) return <View style={style}>{children}</View>;
  return (
    <Animated.View key={activo ? "on" : "off"} entering={activo ? animacion : undefined} style={style}>
      {children}
    </Animated.View>
  );
}

function Insignia({ icono, color, style }) {
  return (
    <View
      className="absolute w-12 h-12 rounded-2xl bg-surface items-center justify-center shadow-md"
      style={style}
    >
      <Icon name={icono} size={22} color={color} />
    </View>
  );
}

/** Una página del carrusel: ilustración arriba, título y texto abajo. */
export function PasoServicio({ paso, numero, activo }) {
  return (
    <View className="flex-1 gap-4">
      <View className="flex-1 rounded-3xl items-center justify-center" style={{ backgroundColor: paso.fondo }}>
        <Aparecer
          activo={activo}
          animacion={ZoomIn?.duration(380)}
          style={{ width: 150, height: 150, alignItems: "center", justifyContent: "center" }}
        >
          <View className="w-28 h-28 rounded-full bg-surface items-center justify-center">
            <Icon name={paso.icono} size={56} color={paso.color} strokeWidth={1.8} />
          </View>
        </Aparecer>
        <Aparecer
          activo={activo}
          animacion={FadeInDown?.delay(180).duration(320)}
          style={{ position: "absolute", width: 210, height: 170 }}
        >
          <Insignia icono={paso.insignias[0]} color={paso.color} style={{ left: 0, top: 8 }} />
          <Insignia icono={paso.insignias[1]} color={paso.color} style={{ right: 0, bottom: 8 }} />
        </Aparecer>
        <View className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-surface/80">
          <Text className="text-[11px] font-bold" style={{ color: paso.color }}>
            Paso {numero}
          </Text>
        </View>
      </View>
      <View className="gap-1.5">
        <Text className="text-lg font-bold text-gray-900">{paso.titulo}</Text>
        <Text className="text-sm leading-5 text-gray-500">{paso.texto}</Text>
      </View>
    </View>
  );
}
