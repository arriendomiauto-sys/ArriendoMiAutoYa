import React, { useRef, useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  StatusBar,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { colors } from "../../theme/colors";
import { theme } from "../../theme/tokens";
import { useApp } from "../../context/AppContext";
import { ApiClient } from "../../api/client";
import { Icon } from "../../components/Icon";
import { Checkbox } from "../../components/ui";
import { BotonesOAuth } from "../../components/BotonesOAuth";
import { LegalModal } from "../../screens/LegalModal";
import { EDAD_MINIMA_ARRENDATARIO } from "../../legal/documentos";
import { showAlert } from "../../utils/alert";
import { traducirErrorAuth } from "../../utils/authErrors";
import {
  formatearTelefonoInput,
  normalizarTelefonoCompleto,
  formatearRutEnVivo,
} from "../../utils/formato";
import { supabase } from "../../api/supabase";

/**
 * Valida un RUT chileno con algoritmo oficial de Módulo 11.
 */
function validarRutChileno(rut) {
  if (!rut || typeof rut !== "string") return false;
  const limpio = rut.replace(/[^0-9kK]/g, "").toUpperCase();
  if (limpio.length < 8 || limpio.length > 9) return false;
  const cuerpo = limpio.slice(0, -1);
  const dv = limpio.slice(-1);
  let suma = 0;
  let multiplo = 2;
  for (let i = cuerpo.length - 1; i >= 0; i--) {
    suma += parseInt(cuerpo[i], 10) * multiplo;
    multiplo = multiplo === 7 ? 2 : multiplo + 1;
  }
  const esperado = 11 - (suma % 11);
  const dvEsperado = esperado === 11 ? "0" : esperado === 10 ? "K" : String(esperado);
  return dv === dvEsperado;
}

/**
 * Formatea fecha de nacimiento en DD/MM/AAAA en vivo.
 */
function formatearFechaNacimiento(texto) {
  const digitos = (texto || "").replace(/\D/g, "").slice(0, 8);
  if (digitos.length <= 2) return digitos;
  if (digitos.length <= 4) return `${digitos.slice(0, 2)}/${digitos.slice(2)}`;
  return `${digitos.slice(0, 2)}/${digitos.slice(2, 4)}/${digitos.slice(4)}`;
}

/**
 * Barra superior de progreso de 2 pasos para Arrendatario.
 */
function StepProgress({ pasoActual, totalPasos = 2, onBack }) {
  return (
    <View style={styles.stepHeader}>
      <TouchableOpacity
        onPress={onBack}
        style={styles.backBtn}
        hitSlop={theme.control.hitSlop}
        accessibilityRole="button"
        accessibilityLabel="Volver"
      >
        <Icon name="chevron-left" size={18} color={colors.primary700} strokeWidth={2} />
      </TouchableOpacity>
      <View style={styles.barsContainer}>
        <View
          style={[styles.progressBar, pasoActual >= 1 ? styles.barActive : styles.barInactive]}
        />
        <View
          style={[styles.progressBar, pasoActual >= 2 ? styles.barActive : styles.barInactive]}
        />
      </View>
      <Text style={styles.stepText}>
        Paso {pasoActual} de {totalPasos}
      </Text>
    </View>
  );
}

/**
 * Campo de texto en píldora con soporte de icono izquierdo y formato.
 */
const RenterField = React.forwardRef(function RenterField(
  {
    iconLeft,
    prefix,
    placeholder,
    value,
    onChangeText,
    secure = false,
    revealIcon = false,
    style,
    ...props
  },
  ref
) {
  const [showPass, setShowPass] = useState(!secure);
  return (
    <View style={[styles.fieldBox, style]}>
      {prefix ? <Text style={styles.prefixText}>{prefix}</Text> : null}
      {iconLeft ? (
        <View style={styles.fieldIconLeft}>
          <Icon name={iconLeft} size={18} color={colors.textMuted} strokeWidth={1.8} />
        </View>
      ) : null}
      <TextInput
        ref={ref}
        style={styles.fieldInput}
        placeholder={placeholder}
        placeholderTextColor="#9CA3AF"
        value={value}
        onChangeText={onChangeText}
        secureTextEntry={secure && !showPass}
        {...props}
      />
      {revealIcon ? (
        <TouchableOpacity
          style={styles.fieldRevealBtn}
          onPress={() => setShowPass((v) => !v)}
          hitSlop={theme.control.hitSlop}
        >
          <Icon name={showPass ? "eye-off" : "eye"} size={18} color={colors.textMuted} />
        </TouchableOpacity>
      ) : null}
    </View>
  );
});

/**
 * Flujo de Registro de Arrendatario en 2 Pasos:
 * - Paso 1: Todos los datos (Nombre, Apellido, Correo, Contraseña, RUT, Celular, Fecha, Términos).
 * - Paso 2: Verificación de código OTP de 6 dígitos enviado al correo.
 * - Éxito: "Cuenta creada" con resumen y botón "Empezar".
 */
export function RegisterScreen({ onNavigate, role = "renter" }) {
  const { register } = useApp();

  // "datos" (Paso 1), "codigo" (Paso 2), "exito"
  const [paso, setPaso] = useState("datos");
  const [loading, setLoading] = useState(false);
  const [avisoCorreoExistente, setAvisoCorreoExistente] = useState(false);
  const [documentoLegal, setDocumentoLegal] = useState(null);
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  // Formulario Paso 1
  const [form, setForm] = useState({
    nombre: "",
    apellido: "",
    email: "",
    password: "",
    rut: "",
    telefono: "",
    fechaNacimiento: "",
  });

  // OTP Paso 2
  const [codigoOtp, setCodigoOtp] = useState(["", "", "", "", "", ""]);
  const otpInputsRef = useRef([]);
  const [tiempoReenvio, setTiempoReenvio] = useState(45);

  // Refs de navegación de teclado
  const apellidoRef = useRef(null);
  const emailRef = useRef(null);
  const passwordRef = useRef(null);
  const rutRef = useRef(null);
  const telefonoRef = useRef(null);
  const fechaRef = useRef(null);

  const set = (campo) => (text) => {
    if (avisoCorreoExistente && campo === "email") setAvisoCorreoExistente(false);
    setForm((f) => ({ ...f, [campo]: text }));
  };

  // Cuenta regresiva del OTP
  useEffect(() => {
    if (paso !== "codigo" || tiempoReenvio <= 0) return;
    const timer = setInterval(() => {
      setTiempoReenvio((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [paso, tiempoReenvio]);

  // Validaciones en vivo
  const rutValido = form.rut.length >= 8 && validarRutChileno(form.rut);
  const passwordLargo = form.password.length >= 8;
  const passwordLetra = /[a-zA-Z]/.test(form.password);
  const passwordNumero = /[0-9]/.test(form.password);
  const passwordCompleta = passwordLargo && passwordLetra && passwordNumero;

  // Manejo de OTP
  const handleOtpChange = (index, value) => {
    const digitos = value.replace(/\D/g, "");
    if (digitos.length >= 6) {
      const nuevo = digitos.slice(0, 6).split("");
      setCodigoOtp(nuevo);
      otpInputsRef.current[5]?.focus();
      return;
    }
    const nuevo = [...codigoOtp];
    nuevo[index] = digitos.slice(-1);
    setCodigoOtp(nuevo);
    if (digitos && index < 5) {
      otpInputsRef.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyPress = (index, e) => {
    if (e.nativeEvent.key === "Backspace" && !codigoOtp[index] && index > 0) {
      const nuevo = [...codigoOtp];
      nuevo[index - 1] = "";
      setCodigoOtp(nuevo);
      otpInputsRef.current[index - 1]?.focus();
    }
  };

  // Acción Paso 1: Enviar datos y pasar a Paso 2 (Código)
  const handleEnviarDatos = async () => {
    if (loading) return;
    if (!form.nombre.trim() || !form.apellido.trim()) {
      showAlert("Campos requeridos", "Por favor ingresa tu nombre y apellido como aparecen en tu cédula.");
      return;
    }
    if (!form.email.trim() || !form.email.includes("@")) {
      showAlert("Correo requerido", "Por favor ingresa un correo electrónico válido.");
      return;
    }
    if (!passwordCompleta) {
      showAlert("Contraseña débil", "La contraseña debe tener al menos 8 caracteres, una letra y un número.");
      return;
    }
    if (!rutValido) {
      showAlert("RUT inválido", "Por favor ingresa un RUT chileno válido con su dígito verificador.");
      return;
    }
    const digitosTel = form.telefono.replace(/\D/g, "");
    if (!digitosTel || digitosTel.length < 8) {
      showAlert("Celular requerido", "Por favor ingresa un número de celular de 9 dígitos.");
      return;
    }
    if (!acceptedTerms) {
      showAlert(
        "Términos requeridos",
        `Debes aceptar los términos y condiciones y la política de privacidad, y declarar tener ${EDAD_MINIMA_ARRENDATARIO} años o más.`
      );
      return;
    }

    setLoading(true);
    try {
      await register(form.email.trim(), form.password, role);
      setPaso("codigo");
      setTiempoReenvio(45);
    } catch (err) {
      if (err.code === "already_registered") {
        setAvisoCorreoExistente(true);
      } else {
        showAlert("No se pudo crear la cuenta", traducirErrorAuth(err));
      }
    } finally {
      setLoading(false);
    }
  };

  // Acción Paso 2: Verificar código OTP
  const handleVerificarCodigo = async () => {
    const codigoCompleto = codigoOtp.join("");
    if (codigoCompleto.length < 6) {
      showAlert("Código incompleto", "Por favor ingresa los 6 dígitos enviados a tu correo.");
      return;
    }

    setLoading(true);
    try {
      let verif = await supabase.auth.verifyOtp({
        email: form.email.trim(),
        token: codigoCompleto,
        type: "signup",
      });
      if (verif.error) {
        verif = await supabase.auth.verifyOtp({
          email: form.email.trim(),
          token: codigoCompleto,
          type: "email",
        });
      }
      if (verif.error) throw verif.error;

      // Sincronizar perfil con los datos completados
      try {
        await ApiClient.actualizarPerfilBasico({
          nombre: `${form.nombre.trim()} ${form.apellido.trim()}`,
          rut: form.rut.trim(),
          telefono: normalizarTelefonoCompleto(form.telefono),
          fecha_nacimiento: form.fechaNacimiento.trim(),
        });
      } catch (err) {
        console.warn("[RegisterScreen] Error al actualizar perfil:", err.message);
      }

      setPaso("exito");
    } catch (err) {
      showAlert("Código inválido", "El código es incorrecto o ha expirado. Verifica tu correo o solicita uno nuevo.");
    } finally {
      setLoading(false);
    }
  };

  // Reenviar código OTP
  const handleReenviarCodigo = async () => {
    if (tiempoReenvio > 0 || loading) return;
    setLoading(true);
    try {
      await supabase.auth.resend({
        type: "signup",
        email: form.email.trim(),
      });
      setTiempoReenvio(45);
      showAlert("Código reenviado", `Hemos enviado un nuevo código a ${form.email.trim()}`);
    } catch (err) {
      showAlert("No se pudo reenviar", "Hubo un problema enviando el código. Inténtalo nuevamente.");
    } finally {
      setLoading(false);
    }
  };

  // PANTALLA ÉXITO: Cuenta creada
  if (paso === "exito") {
    return (
      <View style={styles.successContainer}>
        <StatusBar barStyle="dark-content" />
        <View style={styles.successCenter}>
          <View style={styles.successIconBox}>
            <Icon name="check" size={38} color="#10B981" strokeWidth={2.8} />
          </View>
          <Text style={styles.successTitle}>Cuenta creada</Text>
          <Text style={styles.successSubtitle}>
            Hola, {form.nombre.trim()}. Ya puedes buscar autos cerca de ti.
          </Text>

          <View style={styles.summaryCard}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Correo</Text>
              <Text style={styles.summaryVal}>{form.email.trim()}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Celular</Text>
              <Text style={styles.summaryVal}>+56 9 {form.telefono.trim()}</Text>
            </View>
            <View style={[styles.summaryRow, { borderBottomWidth: 0 }]}>
              <Text style={styles.summaryLabel}>RUT</Text>
              <Text style={styles.summaryVal}>{form.rut.trim()}</Text>
            </View>
          </View>
        </View>

        <TouchableOpacity
          style={styles.primaryBtn}
          onPress={() => onNavigate("login")}
          activeOpacity={0.85}
        >
          <Text style={styles.primaryBtnText}>Empezar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // PANTALLA PASO 2: Confirmación por código de correo
  if (paso === "codigo") {
    return (
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <StatusBar barStyle="dark-content" />
        <StepProgress pasoActual={2} totalPasos={2} onBack={() => setPaso("datos")} />

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.otpContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.otpHeaderBox}>
            <View style={styles.otpMailCircle}>
              <Icon name="mail" size={36} color="#0F3D3E" strokeWidth={1.8} />
            </View>

            <Text style={styles.otpTitle}>Revisa tu correo</Text>
            <Text style={styles.otpSubtitle}>
              Enviamos un código de 6 dígitos a{"\n"}
              <Text style={styles.otpEmailText}>{form.email.trim()}</Text>
            </Text>

            {/* 6 Casillas de código OTP */}
            <View style={styles.otpRow}>
              {codigoOtp.map((digito, idx) => (
                <TextInput
                  key={idx}
                  ref={(el) => (otpInputsRef.current[idx] = el)}
                  style={[
                    styles.otpBox,
                    digito ? styles.otpBoxFilled : styles.otpBoxEmpty,
                  ]}
                  value={digito}
                  onChangeText={(val) => handleOtpChange(idx, val)}
                  onKeyPress={(e) => handleOtpKeyPress(idx, e)}
                  keyboardType="number-pad"
                  maxLength={6}
                  selectTextOnFocus
                />
              ))}
            </View>

            <TouchableOpacity
              style={[styles.primaryBtn, loading && { opacity: 0.7 }]}
              onPress={handleVerificarCodigo}
              disabled={loading}
              activeOpacity={0.85}
            >
              <Text style={styles.primaryBtnText}>
                {loading ? "Verificando..." : "Verificar"}
              </Text>
            </TouchableOpacity>

            <View style={styles.resendBox}>
              {tiempoReenvio > 0 ? (
                <Text style={styles.resendTimerText}>
                  Reenviar código en 0:{tiempoReenvio < 10 ? `0${tiempoReenvio}` : tiempoReenvio}
                </Text>
              ) : (
                <TouchableOpacity onPress={handleReenviarCodigo} disabled={loading}>
                  <Text style={styles.resendBtnText}>Reenviar código</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          <TouchableOpacity
            style={styles.changeMailBtn}
            onPress={() => setPaso("datos")}
          >
            <Text style={styles.changeMailText}>
              ¿Correo equivocado?{" "}
              <Text style={styles.changeMailLink}>Cambiarlo</Text>
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // PANTALLA PASO 1: Todos los datos
  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <StatusBar barStyle="dark-content" />
      <StepProgress pasoActual={1} totalPasos={2} onBack={() => onNavigate("login")} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.mainTitle}>Crea tu cuenta</Text>
        <Text style={styles.mainSubtitle}>Escribe tus datos como aparecen en tu cédula.</Text>

        {/* Alerta de correo existente */}
        {avisoCorreoExistente ? (
          <View style={styles.alertBox}>
            <Text style={styles.alertTitle}>Ese correo ya tiene una cuenta</Text>
            <Text style={styles.alertDesc}>
              ¿Eres tú? Inicia sesión o cambia tu contraseña.
            </Text>
            <TouchableOpacity
              style={styles.alertLinkBtn}
              onPress={() => onNavigate("login")}
            >
              <Text style={styles.alertLinkText}>Ir a iniciar sesión</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {/* Fila Nombre y Apellido */}
        <View style={styles.row}>
          <RenterField
            style={{ flex: 1 }}
            placeholder="Nombre"
            value={form.nombre}
            onChangeText={set("nombre")}
            autoCapitalize="words"
            returnKeyType="next"
            blurOnSubmit={false}
            onSubmitEditing={() => apellidoRef.current?.focus()}
          />
          <RenterField
            ref={apellidoRef}
            style={{ flex: 1 }}
            placeholder="Apellido"
            value={form.apellido}
            onChangeText={set("apellido")}
            autoCapitalize="words"
            returnKeyType="next"
            blurOnSubmit={false}
            onSubmitEditing={() => emailRef.current?.focus()}
          />
        </View>

        {/* Correo */}
        <RenterField
          ref={emailRef}
          iconLeft="mail"
          placeholder="Correo electrónico"
          value={form.email}
          onChangeText={set("email")}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          returnKeyType="next"
          blurOnSubmit={false}
          onSubmitEditing={() => passwordRef.current?.focus()}
        />

        {/* Contraseña */}
        <RenterField
          ref={passwordRef}
          iconLeft="lock"
          placeholder="Contraseña"
          value={form.password}
          onChangeText={set("password")}
          secure
          revealIcon
          returnKeyType="next"
          blurOnSubmit={false}
          onSubmitEditing={() => rutRef.current?.focus()}
        />

        {/* Chips de validación de contraseña */}
        <View style={styles.chipsRow}>
          <View style={[styles.chip, passwordLargo ? styles.chipValid : styles.chipIdle]}>
            <Text style={[styles.chipText, passwordLargo ? styles.chipTextValid : styles.chipTextIdle]}>
              {passwordLargo ? "✓ " : ""}8 o más caracteres
            </Text>
          </View>
          <View style={[styles.chip, passwordLetra ? styles.chipValid : styles.chipIdle]}>
            <Text style={[styles.chipText, passwordLetra ? styles.chipTextValid : styles.chipTextIdle]}>
              {passwordLetra ? "✓ " : ""}Una letra
            </Text>
          </View>
          <View style={[styles.chip, passwordNumero ? styles.chipValid : styles.chipIdle]}>
            <Text style={[styles.chipText, passwordNumero ? styles.chipTextValid : styles.chipTextIdle]}>
              {passwordNumero ? "✓ " : ""}Un número
            </Text>
          </View>
        </View>

        {/* RUT */}
        <View>
          <RenterField
            ref={rutRef}
            iconLeft="user"
            placeholder="12.345.678-5"
            value={form.rut}
            onChangeText={(txt) => set("rut")(formatearRutEnVivo(txt))}
            autoCapitalize="characters"
            maxLength={12}
            returnKeyType="next"
            blurOnSubmit={false}
            onSubmitEditing={() => telefonoRef.current?.focus()}
          />
          {rutValido ? (
            <Text style={styles.validText}>✓ RUT válido</Text>
          ) : form.rut.length >= 8 ? (
            <Text style={styles.errorText}>
              El RUT no es válido. Revisa el número y el dígito después del guión.
            </Text>
          ) : null}
        </View>

        {/* Celular con prefijo +56 */}
        <RenterField
          ref={telefonoRef}
          prefix="+56"
          placeholder="9 1234 5678"
          value={form.telefono}
          onChangeText={set("telefono")}
          format={formatearTelefonoInput}
          maxLength={11}
          keyboardType="phone-pad"
          returnKeyType="next"
          blurOnSubmit={false}
          onSubmitEditing={() => fechaRef.current?.focus()}
        />

        {/* Fecha de nacimiento */}
        <RenterField
          ref={fechaRef}
          iconLeft="calendar"
          placeholder="DD/MM/AAAA"
          value={form.fechaNacimiento}
          onChangeText={(txt) => set("fechaNacimiento")(formatearFechaNacimiento(txt))}
          maxLength={10}
          keyboardType="numeric"
          returnKeyType="done"
        />

        {/* Términos y privacidad */}
        <View style={styles.termsRow}>
          <Checkbox
            checked={acceptedTerms}
            onToggle={() => setAcceptedTerms((v) => !v)}
          />
          <Text style={styles.termsText}>
            Acepto los{" "}
            <Text
              style={styles.termsLink}
              onPress={() => setDocumentoLegal("terminos")}
            >
              Términos de uso
            </Text>{" "}
            y la{" "}
            <Text
              style={styles.termsLink}
              onPress={() => setDocumentoLegal("privacidad")}
            >
              Política de privacidad
            </Text>
            .
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.primaryBtn, loading && { opacity: 0.7 }]}
          onPress={handleEnviarDatos}
          disabled={loading}
          activeOpacity={0.85}
        >
          <Text style={styles.primaryBtnText}>
            {loading ? "Creando cuenta..." : "Crear cuenta"}
          </Text>
        </TouchableOpacity>

        <View style={styles.dividerBox}>
          <Text style={styles.dividerText}>o regístrate con</Text>
        </View>

        <BotonesOAuth preferredMode="renter" compact />

        <TouchableOpacity
          style={styles.footerLinkBtn}
          onPress={() => onNavigate("login")}
        >
          <Text style={styles.footerLinkText}>
            ¿Ya tienes cuenta? <Text style={styles.footerLinkBold}>Entrar</Text>
          </Text>
        </TouchableOpacity>
      </ScrollView>

      <LegalModal
        visible={!!documentoLegal}
        doc={documentoLegal || "terminos"}
        onClose={() => setDocumentoLegal(null)}
        onAccept={() => setAcceptedTerms(true)}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FAFAF9",
  },
  stepHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: Platform.OS === "android" ? 14 : 10,
    paddingBottom: 10,
    backgroundColor: "#FAFAF9",
  },
  backBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },
  barsContainer: {
    flexDirection: "row",
    flex: 1,
    marginHorizontal: 14,
    gap: 8,
  },
  progressBar: {
    height: 4,
    flex: 1,
    borderRadius: 2,
  },
  barActive: {
    backgroundColor: "#2DD4BF",
  },
  barInactive: {
    backgroundColor: "#E5E7EB",
  },
  stepText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6B7280",
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 36,
    gap: 14,
  },
  mainTitle: {
    fontSize: 26,
    fontWeight: "800",
    color: "#0F3D3E",
    letterSpacing: -0.3,
  },
  mainSubtitle: {
    fontSize: 14,
    color: "#6B7280",
    marginTop: -8,
    marginBottom: 4,
  },
  row: {
    flexDirection: "row",
    gap: 12,
  },
  fieldBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1.2,
    borderColor: "#E5E7EB",
    borderRadius: 14,
    paddingHorizontal: 14,
    minHeight: 52,
  },
  fieldInput: {
    flex: 1,
    fontSize: 15,
    color: "#1F2937",
    paddingVertical: 10,
  },
  prefixText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#1F2937",
    marginRight: 6,
  },
  fieldIconLeft: {
    marginRight: 10,
  },
  fieldRevealBtn: {
    padding: 4,
  },
  chipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: -4,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
  },
  chipValid: {
    backgroundColor: "#E4F8F2",
    borderColor: "#A7F3D0",
  },
  chipIdle: {
    backgroundColor: "#F3F4F6",
    borderColor: "#E5E7EB",
  },
  chipText: {
    fontSize: 11.5,
    fontWeight: "600",
  },
  chipTextValid: {
    color: "#0F766E",
  },
  chipTextIdle: {
    color: "#6B7280",
  },
  validText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#0F766E",
    marginTop: 4,
    paddingHorizontal: 4,
  },
  errorText: {
    fontSize: 12,
    color: "#DC2626",
    marginTop: 4,
    paddingHorizontal: 4,
  },
  alertBox: {
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECACA",
    borderRadius: 14,
    padding: 14,
    gap: 4,
  },
  alertTitle: {
    fontSize: 13.5,
    fontWeight: "700",
    color: "#B91C1C",
  },
  alertDesc: {
    fontSize: 12.5,
    color: "#991B1B",
    lineHeight: 17,
  },
  alertLinkBtn: {
    marginTop: 4,
    alignSelf: "flex-start",
  },
  alertLinkText: {
    fontSize: 12.5,
    fontWeight: "700",
    color: "#991B1B",
    textDecorationLine: "underline",
  },
  termsRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    paddingTop: 4,
  },
  termsText: {
    flex: 1,
    fontSize: 12.5,
    color: "#6B7280",
    lineHeight: 18,
  },
  termsLink: {
    color: "#0F3D3E",
    fontWeight: "700",
    textDecorationLine: "underline",
  },
  primaryBtn: {
    backgroundColor: "#0F3D3E",
    borderRadius: 14,
    minHeight: 52,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 6,
    width: "100%",
  },
  primaryBtnText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  dividerBox: {
    alignItems: "center",
    marginVertical: 4,
  },
  dividerText: {
    fontSize: 12,
    fontWeight: "500",
    color: "#9CA3AF",
  },
  footerLinkBtn: {
    height: 42,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  footerLinkText: {
    fontSize: 13.5,
    color: "#6B7280",
  },
  footerLinkBold: {
    color: "#0F3D3E",
    fontWeight: "700",
  },
  // Paso 2 (OTP)
  otpContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 36,
    justifyContent: "space-between",
  },
  otpHeaderBox: {
    alignItems: "center",
    width: "100%",
  },
  otpMailCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: "#E4F8F2",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  otpTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: "#0F3D3E",
    textAlign: "center",
    marginBottom: 8,
  },
  otpSubtitle: {
    fontSize: 14,
    color: "#6B7280",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 28,
  },
  otpEmailText: {
    fontWeight: "700",
    color: "#0F3D3E",
  },
  otpRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
    maxWidth: 320,
    marginBottom: 28,
    gap: 8,
  },
  otpBox: {
    width: 46,
    height: 54,
    borderRadius: 12,
    textAlign: "center",
    fontSize: 22,
    fontWeight: "700",
    borderWidth: 1.5,
  },
  otpBoxFilled: {
    borderColor: "#2DD4BF",
    backgroundColor: "#FFFFFF",
    color: "#0F3D3E",
  },
  otpBoxEmpty: {
    borderColor: "#E5E7EB",
    backgroundColor: "#F9FAFB",
    color: "#0F3D3E",
  },
  resendBox: {
    marginTop: 18,
    alignItems: "center",
  },
  resendTimerText: {
    fontSize: 13.5,
    color: "#6B7280",
  },
  resendBtnText: {
    fontSize: 13.5,
    fontWeight: "700",
    color: "#0F3D3E",
  },
  changeMailBtn: {
    alignItems: "center",
    paddingVertical: 10,
  },
  changeMailText: {
    fontSize: 13.5,
    color: "#6B7280",
  },
  changeMailLink: {
    fontWeight: "700",
    color: "#0F3D3E",
  },
  // Éxito
  successContainer: {
    flex: 1,
    backgroundColor: "#FAFAF9",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingTop: 56,
    paddingBottom: 40,
  },
  successCenter: {
    alignItems: "center",
    width: "100%",
  },
  successIconBox: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#E4F8F2",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  successTitle: {
    fontSize: 25,
    fontWeight: "800",
    color: "#0F3D3E",
    textAlign: "center",
    marginBottom: 8,
  },
  successSubtitle: {
    fontSize: 14,
    color: "#6B7280",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 28,
  },
  summaryCard: {
    width: "100%",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    padding: 18,
    gap: 12,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  summaryLabel: {
    fontSize: 13,
    color: "#6B7280",
    fontWeight: "500",
  },
  summaryVal: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0F3D3E",
  },
});
