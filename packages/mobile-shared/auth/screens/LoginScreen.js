import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, StatusBar } from "react-native";
import { colors } from "../../theme/colors";
import { theme } from "../../theme/tokens";
import { useApp } from "../../context/AppContext";
import { BrandLogo } from "../../components/BrandLogo";
import { Button, Field, ScreenHeader, BottomBar } from "../../components/ui";
import { showAlert } from "../../utils/alert";
import { traducirErrorAuth } from "../../utils/authErrors";

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
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      showAlert("Campos requeridos", "Ingresa tu correo y tu contraseña.");
      return;
    }
    setLoading(true);
    try {
      await login(email.trim(), password);
    } catch (err) {
      showAlert("No se pudo iniciar sesión", traducirErrorAuth(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />

      <ScreenHeader title="Iniciar sesión" onBack={() => onNavigate("welcome")} />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.logoBox}>
          <BrandLogo size={64} />
          <Text style={styles.logoTitle}>Arriendo Mi Auto Ya</Text>
        </View>

        <Field
          label="Correo"
          value={email}
          onChangeText={setEmail}
          placeholder="nombre@correo.com"
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
        />

        <Field
          label="Contraseña"
          value={password}
          onChangeText={setPassword}
          placeholder="••••••••••"
          secure
          autoComplete="password"
        />

        <TouchableOpacity
          style={styles.forgotLink}
          onPress={() => onNavigate("forgot")}
          activeOpacity={0.7}
          hitSlop={theme.control.hitSlop}
        >
          <Text style={styles.forgotLinkText}>¿Olvidaste tu contraseña?</Text>
        </TouchableOpacity>
      </ScrollView>

      <BottomBar>
        <Button label="Entrar" onPress={handleLogin} loading={loading} />

        <TouchableOpacity
          style={styles.registerLink}
          onPress={() => onNavigate("register")}
          activeOpacity={0.7}
        >
          <Text style={styles.registerLinkText}>
            ¿No tienes cuenta? <Text style={styles.registerLinkHighlight}>Crear cuenta</Text>
          </Text>
        </TouchableOpacity>
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
  content: {
    padding: theme.spacing.screen,
    gap: theme.spacing.xl,
  },
  logoBox: {
    alignItems: "center",
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.xs,
  },
  logoTitle: {
    ...theme.typography.title,
    color: colors.primary,
  },
  forgotLink: {
    alignSelf: "flex-start",
    paddingVertical: theme.spacing.xs,
  },
  forgotLinkText: {
    ...theme.typography.bodyStrong,
    color: colors.accent700,
  },
  registerLink: {
    height: theme.control.heightSm,
    alignItems: "center",
    justifyContent: "center",
  },
  registerLinkText: {
    ...theme.typography.callout,
    color: colors.textMuted,
  },
  registerLinkHighlight: {
    color: colors.accent700,
    fontWeight: "600",
  },
});
