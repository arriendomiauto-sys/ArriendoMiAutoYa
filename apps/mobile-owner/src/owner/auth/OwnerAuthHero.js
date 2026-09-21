import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import Svg, { Defs, LinearGradient, Stop, Rect } from "react-native-svg";
import { theme, Icon, BrandLogo } from "@rentacar/mobile-shared";

// Logo propio de la app de dueño
const ownerLogo = require("../../../assets/logo.png");
const OWNER_LOGO_ZOOM = 1.33;

/**
 * Cabecera hero moderna, esbelta y compacta para la app de Dueño.
 * Sustituye la ola pesada por una barra visual limpia y estilizada.
 */
export function OwnerAuthHero({ variant = "compact", title, caption, onBack }) {
  const isFull = variant === "full";
  const height = isFull ? 115 : 58;

  return (
    <View style={{ height }} className="w-full relative overflow-hidden rounded-b-2xl shadow-sm">
      {/* Fondo degradado moderno: petróleo oscuro a esmeralda profundo */}
      <View className="absolute inset-0" pointerEvents="none">
        <Svg width="100%" height={height} preserveAspectRatio="none">
          <Defs>
            <LinearGradient id="ownerHeroGrad" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor="#0B2B28" />
              <Stop offset="0.6" stopColor="#0F3D3E" />
              <Stop offset="1" stopColor="#1B5657" />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height={height} fill="url(#ownerHeroGrad)" />
        </Svg>
      </View>

      {/* Variante compacta: barra horizontal limpia y moderna (58px) */}
      {!isFull ? (
        <View className="flex-1 flex-row items-center justify-between px-3.5">
          <View className="w-8 items-start justify-center">
            {onBack ? (
              <TouchableOpacity
                onPress={onBack}
                accessibilityRole="button"
                accessibilityLabel="Volver"
                hitSlop={theme.control.hitSlop}
                className="w-8 h-8 rounded-full bg-white/15 items-center justify-center active:opacity-70"
              >
                <Icon name="arrow-left" size={17} color="#FFFFFF" strokeWidth={2} />
              </TouchableOpacity>
            ) : null}
          </View>

          <View className="flex-row items-center gap-2">
            <BrandLogo size={30} source={ownerLogo} zoom={OWNER_LOGO_ZOOM} />
            <Text className="text-sm font-bold text-white tracking-tight">
              {title || "Arriendo Mi Auto Ya"}
            </Text>
            {caption ? (
              <View className="bg-[#2DD4BF]/20 px-2 py-0.5 rounded-full border border-[#2DD4BF]/30">
                <Text className="text-[9.5px] text-[#2DD4BF] font-extrabold tracking-wider uppercase">
                  {caption}
                </Text>
              </View>
            ) : null}
          </View>

          {/* Espacio para balancear el centro */}
          <View className="w-8" />
        </View>
      ) : (
        /* Variante full (Bienvenida): centrada y elegante (115px) */
        <View className="flex-1 items-center justify-center px-4 gap-1.5">
          <BrandLogo size={46} source={ownerLogo} zoom={OWNER_LOGO_ZOOM} />
          <Text className="text-base font-bold text-white tracking-tight">
            {title || "Arriendo Mi Auto Ya"}
          </Text>
          {caption ? (
            <View className="bg-[#2DD4BF]/20 px-2.5 py-0.5 rounded-full border border-[#2DD4BF]/30">
              <Text className="text-[10px] text-[#2DD4BF] font-extrabold tracking-wider uppercase">
                {caption}
              </Text>
            </View>
          ) : null}
        </View>
      )}
    </View>
  );
}
