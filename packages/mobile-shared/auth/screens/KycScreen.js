import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  ActivityIndicator,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { colors } from "../../theme/colors";
import { useApp } from "../../context/AppContext";
import { Icon } from "../../components/Icon";
import { DocumentCameraModal } from "../../components/DocumentCameraModal";
import { ApiClient } from "../../api/client";
import { supabase } from "../../api/supabase";
import { EDAD_MINIMA_ARRENDATARIO } from "../../legal/documentos";
import { edadDesdeOcr } from "../../utils/edad";
import { showAlert } from "../../utils/alert";

// Valida un RUT chileno con el dígito verificador Módulo 11.
function isRutValid(rutRaw) {
  if (!rutRaw) return false;
  const clean = rutRaw.replace(/\./g, "").replace(/-/g, "").trim().toUpperCase();
  if (clean.length < 2) return false;
  const body = clean.slice(0, -1);
  const dv = clean.slice(-1);
  if (!/^\d+$/.test(body)) return false;

  let sum = 0;
  let multiplier = 2;
  for (let i = body.length - 1; i >= 0; i--) {
    sum += parseInt(body[i], 10) * multiplier;
    multiplier = multiplier === 7 ? 2 : multiplier + 1;
  }
  const remainder = 11 - (sum % 11);
  const expectedDv = remainder === 11 ? "0" : remainder === 10 ? "K" : String(remainder);
  return dv === expectedDv;
}

export function KycScreen({ onBack, onComplete, role = "renter", prefill = null }) {
  const { currentUser, completeEnrolment } = useApp();
  const isDriver = role === "owner";

  const yaVerificado = currentUser?.estado_documentos === "verificado";
  const enRevision = currentUser?.estado_documentos === "requiere_revision_manual";

  // Steps: '01_cedula' | '02_licencia' | '03_facial' | '04_review' | '05_approved' | '06_revision'
  const [currentStep, setCurrentStep] = useState(
    yaVerificado ? "05_approved" : enRevision ? "06_revision" : "01_cedula"
  );
  const [capturing, setCapturing] = useState(false);
  const [cedulaSide, setCedulaSide] = useState("front"); // 'front' | 'back'

  // Qué documento está capturando la cámara guiada (null = cerrada).
  // 'carnet_frente' | 'carnet_reverso' | 'licencia' | 'selfie'
  const [cameraFor, setCameraFor] = useState(null);

  // URLs de Supabase Storage tras subir cada documento capturado.
  const [carnetFrontalUrl, setCarnetFrontalUrl] = useState(null);
  const [carnetTraseroUrl, setCarnetTraseroUrl] = useState(null);
  const [licenciaUrl, setLicenciaUrl] = useState(null);
  const [selfieUrl, setSelfieUrl] = useState(null);

  // Datos del formulario final, prellenados desde RegisterScreen (prefill)
  // o desde el perfil ya sincronizado (currentUser) cuando existan.
  const [nombre, setNombre] = useState(prefill?.nombre || currentUser?.nombre || "");
  const [rut, setRut] = useState(prefill?.rut || currentUser?.rut || "");
  const [telefono, setTelefono] = useState(prefill?.telefono || currentUser?.telefono || "");

  const [submitting, setSubmitting] = useState(false);
  // Edad leída de la cédula por el OCR (null = todavía no se validó o el OCR
  // no pudo leer la fecha de nacimiento).
  const [edadCarnet, setEdadCarnet] = useState(null);

  const rutTouched = rut.trim().length > 0;
  const rutIsValid = isRutValid(rut);

  // Sube al backend el uri local que devolvió la cámara guiada y retorna
  // la URL almacenada (firmada, bucket privado documentos-kyc).
  const subirDocumento = async (uri, filenamePrefix) => {
    const filename = `${filenamePrefix}_${Date.now()}.jpg`;
    const { url } = await ApiClient.subirArchivoStorage(uri, filename, "documentos-kyc");
    return url;
  };

  // Callback único de la cámara guiada: sabe qué documento se estaba
  // capturando por `cameraFor`, lo sube y avanza el flujo.
  const handleFotoCapturada = async (uri) => {
    const slot = cameraFor;
    setCameraFor(null);
    if (!uri || !slot) return;

    setCapturing(true);
    try {
      if (slot === "carnet_frente") {
        const url = await subirDocumento(uri, "carnet_frontal");
        setCarnetFrontalUrl(url);
        setCedulaSide("back");
      } else if (slot === "carnet_reverso") {
        const url = await subirDocumento(uri, "carnet_trasero");
        setCarnetTraseroUrl(url);
        setCurrentStep(isDriver ? "03_facial" : "02_licencia");
      } else if (slot === "licencia") {
        const url = await subirDocumento(uri, "licencia_conducir");
        setLicenciaUrl(url);
        setCurrentStep("03_facial");
      } else if (slot === "selfie") {
        // La selfie queda como foto_perfil_verificada_url; el OCR + control
        // facial reales corren en /enrolamiento/completar con todo junto.
        const url = await subirDocumento(uri, "selfie_verificacion");
        setSelfieUrl(url);
        setCurrentStep("04_review");
      }
    } catch (err) {
      showAlert("No se pudo subir la foto", err.message || "Revisa tu conexión e inténtalo de nuevo.");
    } finally {
      setCapturing(false);
    }
  };

  const handleApprove = async () => {
    if (!nombre.trim() || !rut.trim()) {
      showAlert("Datos incompletos", "Ingresa tu nombre completo y tu RUT para continuar.");
      return;
    }
    if (!isRutValid(rut)) {
      showAlert(
        "RUT inválido",
        "Revisa el RUT ingresado: el dígito verificador no coincide (Módulo 11)."
      );
      return;
    }

    if (!carnetFrontalUrl) {
      showAlert(
        "Falta la foto de tu cédula",
        "Debes fotografiar tu cédula de identidad con la cámara antes de continuar."
      );
      setCurrentStep("01_cedula");
      return;
    }

    setSubmitting(true);
    try {
      let userEmail = currentUser?.email || prefill?.email;
      if (!userEmail) {
        try {
          const { data: authData } = await supabase.auth.getUser();
          userEmail = authData?.user?.email;
        } catch {
          /* fallback si falla getUser */
        }
      }

      // La edad no puede quedar solo en la casilla que el usuario marcó en el
      // registro: acá se lee la fecha de nacimiento que el OCR extrae del
      // carnet y se valida contra el mínimo de los términos ANTES de
      // completar el enrolamiento (que además cobra el hold de garantía).
      // Si el OCR no logra leer la fecha no se bloquea a nadie: esos casos
      // ya terminan en revisión manual del lado del backend.
      if (userEmail) {
        try {
          const previo = await ApiClient.verifyKyc({
            nombre,
            rut,
            email: userEmail,
            telefono,
            carnet_frontal_url: carnetFrontalUrl,
            carnet_trasero_url: carnetTraseroUrl,
            licencia_url: role === "renter" ? licenciaUrl : undefined,
            foto_perfil_verificada_url: selfieUrl,
          });
          const edad = edadDesdeOcr(previo?.datos_extraidos);
          setEdadCarnet(edad);

          if (edad !== null && edad < EDAD_MINIMA_ARRENDATARIO) {
            showAlert(
              "No cumples la edad mínima",
              `Según la fecha de nacimiento de tu cédula tienes ${edad} años, y para operar en la plataforma se necesitan ${EDAD_MINIMA_ARRENDATARIO} cumplidos.\n\n` +
                "Si crees que leímos mal tu cédula, vuelve a fotografiarla con buena luz o escríbenos a soporte."
            );
            return;
          }
        } catch (err) {
          // El pre-chequeo es best-effort: si falla (red, OCR caído) no se
          // frena el enrolamiento, que igual pasa por la verificación real.
          console.warn("[KycScreen] No se pudo validar la edad con el carnet:", err.message);
        }
      }

      // El Dueño completa el mismo enrolamiento (nombre/RUT/carnet) que el
      // Arrendatario — el backend le otorga el rol "dueno" automáticamente
      // la primera vez que publique un auto.
      //
      // El backend corre el OCR + control facial reales acá. Puede devolver:
      //  - 200 estado_documentos="verificado"           -> aprobado
      //  - 200 estado_documentos="requiere_revision_manual" -> queda en revisión
      //  - 400 (rechazado)                              -> vuelve a intentar
      const profile = await completeEnrolment({
        nombre,
        rut,
        email: userEmail,
        telefono,
        carnet_frontal_url: carnetFrontalUrl,
        carnet_trasero_url: carnetTraseroUrl,
        licencia_url: role === "renter" ? licenciaUrl : undefined,
        foto_perfil_verificada_url: selfieUrl,
      });
      setCurrentStep(profile?.estado_documentos === "verificado" ? "05_approved" : "06_revision");
    } catch (err) {
      showAlert(
        "No pudimos verificar tus documentos",
        (err.message || "") +
          "\n\nVuelve a tomar las fotos: documento completo dentro del marco, enfocado, sin reflejos y con buena luz."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const isDarkScreen =
    currentStep === "01_cedula" ||
    currentStep === "02_licencia" ||
    currentStep === "03_facial";

  return (
    <View
      style={[
        styles.container,
        isDarkScreen ? styles.bgDark : styles.bgLight,
      ]}
    >
      <StatusBar
        barStyle={isDarkScreen ? "light-content" : "dark-content"}
      />

      {/* ========================================================================= */}
      {/* 01: CÉDULA DE IDENTIDAD */}
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

          <CaptureGuide
            shape="card"
            titulo={
              cedulaSide === "front"
                ? "Cédula — lado de la foto"
                : "Cédula — reverso (código de barras)"
            }
            tips={[
              "Los 4 bordes de la cédula dentro del marco",
              "Buena luz, sin flash ni reflejos sobre el plástico",
              "Cédula plana; el RUT y el nombre bien nítidos",
            ]}
            done={cedulaSide === "back" ? "Frente capturado ✓" : null}
          />

          <View style={styles.ctaArea}>
            <TouchableOpacity
              style={styles.primaryCta}
              onPress={() => setCameraFor(cedulaSide === "front" ? "carnet_frente" : "carnet_reverso")}
              disabled={capturing}
              activeOpacity={0.85}
            >
              {capturing ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.primaryCtaText}>
                  {cedulaSide === "front" ? "Abrir cámara — frente" : "Abrir cámara — reverso"}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* ========================================================================= */}
      {/* 02: LICENCIA DE CONDUCIR (ARRENDATARIO) */}
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

          <CaptureGuide
            shape="card"
            titulo="Licencia de conducir (Clase B)"
            tips={[
              "Licencia completa dentro del marco",
              "Plana y sin reflejos; que se lea la clase y la vigencia",
              "Buena luz, cámara paralela al documento",
            ]}
            done={licenciaUrl ? "Licencia capturada ✓" : null}
          />

          <View style={styles.ctaArea}>
            <TouchableOpacity
              style={styles.primaryCta}
              onPress={() => setCameraFor("licencia")}
              disabled={capturing}
              activeOpacity={0.85}
            >
              {capturing ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.primaryCtaText}>Abrir cámara</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setCurrentStep("03_facial")}>
              <Text style={styles.skipText}>
                ¿No tienes tu licencia ahora? Puedes continuar y subirla después.
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* ========================================================================= */}
      {/* 03: SELFIE DE VERIFICACIÓN */}
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

          <CaptureGuide
            shape="face"
            titulo="Selfie de verificación"
            tips={[
              "Cara centrada en el óvalo, mirando de frente",
              "Sin lentes de sol, gorro ni mascarilla",
              "Buena luz de frente, fondo neutro",
            ]}
            done={selfieUrl ? "Selfie capturada ✓" : null}
          />

          <View style={styles.ctaArea}>
            <TouchableOpacity
              style={styles.primaryCta}
              onPress={() => setCameraFor("selfie")}
              disabled={capturing}
              activeOpacity={0.85}
            >
              {capturing ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.primaryCtaText}>Abrir cámara frontal</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* ========================================================================= */}
      {/* 04: REVISIÓN Y CONFIRMACIÓN DE DATOS */}
      {/* ========================================================================= */}
      {currentStep === "04_review" && (
        <KeyboardAvoidingView
          style={styles.reviewStepBox}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          keyboardVerticalOffset={Platform.OS === "ios" ? 12 : 0}
        >
          <TouchableOpacity
            onPress={() => setCurrentStep("03_facial")}
            style={styles.reviewBackBtn}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Icon name="arrow-left" size={20} color={colors.primary} />
          </TouchableOpacity>

          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={[styles.reviewCenter, { paddingBottom: 60 }]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
          >
            <View style={styles.clockCircle}>
              <Icon name="clock" size={38} color="#D97706" />
            </View>

            <View style={styles.reviewTextBox}>
              <Text style={styles.reviewTitle}>Confirma tus Datos</Text>
              <Text style={styles.reviewSub}>
                Revisa que tu nombre y RUT sean correctos antes de activar tu cuenta.
              </Text>
            </View>

            {/* Formulario de confirmación */}
            <View style={styles.reviewFormCard}>
              <View style={styles.reviewFormGroup}>
                <Text style={styles.reviewFieldLabel}>NOMBRE COMPLETO</Text>
                <View style={styles.reviewInputBox}>
                  <TextInput
                    style={styles.reviewTextInput}
                    value={nombre}
                    onChangeText={setNombre}
                    placeholder="Ej. Rodrigo Muñoz"
                    placeholderTextColor={colors.textPlaceholder}
                    autoCapitalize="words"
                  />
                </View>
              </View>

              <View style={styles.reviewFormGroup}>
                <Text style={styles.reviewFieldLabel}>RUT CHILENO</Text>
                <View style={styles.reviewInputBox}>
                  <TextInput
                    style={styles.reviewTextInput}
                    value={rut}
                    onChangeText={setRut}
                    placeholder="Ej. 14.234.567-8"
                    placeholderTextColor={colors.textPlaceholder}
                    autoCapitalize="characters"
                  />
                </View>
                {rutTouched && (
                  <Text
                    style={[
                      styles.rutValidationText,
                      rutIsValid ? styles.rutValidationOk : styles.rutValidationBad,
                    ]}
                  >
                    {rutIsValid
                      ? "RUT válido (Módulo 11)"
                      : "Dígito verificador no coincide"}
                  </Text>
                )}
              </View>

              <View style={styles.reviewFormGroup}>
                <Text style={styles.reviewFieldLabel}>TELÉFONO</Text>
                <View style={styles.reviewInputBox}>
                  <TextInput
                    style={styles.reviewTextInput}
                    value={telefono}
                    onChangeText={setTelefono}
                    placeholder="+56 9 7734 1208"
                    placeholderTextColor={colors.textPlaceholder}
                    keyboardType="phone-pad"
                  />
                </View>
              </View>
            </View>

            <View style={styles.checklistCard}>
              <View style={styles.checkItem}>
                <View
                  style={[
                    styles.checkDone,
                    !carnetFrontalUrl && styles.checkPending,
                  ]}
                >
                  <Icon name="check" size={14} color="#FFFFFF" />
                </View>
                <Text style={styles.checkText}>Cédula de Identidad capturada</Text>
              </View>

              <View style={styles.checkItem}>
                <View
                  style={[
                    styles.checkDone,
                    role === "renter" && !licenciaUrl && styles.checkPending,
                  ]}
                >
                  <Icon name="check" size={14} color="#FFFFFF" />
                </View>
                <Text style={styles.checkText}>
                  {isDriver ? "Datos de cuenta bancaria" : "Licencia de conducir"}
                </Text>
              </View>

              <View style={styles.checkItem}>
                <View style={[styles.checkDone, !selfieUrl && styles.checkPending]}>
                  <Icon name="check" size={14} color="#FFFFFF" />
                </View>
                <Text style={styles.checkText}>Selfie de verificación capturada</Text>
              </View>

              <View style={styles.checkItem}>
                <View style={[styles.checkDone, edadCarnet === null && styles.checkPending]}>
                  <Icon name="check" size={14} color="#FFFFFF" />
                </View>
                <Text style={styles.checkText}>
                  {edadCarnet === null
                    ? `Edad (${EDAD_MINIMA_ARRENDATARIO}+): se valida con tu cédula`
                    : `Edad verificada en tu cédula: ${edadCarnet} años`}
                </Text>
              </View>
            </View>

            <View style={styles.noticeBox}>
              <Icon name="shield" size={20} color={colors.primary} style={{ marginRight: 10 }} />
              <Text style={styles.noticeText}>
                Tu información está protegida con cifrado bancario y seguro full cobertura.
              </Text>
            </View>

            <View style={{ width: "100%", marginTop: 8 }}>
              <TouchableOpacity
                style={[styles.reviewPrimaryBtn, submitting && styles.btnDisabled]}
                onPress={handleApprove}
                activeOpacity={0.85}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.reviewPrimaryBtnText}>Completar y Activar Cuenta</Text>
                )}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
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
                Bienvenido, {nombre || currentUser?.nombre || "usuario"}.
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
              onPress={() => onComplete()}
              activeOpacity={0.85}
            >
              <Text style={styles.approvedPrimaryBtnText}>
                {isDriver ? "Ir a mi Panel de Dueño" : "Explorar Autos Disponibles"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* ========================================================================= */}
      {/* 06: DOCUMENTOS EN REVISIÓN MANUAL */}
      {/* ========================================================================= */}
      {currentStep === "06_revision" && (
        <View style={styles.reviewStepBox}>
          <View style={styles.reviewCenter}>
            <View style={styles.clockCircle}>
              <Icon name="clock" size={38} color="#D97706" />
            </View>

            <View style={styles.reviewTextBox}>
              <Text style={styles.reviewTitle}>Estamos revisando tus documentos</Text>
              <Text style={styles.reviewSub}>
                Recibimos tus fotos pero no pudimos validarlas de forma automática.
                Un ejecutivo las revisa a mano — te avisamos apenas quede lista tu cuenta
                (normalmente dentro de unas horas).
              </Text>
            </View>

            <View style={styles.badgeCard}>
              <View style={styles.shieldIconWrapper}>
                <Icon name="camera" size={26} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.badgeCardTitle}>¿Quieres acelerar la revisión?</Text>
                <Text style={styles.badgeCardDesc}>
                  Vuelve a tomar las fotos con el documento completo dentro del marco,
                  enfocado, sin reflejos y con buena luz.
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.reviewBottomBar}>
            <TouchableOpacity
              style={[styles.approvedPrimaryBtn, { backgroundColor: colors.primary }]}
              onPress={() => {
                setCarnetFrontalUrl(null);
                setCarnetTraseroUrl(null);
                setLicenciaUrl(null);
                setSelfieUrl(null);
                setCedulaSide("front");
                setCurrentStep("01_cedula");
              }}
              activeOpacity={0.85}
            >
              <Text style={styles.approvedPrimaryBtnText}>Volver a tomar las fotos</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => onComplete()} style={{ paddingVertical: 12 }}>
              <Text style={[styles.reviewSub, { fontSize: 13 }]}>
                Continuar y esperar la revisión
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <DocumentCameraModal
        visible={!!cameraFor}
        variant={cameraFor || "carnet_frente"}
        onClose={() => setCameraFor(null)}
        onCaptured={handleFotoCapturada}
      />
    </View>
  );
}

// Guía visual de encuadre: muestra la forma (tarjeta u óvalo) con esquineros
// y un ejemplo de cómo debe quedar el documento, más los tips de captura.
function CaptureGuide({ shape, titulo, tips, done }) {
  const isFace = shape === "face";
  return (
    <View style={styles.guideWrap}>
      <View style={styles.guideStage}>
        <View style={[styles.guideFrame, isFace ? styles.guideFrameFace : styles.guideFrameCard]}>
          {isFace ? (
            <View style={styles.mockFace}>
              <View style={styles.mockFaceHead} />
              <View style={styles.mockFaceBody} />
            </View>
          ) : (
            <View style={styles.mockCard}>
              <View style={styles.mockPhoto} />
              <View style={styles.mockLines}>
                <View style={[styles.mockLine, { width: "70%" }]} />
                <View style={[styles.mockLine, { width: "45%" }]} />
                <View style={[styles.mockLine, { width: "60%" }]} />
              </View>
            </View>
          )}
          <View style={[styles.gCorner, styles.gTL]} />
          <View style={[styles.gCorner, styles.gTR]} />
          <View style={[styles.gCorner, styles.gBL]} />
          <View style={[styles.gCorner, styles.gBR]} />
        </View>
        <Text style={styles.guideCaption}>Así se debe ver</Text>
      </View>

      <Text style={styles.guideTitle}>{titulo}</Text>
      <View style={styles.tipList}>
        {tips.map((t) => (
          <View key={t} style={styles.tipRow}>
            <Icon name="check" size={14} color={colors.accent500} />
            <Text style={styles.tipText}>{t}</Text>
          </View>
        ))}
      </View>
      {done ? (
        <View style={styles.doneChip}>
          <Text style={styles.doneChipText}>{done}</Text>
        </View>
      ) : null}
    </View>
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
  // --- Guía de encuadre (CaptureGuide) ---
  guideWrap: {
    flex: 1,
    justifyContent: "center",
    gap: 18,
  },
  guideStage: {
    alignItems: "center",
    gap: 8,
  },
  guideFrame: {
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.35)",
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  guideFrameCard: {
    width: 280,
    height: 280 / (85.6 / 54),
  },
  guideFrameFace: {
    width: 210,
    height: 260,
    borderRadius: 130,
  },
  guideCaption: {
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.5,
    color: colors.accent500,
    textTransform: "uppercase",
  },
  gCorner: {
    position: "absolute",
    width: 22,
    height: 22,
    borderColor: colors.accent500,
  },
  gTL: { top: -2, left: -2, borderTopWidth: 3, borderLeftWidth: 3, borderTopLeftRadius: 8 },
  gTR: { top: -2, right: -2, borderTopWidth: 3, borderRightWidth: 3, borderTopRightRadius: 8 },
  gBL: { bottom: -2, left: -2, borderBottomWidth: 3, borderLeftWidth: 3, borderBottomLeftRadius: 8 },
  gBR: { bottom: -2, right: -2, borderBottomWidth: 3, borderRightWidth: 3, borderBottomRightRadius: 8 },
  mockCard: {
    width: "82%",
    height: "72%",
    backgroundColor: "rgba(255,255,255,0.9)",
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    gap: 10,
  },
  mockPhoto: {
    width: "30%",
    height: "80%",
    backgroundColor: "#8CA3A3",
    borderRadius: 4,
  },
  mockLines: {
    flex: 1,
    gap: 6,
  },
  mockLine: {
    height: 6,
    borderRadius: 3,
    backgroundColor: "#9CB0B0",
  },
  mockFace: {
    alignItems: "center",
    gap: 4,
  },
  mockFaceHead: {
    width: 66,
    height: 66,
    borderRadius: 33,
    backgroundColor: "rgba(255,255,255,0.75)",
  },
  mockFaceBody: {
    width: 110,
    height: 60,
    borderTopLeftRadius: 55,
    borderTopRightRadius: 55,
    backgroundColor: "rgba(255,255,255,0.55)",
  },
  guideTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#FFFFFF",
    textAlign: "center",
  },
  tipList: {
    gap: 8,
    alignSelf: "center",
  },
  tipRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  tipText: {
    fontSize: 13,
    color: "#CBD5E1",
    flexShrink: 1,
  },
  doneChip: {
    alignSelf: "center",
    backgroundColor: "rgba(47,191,155,0.16)",
    borderWidth: 1,
    borderColor: "rgba(47,191,155,0.4)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  doneChipText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.accent500,
  },
  // --- CTA de cada paso ---
  ctaArea: {
    alignItems: "center",
    gap: 12,
    paddingTop: 16,
  },
  primaryCta: {
    width: "100%",
    height: 54,
    borderRadius: 12,
    backgroundColor: colors.accent500,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryCtaText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
  skipText: {
    fontSize: 13,
    color: "#94A3B8",
    textAlign: "center",
  },
  reviewStepBox: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 24,
    justifyContent: "space-between",
  },
  reviewBackBtn: {
    alignSelf: "flex-start",
    marginBottom: 8,
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
  reviewFormCard: {
    width: "100%",
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 18,
    gap: 14,
  },
  reviewFormGroup: {
    gap: 6,
  },
  reviewFieldLabel: {
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.8,
    color: colors.textMuted,
    textTransform: "uppercase",
  },
  reviewInputBox: {
    height: 48,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 10,
    backgroundColor: colors.background,
    paddingHorizontal: 14,
    justifyContent: "center",
  },
  reviewTextInput: {
    fontSize: 15,
    color: colors.text,
  },
  rutValidationText: {
    fontSize: 12,
    fontWeight: "600",
  },
  rutValidationOk: {
    color: colors.success,
  },
  rutValidationBad: {
    color: colors.danger,
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
  checkPending: {
    backgroundColor: colors.borderDark,
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
  btnDisabled: {
    opacity: 0.6,
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
