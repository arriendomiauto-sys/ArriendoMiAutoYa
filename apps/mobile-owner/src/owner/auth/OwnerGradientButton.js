import React from "react";
import { TouchableOpacity, Text, ActivityIndicator, View } from "react-native";
import Svg, { Defs, LinearGradient, Stop, Rect } from "react-native-svg";
import { colors } from "@rentacar/mobile-shared";

/**
 * CTA principal del flujo de dueño: píldora con relleno en degradado
 * (teal->menta). Usando NativeWind classes.
 */
export function OwnerGradientButton({
  label,
  onPress,
  loading = false,
  disabled = false,
  className = "",
  style,
  testID,
  accessibilityLabel,
}) {
  const isDisabled = disabled || loading;
  return (
    <TouchableOpacity
      testID={testID}
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || label}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      className={`h-[52px] rounded-[26px] overflow-hidden items-center justify-center relative ${
        isDisabled ? "opacity-50" : "active:opacity-85"
      } ${className}`}
      style={style}
    >
      <View className="absolute inset-0" pointerEvents="none">
        <Svg width="100%" height="100%">
          <Defs>
            <LinearGradient id="ownerBtnGrad" x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0" stopColor={colors.primary700} />
              <Stop offset="1" stopColor={colors.accent500} />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" rx={26} fill="url(#ownerBtnGrad)" />
        </Svg>
      </View>
      {loading ? (
        <ActivityIndicator color="#ffffff" size="small" />
      ) : (
        <Text className="text-[15.5px] font-semibold text-white">{label}</Text>
      )}
    </TouchableOpacity>
  );
}
