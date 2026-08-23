import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
} from "react-native";
import { colors } from "../../../theme/colors";
import { useApp } from "../../../context/AppContext";
import { Icon } from "../../../shared/components/Icon";

export function EnrolmentScreen({ onBack, onComplete }) {
  const { currentUser, updateUserProfile } = useApp();
  // Steps: '05a_cedula' | '05b_licencia' | '05c_facial' | '06a_review' | '06b_approved'
  const [currentStep, setCurrentStep] = useState("05a_cedula");
  const [capturing, setCapturing] = useState(false);

  const handleCaptureCedula = () => {
    setCapturing(true);
    setTimeout(() => {
      setCapturing(false);
      setCurrentStep("05b_licencia");
    }, 600);
  };

  const handleCaptureLicencia = () => {
    setCapturing(true);
    setTimeout(() => {
      setCapturing(false);
      setCurrentStep("05c_facial");
    }, 600);
  };

  const handleCaptureFacial = () => {
    setCapturing(true);
    setTimeout(() => {
      setCapturing(false);
      setCurrentStep("06a_review");
    }, 700);
  };

  const handleApproveFast = () => {
    updateUserProfile({ estado_documentos: "verificado" });
    setCurrentStep("06b_approved");
  };

  return (
    <SafeAreaView
      style={[
        styles.container,
        currentStep.startsWith("05") ? styles.bgDark : styles.bgLight,
      ]}
    >
      <StatusBar
        barStyle={currentStep.startsWith("05") ? "light-content" : "dark-content"}
      />

      {/* ========================================================================= */}
      {/* 05a: ESCANEO DE CÉDULA */}
      {/* ========================================================================= */}
      {currentStep === "05a_cedula" && (
        <View style={styles.cameraStepBox}>
          <View style={styles.camTopBar}>
            <TouchableOpacity onPress={onBack}>
              <Icon name="arrow-left" size={20} color="#FFFFFF" />
            </TouchableOpacity>
            <Text style={styles.camTopTitle}>Verificar identidad</Text>
            <Text style={styles.camTopStep}>1 / 3</Text>
          </View>

          <View style={styles.stepperBar}>
            <View style={[styles.barSegment, { backgroundColor: "#FFFFFF" }]} />
            <View style={styles.barSegment} />
            <View style={styles.barSegment} />
          </View>

          <View style={styles.camViewfinder}>
            <View style={styles.idCardOutline} />
            <Text style={styles.camMainPrompt}>Cédula por el lado de la foto</Text>
            <View style={styles.camBottomTip}>
              <Text style={styles.camBottomTipText}>
                Apóyela sobre una superficie oscura y evite el reflejo del flash.
              </Text>
            </View>
          </View>

          <View style={styles.shutterArea}>
            <TouchableOpacity
              style={styles.shutterOuter}
              onPress={handleCaptureCedula}
              disabled={capturing}
              activeOpacity={0.85}
            >
              {capturing ? (
                <ActivityIndicator size="small" color="#061E1F" />
              ) : (
                <View style={styles.shutterInner} />
              )}
            </TouchableOpacity>
            <Text style={styles.shutterSub}>Luego pediremos el reverso</Text>
          </View>
        </View>
      )}

      {/* ========================================================================= */}
      {/* 05b: ESCANEO DE LICENCIA */}
      {/* ========================================================================= */}
      {currentStep === "05b_licencia" && (
        <View style={styles.cameraStepBox}>
          <View style={styles.camTopBar}>
            <TouchableOpacity onPress={() => setCurrentStep("05a_cedula")}>
              <Icon name="arrow-left" size={20} color="#FFFFFF" />
            </TouchableOpacity>
            <Text style={styles.camTopTitle}>Verificar identidad</Text>
            <Text style={styles.camTopStep}>2 / 3</Text>
          </View>

          <View style={styles.stepperBar}>
            <View style={[styles.barSegment, { backgroundColor: "#2FBF9B" }]} />
            <View style={[styles.barSegment, { backgroundColor: "#FFFFFF" }]} />
            <View style={styles.barSegment} />
          </View>

          <View style={styles.camViewfinder}>
            <View style={styles.idCardOutline} />
            <Text style={styles.camMainPrompt}>Licencia de conducir</Text>
            <View style={styles.camBottomTip}>
              <Text style={styles.camBottomTipText}>
                Debe estar vigente. Revisamos clase y fecha de vencimiento.
              </Text>
            </View>
          </View>

          <View style={styles.shutterArea}>
            <TouchableOpacity
              style={styles.shutterOuter}
              onPress={handleCaptureLicencia}
              disabled={capturing}
              activeOpacity={0.85}
            >
              {capturing ? (
                <ActivityIndicator size="small" color="#061E1F" />
              ) : (
                <View style={styles.shutterInner} />
              )}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setCurrentStep("05c_facial")}>
              <Text style={styles.shutterSub}>
                Solo para arrendar. Si publica su auto, puede saltarlo
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* ========================================================================= */}
      {/* 05c: RECONOCIMIENTO FACIAL */}
      {/* ========================================================================= */}
      {currentStep === "05c_facial" && (
        <View style={styles.cameraStepBox}>
          <View style={styles.camTopBar}>
            <TouchableOpacity onPress={() => setCurrentStep("05b_licencia")}>
              <Icon name="arrow-left" size={20} color="#FFFFFF" />
            </TouchableOpacity>
            <Text style={styles.camTopTitle}>Verificar identidad</Text>
            <Text style={styles.camTopStep}>3 / 3</Text>
          </View>

          <View style={styles.stepperBar}>
            <View style={[styles.barSegment, { backgroundColor: "#2FBF9B" }]} />
            <View style={[styles.barSegment, { backgroundColor: "#2FBF9B" }]} />
            <View style={[styles.barSegment, { backgroundColor: "#FFFFFF" }]} />
          </View>

          <View style={styles.camViewfinder}>
            <View style={styles.faceCircleOutline} />
            <Text style={styles.camMainPrompt}>Mire a la cámara sin lentes</Text>
            <View style={styles.camBottomTip}>
              <Text style={styles.camBottomTipText}>
                Comparamos su rostro con la foto de la cédula. No guardamos el video.
              </Text>
            </View>
          </View>

          <View style={styles.facialCtaArea}>
            <TouchableOpacity
              style={styles.facialBtn}
              onPress={handleCaptureFacial}
              disabled={capturing}
              activeOpacity={0.85}
            >
              {capturing ? (
                <ActivityIndicator size="small" color="#061E1F" />
              ) : (
                <Text style={styles.facialBtnText}>Enviar a revisión</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* ========================================================================= */}
      {/* 06a: VERIFICACIÓN EN REVISIÓN */}
      {/* ========================================================================= */}
      {currentStep === "06a_review" && (
        <View style={styles.reviewStepBox}>
          <View style={styles.reviewCenter}>
            <View style={styles.warningCircle}>
              <Icon name="clock" size={36} color="#D97706" />
            </View>

            <View style={styles.reviewTextBox}>
              <Text style={styles.reviewTitle}>Estamos revisando sus datos</Text>
              <Text style={styles.reviewSub}>
                Normalmente toma menos de una hora. Le avisamos por notificación y correo.
              </Text>
            </View>

            <View style={styles.checklistCard}>
              <View style={styles.checkItem}>
                <View style={styles.checkDone}>
                  <Icon name="check" size={13} color="#061E1F" />
                </View>
                <Text style={styles.checkText}>Cédula de identidad</Text>
              </View>

              <View style={styles.checkItem}>
                <View style={styles.checkDone}>
                  <Icon name="check" size={13} color="#061E1F" />
                </View>
                <Text style={styles.checkText}>Licencia de conducir</Text>
              </View>

              <View style={styles.checkItem}>
                <ActivityIndicator size="small" color="#0F3D3E" style={{ marginRight: 8 }} />
                <Text style={styles.checkText}>Comparación facial</Text>
              </View>
            </View>

            <View style={styles.warningNoticeBox}>
              <Text style={styles.warningNoticeText}>
                Mientras espera puede mirar autos disponibles, pero no podrá reservar.
              </Text>
            </View>
          </View>

          <View style={styles.reviewBottomBar}>
            <TouchableOpacity
              style={styles.reviewPrimaryBtn}
              onPress={handleApproveFast}
              activeOpacity={0.85}
            >
              <Text style={styles.reviewPrimaryBtnText}>Simular Aprobación</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.reviewSecondaryBtn}
              onPress={onComplete}
              activeOpacity={0.85}
            >
              <Text style={styles.reviewSecondaryBtnText}>Ver autos disponibles</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* ========================================================================= */}
      {/* 06b: IDENTIDAD VERIFICADA */}
      {/* ========================================================================= */}
      {currentStep === "06b_approved" && (
        <View style={styles.reviewStepBox}>
          <View style={styles.reviewCenter}>
            <View style={styles.successCircle}>
              <Icon name="check" size={42} color="#197A63" />
            </View>

            <View style={styles.reviewTextBox}>
              <Text style={styles.reviewTitle}>Identidad verificada</Text>
              <Text style={styles.reviewSub}>
                Listo, {currentUser?.nombre || "Rodrigo"}. Ya puede arrendar autos y publicar el suyo.
              </Text>
            </View>

            <View style={styles.badgeInfoCard}>
              <Icon name="shield" size={30} color="#197A63" style={{ marginRight: 14 }} />
              <View style={{ flex: 1 }}>
                <Text style={styles.badgeInfoTitle}>Insignia de verificado</Text>
                <Text style={styles.badgeInfoDesc}>
                  Aparece en su perfil. Los dueños arriendan antes a quien la tiene.
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.reviewBottomBar}>
            <TouchableOpacity
              style={styles.approvedPrimaryBtn}
              onPress={onComplete}
              activeOpacity={0.85}
            >
              <Text style={styles.approvedPrimaryBtnText}>Buscar un auto</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.approvedSecondaryLink}
              onPress={onComplete}
              activeOpacity={0.85}
            >
              <Text style={styles.approvedSecondaryText}>Publicar mi auto</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  bgDark: {
    backgroundColor: "#061E1F",
  },
  bgLight: {
    backgroundColor: colors.background,
  },
  cameraStepBox: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 32,
    justifyContent: "space-between",
  },
  camTopBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  camTopTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  camTopStep: {
    fontFamily: "monospace",
    fontSize: 14,
    color: "#92E3CB",
  },
  stepperBar: {
    flexDirection: "row",
    gap: 6,
    marginTop: 12,
    marginBottom: 8,
  },
  barSegment: {
    flex: 1,
    height: 4,
    borderRadius: 999,
    backgroundColor: "rgba(255, 255, 255, 0.22)",
  },
  camViewfinder: {
    flex: 1,
    backgroundColor: "#0E3736",
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    overflow: "hidden",
  },
  idCardOutline: {
    width: 310,
    height: 196,
    borderWidth: 2.5,
    borderColor: "#FFFFFF",
    borderRadius: 14,
  },
  faceCircleOutline: {
    width: 236,
    height: 236,
    borderRadius: 118,
    borderWidth: 3,
    borderColor: "#2FBF9B",
  },
  camMainPrompt: {
    position: "absolute",
    top: 24,
    left: 20,
    right: 20,
    textAlign: "center",
    fontSize: 19,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  camBottomTip: {
    position: "absolute",
    bottom: 24,
    left: 20,
    right: 20,
    backgroundColor: "rgba(6, 30, 31, 0.82)",
    padding: 12,
    borderRadius: 12,
  },
  camBottomTipText: {
    fontSize: 14,
    lineHeight: 20,
    color: "#DCEFEC",
    textAlign: "center",
  },
  shutterArea: {
    alignItems: "center",
    gap: 14,
    paddingTop: 16,
  },
  shutterOuter: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  shutterInner: {
    width: 63,
    height: 63,
    borderRadius: 32,
    borderWidth: 3,
    borderColor: "#061E1F",
  },
  shutterSub: {
    fontSize: 14,
    color: "rgba(255, 255, 255, 0.6)",
    textAlign: "center",
  },
  facialCtaArea: {
    paddingTop: 16,
  },
  facialBtn: {
    height: 56,
    borderRadius: 12,
    backgroundColor: "#2FBF9B",
    alignItems: "center",
    justifyContent: "center",
  },
  facialBtnText: {
    color: "#061E1F",
    fontSize: 17,
    fontWeight: "600",
  },
  reviewStepBox: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 34,
    justifyContent: "space-between",
  },
  reviewCenter: {
    alignItems: "center",
    gap: 22,
  },
  warningCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: "#FFF8EC",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 20,
  },
  successCircle: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: "#E4F8F2",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 20,
  },
  reviewTextBox: {
    alignItems: "center",
    gap: 10,
  },
  reviewTitle: {
    fontSize: 28,
    fontWeight: "600",
    letterSpacing: -0.4,
    color: colors.text,
    textAlign: "center",
  },
  reviewSub: {
    fontSize: 16,
    color: colors.textMuted,
    lineHeight: 25,
    textAlign: "center",
  },
  checklistCard: {
    width: "100%",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 18,
    gap: 14,
  },
  checkItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  checkDone: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#2FBF9B",
    alignItems: "center",
    justifyContent: "center",
  },
  checkText: {
    fontSize: 15,
    color: colors.text,
  },
  warningNoticeBox: {
    width: "100%",
    backgroundColor: "#FFF8EC",
    borderRadius: 12,
    padding: 14,
  },
  warningNoticeText: {
    fontSize: 14,
    color: "#8A5B0B",
    lineHeight: 21,
  },
  badgeInfoCard: {
    width: "100%",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 18,
    flexDirection: "row",
    alignItems: "center",
  },
  badgeInfoTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.text,
  },
  badgeInfoDesc: {
    fontSize: 14,
    color: colors.textMuted,
    lineHeight: 21,
    marginTop: 2,
  },
  reviewBottomBar: {
    gap: 10,
  },
  reviewPrimaryBtn: {
    height: 56,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  reviewPrimaryBtnText: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "600",
  },
  reviewSecondaryBtn: {
    height: 56,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.primary,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  reviewSecondaryBtnText: {
    color: colors.primary,
    fontSize: 17,
    fontWeight: "600",
  },
  approvedPrimaryBtn: {
    height: 56,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  approvedPrimaryBtnText: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "600",
  },
  approvedSecondaryLink: {
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  approvedSecondaryText: {
    color: colors.accent700,
    fontSize: 15,
    fontWeight: "600",
  },
});
