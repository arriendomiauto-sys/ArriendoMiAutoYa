import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "../../theme/colors";
import { BackButton } from "../../components/ui";
import { DocumentCameraModal } from "../../components/DocumentCameraModal";
import { SelfieLivenessModal } from "../../components/SelfieLivenessModal";
import { useKycFlow } from "./useKycFlow";
import { StepDiditActivation } from "./steps/StepDiditActivation";
import { StepDiditConfirmation } from "./steps/StepDiditConfirmation";
import { StepManualCapture } from "./steps/StepManualCapture";
import { StepReviewPending } from "./steps/StepReviewPending";

// ============================================================================
// Pantalla principal KYC (orquestador modular)
// Renderiza el paso activo según el estado de useKycFlow y monta las cámaras
// guiadas para la captura manual.
// ============================================================================

// Cada casilla de documento abre una variante de la cámara guiada.
const CAMERA_VARIANT = {
  id_front: "carnet_frente",
  id_back: "carnet_reverso",
  license: "licencia",
};

export function KycScreen({ onBack, onComplete, role = "renter", prefill = null }) {
  const insets = useSafeAreaInsets();
  const {
    currentStep,
    setCurrentStep,
    isLoading,
    isSubmitting,
    verifiedData,
    fallbackDocs,
    captureSlot,
    uploadingSlot,
    startDiditVerification,
    triggerFallback,
    confirmAndProceed,
    beginCapture,
    cancelCapture,
    handleManualCapture,
    submitManualVerification,
  } = useKycFlow({ role, prefill, onComplete, onBack });

  const documentCaptureOpen = captureSlot === "id_front" || captureSlot === "id_back" || captureSlot === "license";

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Cabecera común con botón para volver */}
      <View style={styles.navBar}>
        <BackButton onPress={onBack || (() => setCurrentStep("didit_activation"))} />
        <Text style={styles.navTitle}>Verificación de cuenta</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Renderizado condicional por paso */}
      {currentStep === "didit_activation" && (
        <StepDiditActivation
          onStartDidit={startDiditVerification}
          onTriggerFallback={triggerFallback}
          isLoading={isLoading}
        />
      )}

      {currentStep === "didit_confirmation" && (
        <StepDiditConfirmation
          verifiedData={verifiedData}
          onConfirmAndProceed={confirmAndProceed}
          onRetry={startDiditVerification}
          isSubmitting={isSubmitting}
        />
      )}

      {currentStep === "manual_capture" && (
        <StepManualCapture
          docs={fallbackDocs}
          uploadingSlot={uploadingSlot}
          onCapture={beginCapture}
          onSubmit={submitManualVerification}
          onBackToDidit={() => setCurrentStep("didit_activation")}
          isSubmitting={isSubmitting}
        />
      )}

      {currentStep === "revision" && <StepReviewPending onGoToHome={onBack} />}

      {/* Cámara guiada para documentos (cédula frente/reverso, licencia) */}
      <DocumentCameraModal
        visible={documentCaptureOpen}
        variant={CAMERA_VARIANT[captureSlot] || "carnet_frente"}
        onClose={cancelCapture}
        onCaptured={handleManualCapture}
      />

      {/* Selfie con prueba de vida (dos fotos guiadas) */}
      <SelfieLivenessModal
        visible={captureSlot === "selfie"}
        onClose={cancelCapture}
        onCaptured={handleManualCapture}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  navBar: {
    height: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  navTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text,
  },
});
