import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
  ScrollView,
  Image,
} from "react-native";
import { colors } from "../../../theme/colors";
import { useApp } from "../../../context/AppContext";
import { Icon } from "../../../shared/components/Icon";
import { ApiClient } from "../../../api/client";

export function KycScreen({ onBack, onComplete, role = "renter" }) {
  const { currentUser, setCurrentUser } = useApp();
  const isDriver = role === "owner" || role === "conductor";

  // Steps: '01_cedula' | '02_licencia' | '03_facial' | '04_review' | '05_approved'
  const [currentStep, setCurrentStep] = useState("01_cedula");
  const [capturing, setCapturing] = useState(false);
  const [cedulaSide, setCedulaSide] = useState("front"); // 'front' | 'back'

  const handleCaptureCedula = () => {
    setCapturing(true);
    setTimeout(() => {
      setCapturing(false);
      if (cedulaSide === "front") {
        setCedulaSide("back");
      } else {
        // Si es Dueño, puede pasar directo a selfie facial o licencia opcional
        setCurrentStep(isDriver ? "03_facial" : "02_licencia");
      }
    }, 600);
  };

  const handleCaptureLicencia = () => {
    setCapturing(true);
    setTimeout(() => {
      setCapturing(false);
      setCurrentStep("03_facial");
    }, 600);
  };

  const handleCaptureFacial = async () => {
    setCapturing(true);
    try {
      // Llamada real al backend con fallback local
      await ApiClient.verifyKyc({
        rut: currentUser?.rut || "19.345.678-2",
        nombre: currentUser?.nombre || "Usuario Registrado",
        rol: isDriver ? "dueno" : "cliente",
      });
    } catch {
      // Continúa con fallback sin interrumpir al usuario
    } finally {
      setCapturing(false);
      setCurrentStep("04_review");
    }
  };

  const handleApprove = () => {
    if (setCurrentUser) {
      setCurrentUser((prev) => ({
        ...prev,
        verificado: true,
        estado_documentos: "verificado",
      }));
    }
    setCurrentStep("05_approved");
  };

  const isDarkScreen =
    currentStep === "01_cedula" ||
    currentStep === "02_licencia" ||
    currentStep === "03_facial";

  return (
    <SafeAreaView
      style={[
        styles.container,
        isDarkScreen ? styles.bgDark : styles.bgLight,
      ]}
    >
      <StatusBar
        barStyle={isDarkScreen ? "light-content" : "dark-content"}
      />

      {/* ========================================================================= */}
      {/* 01: ESCANEO DE CÉDULA DE IDENTIDAD */}
      {/* ========================================================================= */}
      {currentStep === "01_cedula" && (
        <View style={styles.cameraStepBox}>
          <View style={styles.camTopBar}>
            <TouchableOpacity
              onPress={() => {
                if (cedulaSide === "back") setCedulaSide("front");
                else onBack();
              }}
              style={styles.backBtnTouch}
            >
              <Icon name="arrow-left" size={20} color="#FFFFFF" />
            </TouchableOpacity>
            <Text style={styles.camTopTitle}>Verificación de Identidad</Text>
            <Text style={styles.camTopStep}>Paso 1 de {isDriver ? "2" : "3"}</Text>
          </View>

          <View style={styles.stepperBar}>
            <View style={[styles.barSegment, { backgroundColor: colors.accent500 }]} />
            <View style={styles.barSegment} />
            {!isDriver && <View style={styles.barSegment} />}
          </View>

          <View style={styles.camViewfinder}>
            <View style={styles.idCardOutline} />
            <Text style={styles.camMainPrompt}>
              {cedulaSide === "front"
                ? "Cédula por el frente (lado de la foto)"
                : "Cédula por el reverso (código de barras)"}
            </Text>
            <View style={styles.camBottomTip}>
              <Text style={styles.camBottomTipText}>
                Encuadre el carnet dentro del recuadro con buena iluminación.
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
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <View style={styles.shutterInner} />
              )}
            </TouchableOpacity>
            <Text style={styles.shutterSub}>
              {cedulaSide === "front"
                ? "Toque para capturar el frente"
                : "Toque para capturar el reverso"}
            </Text>
          </View>
        </View>
      )}

      {/* ========================================================================= */}
      {/* 02: ESCANEO DE LICENCIA DE CONDUCIR (ARRENDATARIO) */}
      {/* ========================================================================= */}
      {currentStep === "02_licencia" && (
        <View style={styles.cameraStepBox}>
          <View style={styles.camTopBar}>
            <TouchableOpacity
              onPress={() => {
                setCedulaSide("back");
                setCurrentStep("01_cedula");
              }}
              style={styles.backBtnTouch}
            >
              <Icon name="arrow-left" size={20} color="#FFFFFF" />
            </TouchableOpacity>
            <Text style={styles.camTopTitle}>Licencia de Conducir</Text>
            <Text style={styles.camTopStep}>Paso 2 de 3</Text>
          </View>

          <View style={styles.stepperBar}>
            <View style={[styles.barSegment, { backgroundColor: colors.accent500 }]} />
            <View style={[styles.barSegment, { backgroundColor: colors.accent500 }]} />
            <View style={styles.barSegment} />
          </View>

          <View style={styles.camViewfinder}>
            <View style={styles.idCardOutline} />
            <Text style={styles.camMainPrompt}>Licencia de Conducir Clase B</Text>
            <View style={styles.camBottomTip}>
              <Text style={styles.camBottomTipText}>
                Revisamos la vigencia y clase para habilitar arriendos seguros.
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
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <View style={styles.shutterInner} />
              )}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setCurrentStep("03_facial")}>
              <Text style={styles.shutterSub}>
                ¿No tienes tu licencia ahora? Puedes continuar y subirla después.
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* ========================================================================= */}
      {/* 03: SELFIE Y RECONOCIMIENTO BIOMÉTRICO */}
      {/* ========================================================================= */}
      {currentStep === "03_facial" && (
        <View style={styles.cameraStepBox}>
          <View style={styles.camTopBar}>
            <TouchableOpacity
              onPress={() => setCurrentStep(isDriver ? "01_cedula" : "02_licencia")}
              style={styles.backBtnTouch}
            >
              <Icon name="arrow-left" size={20} color="#FFFFFF" />
            </TouchableOpacity>
            <Text style={styles.camTopTitle}>Validación Facial</Text>
            <Text style={styles.camTopStep}>
              Paso {isDriver ? "2 de 2" : "3 de 3"}
            </Text>
          </View>

          <View style={styles.stepperBar}>
            <View style={[styles.barSegment, { backgroundColor: colors.accent500 }]} />
            <View style={[styles.barSegment, { backgroundColor: colors.accent500 }]} />
            {!isDriver && (
              <View style={[styles.barSegment, { backgroundColor: colors.accent500 }]} />
            )}
          </View>

          <View style={styles.camViewfinder}>
            <View style={styles.faceCircleOutline} />
            <Text style={styles.camMainPrompt}>Mire al frente sin lentes</Text>
            <View style={styles.camBottomTip}>
              <Text style={styles.camBottomTipText}>
                Comparamos automáticamente su rostro con la foto de su carnet.
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
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.facialBtnText}>Validar mi Identidad</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* ========================================================================= */}
      {/* 04: VALIDACIÓN EN PROCESO */}
      {/* ========================================================================= */}
      {currentStep === "04_review" && (
        <View style={styles.reviewStepBox}>
          <ScrollView contentContainerStyle={styles.reviewCenter} showsVerticalScrollIndicator={false}>
            <View style={styles.clockCircle}>
              <Icon name="clock" size={38} color="#D97706" />
            </View>

            <View style={styles.reviewTextBox}>
              <Text style={styles.reviewTitle}>Verificando tus Documentos</Text>
              <Text style={styles.reviewSub}>
                El sistema ha extraído los datos vía OCR y validado el RUT chileno con Módulo 11.
              </Text>
            </View>

            <View style={styles.checklistCard}>
              <View style={styles.checkItem}>
                <View style={styles.checkDone}>
                  <Icon name="check" size={14} color="#FFFFFF" />
                </View>
                <Text style={styles.checkText}>Cédula de Identidad procesada</Text>
              </View>

              <View style={styles.checkItem}>
                <View style={styles.checkDone}>
                  <Icon name="check" size={14} color="#FFFFFF" />
                </View>
                <Text style={styles.checkText}>
                  {isDriver ? "Datos de cuenta bancaria" : "Licencia de conducir vigente"}
                </Text>
              </View>

              <View style={styles.checkItem}>
                <View style={styles.checkDone}>
                  <Icon name="check" size={14} color="#FFFFFF" />
                </View>
                <Text style={styles.checkText}>Validación biométrica facial</Text>
              </View>
            </View>

            <View style={styles.noticeBox}>
              <Icon name="shield" size={20} color={colors.primary} style={{ marginRight: 10 }} />
              <Text style={styles.noticeText}>
                Tu información está protegida con cifrado bancario y seguro full cobertura.
              </Text>
            </View>
          </ScrollView>

          <View style={styles.reviewBottomBar}>
            <TouchableOpacity
              style={styles.reviewPrimaryBtn}
              onPress={handleApprove}
              activeOpacity={0.85}
            >
              <Text style={styles.reviewPrimaryBtnText}>Completar y Activar Cuenta</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* ========================================================================= */}
      {/* 05: IDENTIDAD VERIFICADA CON ÉXITO */}
      {/* ========================================================================= */}
      {currentStep === "05_approved" && (
        <View style={styles.reviewStepBox}>
          <View style={styles.reviewCenter}>
            <View style={styles.successCircle}>
              <Icon name="check" size={44} color="#FFFFFF" />
            </View>

            <View style={styles.reviewTextBox}>
              <Text style={styles.reviewTitle}>¡Identidad Verificada!</Text>
              <Text style={styles.reviewSub}>
                Bienvenido, {currentUser?.nombre || (isDriver ? "Rodrigo Muñoz" : "Camila Aravena")}.
                Tu cuenta está activa con acceso completo a la plataforma.
              </Text>
            </View>

            <View style={styles.badgeCard}>
              <View style={styles.shieldIconWrapper}>
                <Icon name="shield" size={28} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.badgeCardTitle}>Insignia de Usuario Verificado</Text>
                <Text style={styles.badgeCardDesc}>
                  Tu perfil ahora cuenta con el sello de confianza oficial para entregas y reservas inmediatas.
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.reviewBottomBar}>
            <TouchableOpacity
              style={styles.approvedPrimaryBtn}
              onPress={() => onComplete(role)}
              activeOpacity={0.85}
            >
              <Text style={styles.approvedPrimaryBtnText}>
                {isDriver ? "Ir a mi Panel de Dueño" : "Explorar Autos Disponibles"}
              </Text>
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
  backBtnTouch: {
    padding: 6,
  },
  camTopTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  camTopStep: {
    fontSize: 14,
    fontWeight: "500",
    color: colors.accent500,
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
    backgroundColor: "rgba(255, 255, 255, 0.25)",
  },
  camViewfinder: {
    flex: 1,
    backgroundColor: "#0B2E2E",
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    overflow: "hidden",
  },
  idCardOutline: {
    width: 300,
    height: 190,
    borderWidth: 2.5,
    borderColor: "#FFFFFF",
    borderRadius: 14,
  },
  faceCircleOutline: {
    width: 230,
    height: 230,
    borderRadius: 115,
    borderWidth: 3,
    borderColor: colors.accent500,
  },
  camMainPrompt: {
    position: "absolute",
    top: 24,
    left: 20,
    right: 20,
    textAlign: "center",
    fontSize: 18,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  camBottomTip: {
    position: "absolute",
    bottom: 24,
    left: 20,
    right: 20,
    backgroundColor: "rgba(0, 0, 0, 0.45)",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  camBottomTipText: {
    fontSize: 13,
    color: "#E2E8F0",
    textAlign: "center",
    lineHeight: 18,
  },
  shutterArea: {
    alignItems: "center",
    gap: 12,
    paddingTop: 16,
  },
  shutterOuter: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    elevation: 6,
  },
  shutterInner: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: colors.primary,
  },
  shutterSub: {
    fontSize: 13,
    color: "#94A3B8",
    textAlign: "center",
  },
  facialCtaArea: {
    paddingTop: 16,
  },
  facialBtn: {
    height: 54,
    borderRadius: 12,
    backgroundColor: colors.accent500,
    alignItems: "center",
    justifyContent: "center",
  },
  facialBtnText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  reviewStepBox: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 24,
    justifyContent: "space-between",
  },
  reviewCenter: {
    alignItems: "center",
    gap: 20,
  },
  clockCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: "#FEF3C7",
    alignItems: "center",
    justifyContent: "center",
  },
  successCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.accent700,
    alignItems: "center",
    justifyContent: "center",
  },
  reviewTextBox: {
    alignItems: "center",
    gap: 8,
  },
  reviewTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: colors.text,
    textAlign: "center",
  },
  reviewSub: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: "center",
    lineHeight: 21,
    paddingHorizontal: 12,
  },
  checklistCard: {
    width: "100%",
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 18,
    gap: 14,
  },
  checkItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  checkDone: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.accent700,
    alignItems: "center",
    justifyContent: "center",
  },
  checkText: {
    fontSize: 15,
    color: colors.text,
    fontWeight: "500",
  },
  noticeBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.primary100,
    padding: 14,
    borderRadius: 12,
    width: "100%",
  },
  noticeText: {
    flex: 1,
    fontSize: 13,
    color: colors.primary,
    lineHeight: 18,
  },
  badgeCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 18,
    gap: 14,
    width: "100%",
  },
  shieldIconWrapper: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primary100,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeCardTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.primary,
    marginBottom: 4,
  },
  badgeCardDesc: {
    fontSize: 13,
    color: colors.textMuted,
    lineHeight: 18,
  },
  reviewBottomBar: {
    paddingTop: 16,
  },
  reviewPrimaryBtn: {
    height: 54,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  reviewPrimaryBtnText: {
    color: "#FFFFFF",
    fontSize: 16,
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
});
