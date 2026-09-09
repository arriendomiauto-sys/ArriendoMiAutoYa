import { StyleSheet } from "react-native";
import { colors } from "../../../theme/colors";

// ============================================================================
// Estilos del módulo KYC
// Centraliza las reglas visuales para las pantallas y componentes de enrolamiento
// ============================================================================
export const kycStyles = StyleSheet.create({
  // Contenedor principal de pantalla clara
  screenContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },

  // Contenedor principal para pasos oscuros (escáner / cámara)
  darkScreenContainer: {
    flex: 1,
    backgroundColor: colors.primary900,
  },

  // Barra superior de navegación con botón volver y título
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },

  topBarTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: colors.text,
  },

  // Barra indicadora de progreso (stepper)
  stepperContainer: {
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: colors.surface,
  },

  stepperSegment: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.surfaceSecondary,
  },

  stepperSegmentActive: {
    backgroundColor: colors.accent500,
  },

  // Tarjeta de contenido principal
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 20,
    marginHorizontal: 16,
    marginVertical: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },

  // Botón CTA primario
  primaryButton: {
    backgroundColor: colors.primary700,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 16,
    marginVertical: 8,
  },

  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },

  // Botón secundario / alternativo
  secondaryButton: {
    backgroundColor: "transparent",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 16,
  },

  secondaryButtonText: {
    color: colors.primary600,
    fontSize: 14,
    fontWeight: "600",
  },

  // Insignia de estado verificado
  badgeVerified: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.accent100,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    alignSelf: "flex-start",
  },

  badgeVerifiedText: {
    color: colors.accent800,
    fontSize: 12,
    fontWeight: "700",
  },

  // Botón CTA primario en estado deshabilitado (a la espera de requisitos)
  primaryButtonDisabled: {
    backgroundColor: colors.disabledBg,
  },

  primaryButtonTextDisabled: {
    color: colors.textWhite,
  },

  // Barra de acciones anclada al pie de una pantalla con scroll
  footerBar: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
    paddingTop: 12,
  },

  // Texto de ayuda sobre el CTA (qué falta para poder continuar)
  ctaHelp: {
    textAlign: "center",
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 4,
  },
});
