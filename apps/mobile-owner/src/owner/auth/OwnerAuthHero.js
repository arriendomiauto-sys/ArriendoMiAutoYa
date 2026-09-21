import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import Svg, { Defs, LinearGradient, Stop, Rect } from "react-native-svg";
import { theme, Icon, BrandLogo } from "@rentacar/mobile-shared";

// Logo propio de la app de dueño
const ownerLogo = require("../../../assets/logo.png");
const OWNER_LOGO_ZOOM = 1.33;

/**
 * Cabecera hero esbelta de la app de Dueño.
 * Elimina la ola invasiva y optimiza el espacio vertical al 100%.
 * Variantes:
 * - "compact": barra esbelta de 58px con degradado premium esmeralda/petróleo.
 * - "full": cabecera centrada de 96px para bienvenida.
 */
export function OwnerAuthHero({
  variant = "compact",
  title = "Arriendo Mi Auto Ya",
  caption = "PARA DUEÑOS",
  onBack,
  pasoLabel,
}) {
  const isFull = variant === "full";
  const height = isFull ? 96 : 58;

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

      {/* Contenido */}
      {!isFull ? (
        <View className="flex-1 flex-row items-center justify-between px-3.5">
          {/* Botón Volver a la izquierda */}
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

          {/* Logo y Marca centrados */}
          <View className="flex-row items-center gap-2">
            <BrandLogo size={28} source={ownerLogo} zoom={OWNER_LOGO_ZOOM} />
            <Text className="text-sm font-bold text-white tracking-tight">
              {title}
            </Text>
            {caption ? (
              <View className="bg-[#2DD4BF]/20 px-2 py-0.5 rounded-full border border-[#2DD4BF]/30">
                <Text className="text-[9.5px] text-[#2DD4BF] font-extrabold tracking-wider uppercase">
                  {caption}
                </Text>
              </View>
            ) : null}
          </View>

          {/* Indicador de paso o balance a la derecha */}
          <View className="w-12 items-end justify-center">
            {pasoLabel ? (
              <Text className="text-xs font-semibold text-white/90">
                {pasoLabel}
              </Text>
            ) : null}
          </View>
        </View>
      ) : (
        /* Variante full: centrada, compacta y elegante */
        <View className="flex-1 items-center justify-center px-4 gap-1">
          <BrandLogo size={40} source={ownerLogo} zoom={OWNER_LOGO_ZOOM} />
          <Text className="text-base font-bold text-white tracking-tight">
            {title}
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
