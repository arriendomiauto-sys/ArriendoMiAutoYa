import React, { useState } from "react";
import { View, StyleSheet, StatusBar } from "react-native";
import { colors } from "../theme/colors";
import { theme } from "../theme/tokens";
import { Button, EmptyState } from "../components/ui";
import { LoginScreen } from "./screens/LoginScreen";
import { RegisterScreen } from "./screens/RegisterScreen";
import { ForgotPasswordScreen } from "./screens/ForgotPasswordScreen";

/**
 * Orquestador del flujo de autenticación.
 *
 * Arranca directo en el login: la pantalla de carga (`ArranqueGate`) ya revisó
 * la sesión antes de llegar acá, así que no hay splash propio, ni onboarding, ni
 * pantalla de bienvenida. Desde el login se va a crear cuenta o a recuperar la
 * contraseña, y de ahí se vuelve al login.
 *
 * No recibe `onAuthSuccess`: nada por encima de <AuthFlow /> necesita un
 * callback, porque useApp().isLoggedIn (reactivo) es lo que determina cuándo el
 * componente padre deja de renderizar este flujo.
 *
 * La verificación de identidad (KYC) NO es parte de este flujo: la cuenta se
 * crea simple y el KYC se pide más adelante, dentro de la app, justo cuando el
 * usuario intenta publicar o reservar un auto de verdad.
 */
export function AuthFlow({ fixedRole }) {
  // 'login' -> 'register' -> 'confirm_email' (solo si el registro no devolvió
  // sesión activa) | 'forgot'
  const [step, setStep] = useState("login");

  // Rol de la app: 'renter' (arrendar) | 'owner' (publicar). Las apps separadas
  // lo traen fijo en `fixedRole`.
  const role = fixedRole || "renter";

  if (step === "register") {
    return (
      <RegisterScreen
        role={role}
        onNavigate={(screen) => {
          if (screen === "welcome" || screen === "login") setStep("login");
          else if (screen === "confirm_email") setStep("confirm_email");
        }}
      />
    );
  }

  if (step === "confirm_email") {
    return (
      <View style={styles.confirmContainer}>
        <StatusBar barStyle="dark-content" />
        <View style={styles.confirmCenter}>
          <EmptyState
            icon="chat"
            title="Confirma tu correo"
            message="Te enviamos un enlace de confirmación a tu correo. Ábrelo para activar tu cuenta y luego vuelve a iniciar sesión."
          />
        </View>
        <Button label="Ir a Iniciar sesión" onPress={() => setStep("login")} />
      </View>
    );
  }

  if (step === "forgot") {
    return <ForgotPasswordScreen onNavigate={(screen) => setStep(screen)} />;
  }

  return (
    <LoginScreen
      onNavigate={(screen) => {
        if (screen === "register") setStep("register");
        else if (screen === "forgot") setStep("forgot");
      }}
    />
  );
}

const styles = StyleSheet.create({
  confirmContainer: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: "space-between",
    paddingHorizontal: theme.spacing.xxl,
    paddingVertical: 34,
  },
  confirmCenter: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
