import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  SafeAreaView,
  StatusBar,
} from "react-native";
import { colors } from "../../../theme/colors";
import { useApp } from "../../../context/AppContext";
import { Icon } from "../../../shared/components/Icon";

export function LoginScreen({ onNavigate }) {
  const { login, setMode } = useApp();
  const [identifier, setIdentifier] = useState("rodrigo.munoz@gmail.com");
  const [password, setPassword] = useState("password123");
  const [showPassword, setShowPassword] = useState(false);
  const [loginRole, setLoginRole] = useState("pasajero"); // 'pasajero' | 'conductor'

  const handleLogin = () => {
    if (!identifier.trim() || !password.trim()) {
      Alert.alert("Campos requeridos", "Ingresa tu correo o RUT y tu contraseña.");
      return;
    }
    setMode(loginRole);
    login(identifier, password, loginRole);
    onNavigate("main");
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

        {/* Role Selector Pill */}
        <View style={styles.roleToggleGroup}>
          <TouchableOpacity
            style={[
              styles.roleToggleBtn,
              loginRole === "pasajero" && styles.roleToggleBtnActive,
            ]}
            onPress={() => setLoginRole("pasajero")}
            activeOpacity={0.85}
          >
            <Icon
              name="key"
              size={15}
              color={loginRole === "pasajero" ? colors.primary : colors.textMuted}
              style={{ marginRight: 6 }}
            />
            <Text
              style={[
                styles.roleToggleText,
                loginRole === "pasajero" && styles.roleToggleTextActive,
              ]}
            >
              Arrendatario
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.roleToggleBtn,
              loginRole === "conductor" && styles.roleToggleBtnActive,
            ]}
            onPress={() => setLoginRole("conductor")}
            activeOpacity={0.85}
          >
            <Icon
              name="car"
              size={15}
              color={loginRole === "conductor" ? colors.primary : colors.textMuted}
              style={{ marginRight: 6 }}
            />
            <Text
              style={[
                styles.roleToggleText,
                loginRole === "conductor" && styles.roleToggleTextActive,
              ]}
            >
              Dueño
            </Text>
          </TouchableOpacity>
        </View>

        {/* Form Fields */}
        <View style={styles.formGroup}>
          <Text style={styles.fieldLabel}>CORREO O RUT</Text>
          <View style={styles.inputBox}>
            <TextInput
              style={styles.textInput}
              value={identifier}
              onChangeText={setIdentifier}
              placeholder="rodrigo.munoz@gmail.com o 14.234.567-8"
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
      </ScrollView>

      {/* Bottom CTA */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={styles.primaryBtn}
          onPress={handleLogin}
          activeOpacity={0.85}
        >
          <Text style={styles.primaryBtnText}>
            Entrar como {loginRole === "conductor" ? "Dueño" : "Arrendatario"}
          </Text>
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
  roleToggleGroup: {
    flexDirection: "row",
    backgroundColor: colors.primary100,
    borderRadius: 12,
    padding: 4,
    gap: 4,
  },
  roleToggleBtn: {
    flex: 1,
    height: 44,
    borderRadius: 9,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  roleToggleBtnActive: {
    backgroundColor: colors.surface,
    boxShadow: "0 1px 3px rgba(15, 61, 62, 0.08)",
  },
  roleToggleText: {
    fontSize: 14,
    color: colors.textMuted,
  },
  roleToggleTextActive: {
    color: colors.primary,
    fontWeight: "600",
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
