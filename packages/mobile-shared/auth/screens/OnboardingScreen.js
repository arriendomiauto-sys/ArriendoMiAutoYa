import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from "react-native";
import { colors } from "../../theme/colors";
import { theme } from "../../theme/tokens";
import { Icon } from "../../components/Icon";
import { Button, BottomBar } from "../../components/ui";

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
    <View style={styles.container}>
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
      <BottomBar bordered={false} style={styles.bottomControls}>
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

        <Button label={slide.cta} onPress={handleNext} />
      </BottomBar>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: "space-between",
  },
  topBar: {
    paddingHorizontal: theme.spacing.xxl,
    paddingTop: theme.spacing.sm,
    flexDirection: "row",
    justifyContent: "flex-end",
    height: theme.control.heightSm,
  },
  skipButton: {
    paddingVertical: 6,
    paddingHorizontal: theme.spacing.sm,
  },
  skipText: {
    ...theme.typography.bodyStrong,
    color: colors.accent700,
  },
  centerBox: {
    flex: 1,
    paddingHorizontal: theme.spacing.xxl,
    paddingVertical: theme.spacing.md,
    justifyContent: "space-between",
    gap: theme.spacing.xxl,
  },
  visualBox: {
    flex: 1,
    borderRadius: theme.radius.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  textBox: {
    gap: theme.spacing.md,
  },
  title: {
    ...theme.typography.display,
    color: colors.text,
  },
  description: {
    fontSize: 16,
    lineHeight: 25,
    color: colors.textMuted,
  },
  bottomControls: {
    paddingHorizontal: theme.spacing.xxl,
    backgroundColor: "transparent",
    gap: theme.spacing.xl,
  },
  dotsRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 7,
  },
  dot: {
    height: 7,
    borderRadius: theme.radius.pill,
  },
  dotActive: {
    width: 24,
    backgroundColor: colors.primary,
  },
  dotInactive: {
    width: 7,
    backgroundColor: colors.primary200,
  },
});
