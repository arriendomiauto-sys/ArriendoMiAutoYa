import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  StatusBar,
} from "react-native";
import { colors } from "../../theme/colors";
import { Icon } from "../../components/Icon";
import { showAlert } from "../../utils/alert";

export function ForgotPasswordScreen({ onNavigate }) {
  const [step, setStep] = useState(1);
  const [emailOrRut, setEmailOrRut] = useState("carlos@arriendatuauto.cl");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSendOtp = () => {
    if (!emailOrRut) {
      showAlert("Campo Requerido", "Ingresa tu email o RUT registrado.");
      return;
    }
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setStep(2);
      showAlert(
        "Código Enviado",
        "Hemos enviado un código SMS de 4 dígitos a tu número registrado (+56 9 **** 4321)."
      );
    }, 600);
  };

  const handleVerifyOtp = () => {
    if (otp.length < 4) {
      showAlert("Código Incompleto", "Ingresa el código de 4 dígitos.");
      return;
    }
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setStep(3);
    }, 500);
  };

  const handleResetPassword = () => {
    if (!newPassword || newPassword.length < 6) {
      showAlert("Contraseña Débil", "La nueva clave debe tener al menos 6 caracteres.");
      return;
    }
    if (newPassword !== confirmPassword) {
      showAlert("Error", "Las contraseñas no coinciden.");
      return;
    }

    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setStep(4);
    }, 600);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <StatusBar barStyle="light-content" />

      {/* Botón Volver */}
      <TouchableOpacity style={styles.backBtn} onPress={() => onNavigate("login")}>
        <Text style={styles.backBtnText}>← Volver</Text>
      </TouchableOpacity>

      <View style={styles.headerBox}>
        <Text style={styles.title}>Recuperar Clave</Text>
        <Text style={styles.subtitle}>
          Restablece el acceso seguro a tu cuenta
        </Text>
      </View>

      {/* Stepper */}
      <View style={styles.stepIndicatorRow}>
        <View style={[styles.stepDot, step >= 1 && styles.stepDotActive]}>
          <Text style={styles.stepDotText}>1</Text>
        </View>
        <View style={[styles.stepLine, step >= 2 && styles.stepLineActive]} />
        <View style={[styles.stepDot, step >= 2 && styles.stepDotActive]}>
          <Text style={styles.stepDotText}>2</Text>
        </View>
        <View style={[styles.stepLine, step >= 3 && styles.stepLineActive]} />
        <View style={[styles.stepDot, step >= 3 && styles.stepDotActive]}>
          <Text style={styles.stepDotText}>3</Text>
        </View>
      </View>

      {/* PASO 1 */}
      {step === 1 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Paso 1: Identificación de Cuenta</Text>
          <Text style={styles.cardDesc}>
            Ingresa el correo electrónico o RUT asociado a tu cuenta para recibir el código SMS.
          </Text>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Email o RUT Registrado</Text>
            <TextInput
              style={styles.input}
              placeholder="ej. carlos@arriendatuauto.cl o 15.892.341-6"
              placeholderTextColor={colors.textMuted}
              value={emailOrRut}
              onChangeText={setEmailOrRut}
              autoCapitalize="none"
            />
          </View>

          <TouchableOpacity
            style={[styles.primaryBtn, loading && styles.btnDisabled]}
            onPress={handleSendOtp}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={colors.dark} />
            ) : (
              <Text style={styles.primaryBtnText}>Enviar Código SMS →</Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* PASO 2 */}
      {step === 2 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Paso 2: Código de Verificación</Text>
          <Text style={styles.cardDesc}>
            Ingresa el código de 4 dígitos enviado por SMS a tu teléfono.
          </Text>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Código SMS de 4 dígitos</Text>
            <TextInput
              style={[styles.input, styles.otpInput]}
              placeholder="1 2 3 4"
              placeholderTextColor={colors.textMuted}
              value={otp}
              onChangeText={setOtp}
              keyboardType="number-pad"
              maxLength={4}
            />
          </View>

          <TouchableOpacity
            style={[styles.primaryBtn, loading && styles.btnDisabled]}
            onPress={handleVerifyOtp}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={colors.dark} />
            ) : (
              <Text style={styles.primaryBtnText}>Verificar Código →</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={styles.resendBtn} onPress={handleSendOtp}>
            <Text style={styles.resendText}>Reenviar código SMS</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* PASO 3 */}
      {step === 3 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Paso 3: Nueva Contraseña</Text>
          <Text style={styles.cardDesc}>
            Crea una clave segura de al menos 6 caracteres.
          </Text>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Nueva Contraseña</Text>
            <TextInput
              style={styles.input}
              placeholder="Mínimo 6 caracteres"
              placeholderTextColor={colors.textMuted}
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Confirmar Contraseña</Text>
            <TextInput
              style={styles.input}
              placeholder="Repite la clave"
              placeholderTextColor={colors.textMuted}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
            />
          </View>

          <TouchableOpacity
            style={[styles.primaryBtn, loading && styles.btnDisabled]}
            onPress={handleResetPassword}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={colors.dark} />
            ) : (
              <Text style={styles.primaryBtnText}>Guardar Nueva Clave</Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* PASO 4: ÉXITO */}
      {step === 4 && (
        <View style={[styles.card, styles.successCard]}>
          <View style={styles.successIconCircle}>
            <Icon name="check" size={24} color={colors.accent} />
          </View>
          <Text style={styles.successTitle}>Contraseña Actualizada</Text>
          <Text style={styles.successDesc}>
            Tu clave ha sido restablecida exitosamente. Ya puedes ingresar con tu nueva credencial.
          </Text>

          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => onNavigate("login")}
          >
            <Text style={styles.primaryBtnText}>Ir al Inicio de Sesión →</Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.darkBg,
  },
  content: {
    padding: 20,
    paddingTop: 50,
    paddingBottom: 40,
  },
  backBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: colors.darkCard,
    alignSelf: "flex-start",
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.darkBorder,
  },
  backBtnText: {
    color: colors.textSilver,
    fontSize: 12,
    fontWeight: "700",
  },
  headerBox: {
    marginBottom: 18,
  },
  title: {
    fontSize: 22,
    fontWeight: "900",
    color: colors.textWhite,
  },
  subtitle: {
    fontSize: 12,
    color: colors.textSilver,
    marginTop: 3,
  },
  stepIndicatorRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  stepDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.darkCardHover,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.darkBorder,
  },
  stepDotActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  stepDotText: {
    fontSize: 11,
    fontWeight: "800",
    color: colors.dark,
  },
  stepLine: {
    width: 36,
    height: 2,
    backgroundColor: colors.darkBorder,
    marginHorizontal: 4,
  },
  stepLineActive: {
    backgroundColor: colors.accent,
  },
  card: {
    backgroundColor: colors.darkCard,
    borderRadius: 14,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.darkBorder,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: colors.textWhite,
    marginBottom: 4,
  },
  cardDesc: {
    fontSize: 11,
    color: colors.textSilver,
    lineHeight: 15,
    marginBottom: 14,
  },
  inputGroup: {
    marginBottom: 12,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.textSilver,
    marginBottom: 4,
  },
  input: {
    backgroundColor: colors.darkCardHover,
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 44,
    color: colors.textWhite,
    borderWidth: 1,
    borderColor: colors.darkBorder,
    fontSize: 13,
  },
  otpInput: {
    textAlign: "center",
    letterSpacing: 8,
    fontSize: 18,
    fontWeight: "900",
  },
  primaryBtn: {
    backgroundColor: colors.accent,
    paddingVertical: 13,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 4,
  },
  btnDisabled: {
    opacity: 0.5,
  },
  primaryBtnText: {
    color: colors.dark,
    fontSize: 14,
    fontWeight: "800",
  },
  resendBtn: {
    marginTop: 12,
    alignItems: "center",
  },
  resendText: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: "700",
  },
  successCard: {
    alignItems: "center",
    paddingVertical: 28,
  },
  successIconCircle: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: colors.accentMuted,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
    borderWidth: 1.5,
    borderColor: colors.accent,
  },
  successTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: colors.textWhite,
    marginBottom: 6,
  },
  successDesc: {
    fontSize: 12,
    color: colors.textSilver,
    textAlign: "center",
    lineHeight: 17,
    marginBottom: 18,
    paddingHorizontal: 10,
  },
});
