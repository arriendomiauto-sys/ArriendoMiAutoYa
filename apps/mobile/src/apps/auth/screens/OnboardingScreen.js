import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
} from "react-native";
import { colors } from "../../../theme/colors";
import { Icon } from "../../../shared/components/Icon";

const ONBOARDING_SLIDES = [
  {
    id: "02a",
    iconName: "car",
    iconBg: colors.primary100,
    iconColor: colors.primary,
    title: "El auto del vecino, arrendado en minutos",
    description:
      "Cualquier persona publica su auto y otra lo arrienda por días o semanas. Sin sucursal ni mostrador.",
    cta: "Continuar",
  },
  {
    id: "02b",
    iconName: "shield",
    iconBg: colors.accentMuted,
    iconColor: colors.accent800,
    title: "Nosotros ponemos la confianza",
    description:
      "Verificamos la identidad de las dos partes, retenemos la garantía en tarjeta y generamos el contrato.",
    cta: "Continuar",
  },
  {
    id: "02c",
    iconName: "camera",
    iconBg: colors.primary100,
    iconColor: colors.primary,
    title: "La entrega queda registrada",
    description:
      "Se juntan, sacan ocho fotos del auto, firman en el celular y se pasan las llaves. Todo queda guardado.",
    cta: "Empezar",
  },
];

export function OnboardingScreen({ onFinish }) {
  const [currentSlide, setCurrentSlide] = useState(0);

  const handleNext = () => {
    if (currentSlide < ONBOARDING_SLIDES.length - 1) {
      setCurrentSlide(currentSlide + 1);
    } else {
      onFinish();
    }
  };

  const slide = ONBOARDING_SLIDES[currentSlide];

  return (
    <SafeAreaView style={styles.container}>
      {/* Top Skip Button */}
      <View style={styles.topBar}>
        {currentSlide < ONBOARDING_SLIDES.length - 1 ? (
          <TouchableOpacity onPress={onFinish} style={styles.skipButton}>
            <Text style={styles.skipText}>Saltar</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ height: 36 }} />
        )}
      </View>

      {/* Center Content */}
      <View style={styles.centerBox}>
        <View style={[styles.visualBox, { backgroundColor: slide.iconBg }]}>
          <Icon name={slide.iconName} size={110} color={slide.iconColor} />
        </View>

        <View style={styles.textBox}>
          <Text style={styles.title}>{slide.title}</Text>
          <Text style={styles.description}>{slide.description}</Text>
        </View>
      </View>

      {/* Bottom Controls */}
      <View style={styles.bottomControls}>
        <View style={styles.dotsRow}>
          {ONBOARDING_SLIDES.map((_, idx) => (
            <View
              key={idx}
              style={[
                styles.dot,
                idx === currentSlide ? styles.dotActive : styles.dotInactive,
              ]}
            />
          ))}
        </View>

        <TouchableOpacity
          style={styles.primaryBtn}
          onPress={handleNext}
          activeOpacity={0.85}
        >
          <Text style={styles.primaryBtnText}>{slide.cta}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: "space-between",
  },
  topBar: {
    paddingHorizontal: 24,
    paddingTop: 8,
    flexDirection: "row",
    justifyContent: "flex-end",
    height: 44,
  },
  skipButton: {
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  skipText: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.accent700,
  },
  centerBox: {
    flex: 1,
    paddingHorizontal: 24,
    paddingVertical: 12,
    justifyContent: "space-between",
    gap: 24,
  },
  visualBox: {
    flex: 1,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  textBox: {
    gap: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: "600",
    letterSpacing: -0.4,
    lineHeight: 33,
    color: colors.text,
  },
  description: {
    fontSize: 16,
    color: colors.textMuted,
    lineHeight: 25,
  },
  bottomControls: {
    paddingHorizontal: 24,
    paddingBottom: 34,
    paddingTop: 16,
    gap: 20,
  },
  dotsRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 7,
  },
  dot: {
    height: 7,
    borderRadius: 999,
  },
  dotActive: {
    width: 24,
    backgroundColor: colors.primary,
  },
  dotInactive: {
    width: 7,
    backgroundColor: colors.primary200,
  },
  primaryBtn: {
    height: 56,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryBtnText: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "600",
  },
});
