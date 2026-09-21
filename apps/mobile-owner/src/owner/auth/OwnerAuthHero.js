import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import Svg, { Defs, LinearGradient, Stop, Path } from "react-native-svg";
import { colors, theme, Icon, BrandLogo } from "@rentacar/mobile-shared";

// Logo propio de la app de dueño (distinto del que trae `BrandLogo` por
// defecto, que es el de mobile-renter). El zoom compensa el ~12.5% de
// margen vacío que trae este PNG alrededor del isotipo — ver mismo cálculo
// en OwnerAuthFlow.js.
const ownerLogo = require("../../../assets/logo.png");
const OWNER_LOGO_ZOOM = 1.33;

/**
 * Cabecera hero de la app de dueño: degradado teal->menta (marca) cerrado por
 * una ola de una sola pieza. Usando NativeWind classes.
 */
const WAVE = {
  full: {
    // El punto más bajo de la ola (y=190) queda lejos de los 300px
    // originales del contenedor: esos ~110px de sobra quedaban en blanco
    // entre la ola y el contenido siguiente. Se recorta a 205 (190 + margen)
    // para que no quede espacio muerto antes del título de la pantalla.
    height: 205,
    path: "M0,0 L390,0 L390,190 C300,166 260,148 195,148 C130,148 90,166 0,172 Z",
  },
  compact: {
    height: 206,
    path: "M0,0 L390,0 L390,142 C300,120 260,104 195,104 C130,104 90,120 0,128 Z",
  },
};

export function OwnerAuthHero({ variant = "compact", title, caption, onBack }) {
  const { height, path } = WAVE[variant] || WAVE.compact;
  const logoSize = variant === "full" ? 76 : 56;

  return (
    <View style={{ height }}>
      <View className="absolute inset-0" pointerEvents="none">
        <Svg
          width="100%"
          height={height}
          viewBox={`0 0 390 ${height}`}
          preserveAspectRatio="none"
        >
          <Defs>
            <LinearGradient id="ownerHeroGrad" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={colors.primary800} />
              <Stop offset="0.5" stopColor={colors.primary600} />
              <Stop offset="1" stopColor={colors.accent500} />
            </LinearGradient>
          </Defs>
          <Path d={path} fill="url(#ownerHeroGrad)" />
        </Svg>
      </View>

      {onBack ? (
        <TouchableOpacity
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel="Volver"
          hitSlop={theme.control.hitSlop}
          className="absolute top-4 left-4 w-[38px] h-[38px] rounded-full bg-white/20 items-center justify-center z-10 active:opacity-75"
        >
          <Icon name="arrow-left" size={17} color={colors.textWhite} strokeWidth={1.9} />
        </TouchableOpacity>
      ) : null}

      <View
        className={`absolute left-0 right-0 top-0 items-center ${
          variant === "full" ? "pt-6 gap-2.5" : "pt-6 gap-2"
        }`}
      >
        <BrandLogo size={logoSize} source={ownerLogo} zoom={OWNER_LOGO_ZOOM} />
        <Text
          className={`font-bold text-white ${
            variant === "full" ? "text-[17px]" : "text-[15px]"
          }`}
        >
          {title || "Arriendo Mi Auto Ya"}
        </Text>
        {caption ? (
          <Text className="text-xs text-white/75 tracking-[0.5px] uppercase font-semibold">
            {caption}
          </Text>
        ) : null}
      </View>
    </View>
  );
}
