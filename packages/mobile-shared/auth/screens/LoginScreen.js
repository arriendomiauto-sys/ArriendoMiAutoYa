import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
} from "react-native";
import { colors } from "../../theme/colors";
import { useApp } from "../../context/AppContext";
import { Icon } from "../../components/Icon";
import { showAlert } from "../../utils/alert";

// El login ya no tiene un selector de rol: AppContext determina quién es el
// usuario a partir de su token de sesión, sin importar en qué app inició.
//
// La cuenta se crea simple, así que un login exitoso no necesita revisar
// si el KYC está completo: el componente padre de la app deja de mostrar
// <AuthFlow /> apenas useApp().isLoggedIn lo refleje, sin importar el
// estado de verificación de identidad — eso se pide recién cuando el
// usuario intenta reservar o publicar un auto de verdad.
export function LoginScreen({ onNavigate }) {
  const { login } = useApp();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      showAlert("Campos requeridos", "Ingresa tu correo y tu contraseña.");
      return;
    }
    setLoading(true);
    try {
      await login(email, password);
    } catch (err) {
      showAlert("No se pudo iniciar sesión", err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => onNavigate("welcome")}
          activeOpacity={0.7}
        >
          <Icon name="arrow-left" size={20} color={colors.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Iniciar sesión</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Brand Icon */}
        <View style={styles.logoBox}>
          <Icon name="key" size={44} color={colors.primary} />
          <Text style={styles.logoTitle}>Arriendo Mi Auto Ya</Text>
        </View>

        {/* Form Fields */}
        <View style={styles.formGroup}>
          <Text style={styles.fieldLabel}>CORREO</Text>
          <View style={styles.inputBox}>
            <TextInput
              style={styles.textInput}
              value={email}
              onChangeText={setEmail}
              placeholder="nombre@correo.com"
              placeholderTextColor={colors.textPlaceholder}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.fieldLabel}>CONTRASEÑA</Text>
          <View style={styles.passwordInputBox}>
            <TextInput
              style={styles.passwordInput}
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••••"
              placeholderTextColor={colors.textPlaceholder}
              secureTextEntry={!showPassword}
            />
            <TouchableOpacity
              onPress={() => setShowPassword(!showPassword)}
              activeOpacity={0.7}
            >
              <Text style={styles.showPassText}>
                {showPassword ? "Ocultar" : "Ver"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity
          style={styles.forgotLink}
          onPress={() => onNavigate("forgot")}
          activeOpacity={0.7}
        >
          <Text style={styles.forgotLinkText}>¿Olvidaste tu contraseña?</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Bottom CTA */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={[styles.primaryBtn, loading && styles.btnDisabled]}
          onPress={handleLogin}
          activeOpacity={0.85}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.primaryBtnText}>Entrar</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.registerLink}
          onPress={() => onNavigate("register")}
          activeOpacity={0.7}
        >
          <Text style={styles.registerLinkText}>
            ¿No tienes cuenta? <Text style={styles.registerLinkHighlight}>Crear cuenta</Text>
          </Text>
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
  header: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: colors.text,
  },
  content: {
    padding: 20,
    gap: 20,
  },
  logoBox: {
    alignItems: "center",
    gap: 10,
    marginTop: 10,
    marginBottom: 8,
  },
  logoTitle: {
    fontSize: 22,
    fontWeight: "600",
    letterSpacing: -0.4,
    color: colors.primary,
  },
  formGroup: {
    gap: 6,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.8,
    color: colors.textMuted,
    textTransform: "uppercase",
  },
  inputBox: {
    height: 52,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: colors.surface,
    paddingHorizontal: 16,
    justifyContent: "center",
  },
  textInput: {
    fontSize: 16,
    color: colors.text,
  },
  passwordInputBox: {
    height: 52,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: colors.surface,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
  },
  passwordInput: {
    flex: 1,
    fontSize: 16,
    color: colors.text,
  },
  showPassText: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.accent700,
  },
  forgotLink: {
    alignSelf: "flex-start",
    paddingVertical: 4,
  },
  forgotLinkText: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.accent700,
  },
  bottomBar: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 34,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: 12,
  },
  primaryBtn: {
    height: 56,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  btnDisabled: {
    opacity: 0.6,
  },
  primaryBtnText: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "600",
  },
  registerLink: {
    height: 38,
    alignItems: "center",
    justifyContent: "center",
  },
  registerLinkText: {
    fontSize: 14,
    color: colors.textMuted,
  },
  registerLinkHighlight: {
    color: colors.accent700,
    fontWeight: "600",
  },
});
