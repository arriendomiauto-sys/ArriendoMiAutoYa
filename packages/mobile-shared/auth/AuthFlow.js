import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, StatusBar } from "react-native";
import { colors } from "../theme/colors";
import { Icon } from "../components/Icon";
import { SplashScreen } from "./screens/SplashScreen";
import { OnboardingScreen } from "./screens/OnboardingScreen";
import { WelcomeScreen } from "./screens/WelcomeScreen";
import { LoginScreen } from "./screens/LoginScreen";
import { RegisterScreen } from "./screens/RegisterScreen";
import { ForgotPasswordScreen } from "./screens/ForgotPasswordScreen";

/**
 * Orquestador del flujo de autenticación, compartido por mobile-owner y
 * mobile-renter.
 *
 * El rol ya no se elige dentro del flujo: cada app es su propio binario
 * dedicado a un solo rol ("owner" | "renter"), pasado una única vez como
 * prop fija desde el App.js de esa app. Tampoco recibe `onAuthSuccess`:
 * nada por encima de <AuthFlow /> necesita un callback, porque
 * useApp().isLoggedIn (reactivo) es lo que determina cuándo el componente
 * padre deja de renderizar este flujo.
 *
 * La verificación de identidad (KYC) ya NO es parte de este flujo: la
 * cuenta se crea simple y el KYC se pide más adelante, dentro de la app
 * (OwnerApp/RenterApp), justo cuando el usuario intenta publicar o
 * reservar un auto de verdad.
 */
export function AuthFlow({ role }) {
  // 'splash' -> 'onboarding' -> 'welcome' -> 'login' | 'register'
  //   -> 'confirm_email' (solo si el registro no devolvió sesión activa)
  //   -> (el padre deja de mostrar AuthFlow apenas isLoggedIn sea true)
  const [step, setStep] = useState("splash");

  if (step === "splash") {
    return <SplashScreen onFinish={() => setStep("onboarding")} />;
  }

  if (step === "onboarding") {
    return <OnboardingScreen onFinish={() => setStep("welcome")} />;
  }

  if (step === "welcome") {
    return (
      <WelcomeScreen
        role={role}
        onNavigate={(screen) => {
          if (screen === "login") setStep("login");
          else if (screen === "register") setStep("register");
        }}
      />
    );
  }

  if (step === "register") {
    return (
      <RegisterScreen
        role={role}
        onNavigate={(screen) => {
          if (screen === "welcome") setStep("welcome");
          else if (screen === "login") setStep("login");
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
          <View style={styles.confirmIconCircle}>
            <Icon name="chat" size={30} color={colors.primary} />
          </View>
          <Text style={styles.confirmTitle}>Confirma tu correo</Text>
          <Text style={styles.confirmDesc}>
            Te enviamos un enlace de confirmación a tu correo. Ábrelo para
            activar tu cuenta y luego vuelve a iniciar sesión.
          </Text>
        </View>
        <TouchableOpacity
          style={styles.confirmBtn}
          onPress={() => setStep("login")}
          activeOpacity={0.85}
        >
          <Text style={styles.confirmBtnText}>Ir a Iniciar sesión</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (step === "login") {
    return (
      <LoginScreen
        onNavigate={(screen) => {
          if (screen === "welcome") setStep("welcome");
          else if (screen === "register") setStep("register");
          else if (screen === "forgot") setStep("forgot");
        }}
      />
    );
  }

  if (step === "forgot") {
    return <ForgotPasswordScreen onNavigate={(screen) => setStep(screen)} />;
  }

  return null;
}

const styles = StyleSheet.create({
  confirmContainer: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingVertical: 34,
  },
  confirmCenter: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
  },
  confirmIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primary100,
    alignItems: "center",
    justifyContent: "center",
  },
  confirmTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: colors.text,
    textAlign: "center",
  },
  confirmDesc: {
    fontSize: 15,
    color: colors.textMuted,
    textAlign: "center",
    lineHeight: 22,
    paddingHorizontal: 8,
  },
  confirmBtn: {
    height: 56,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  confirmBtnText: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "600",
  },
});
