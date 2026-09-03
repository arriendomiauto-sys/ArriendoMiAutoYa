import React, { useState } from "react";
import { View, StyleSheet, StatusBar } from "react-native";
import { useApp } from "../context/AppContext";
import { colors } from "../theme/colors";
import { theme } from "../theme/tokens";
import { Button, EmptyState } from "../components/ui";
import { SplashScreen } from "./screens/SplashScreen";
import { OnboardingScreen } from "./screens/OnboardingScreen";
import { WelcomeScreen } from "./screens/WelcomeScreen";
import { LoginScreen } from "./screens/LoginScreen";
import { RegisterScreen } from "./screens/RegisterScreen";
import { ForgotPasswordScreen } from "./screens/ForgotPasswordScreen";

/**
 * Orquestador del flujo de autenticación de la app unificada.
 *
 * La app es un solo binario con dos experiencias (arrendatario / dueño). El
 * rol se elige acá, en la pantalla de bienvenida, y queda como el modo con
 * el que arranca la app; después el usuario alterna entre modos desde su
 * perfil. No recibe `onAuthSuccess`: nada por encima de <AuthFlow /> necesita
 * un callback, porque useApp().isLoggedIn (reactivo) es lo que determina
 * cuándo el componente padre deja de renderizar este flujo.
 *
 * La verificación de identidad (KYC) NO es parte de este flujo: la cuenta se
 * crea simple y el KYC se pide más adelante, dentro de la app
 * (OwnerApp/RenterApp), justo cuando el usuario intenta publicar o reservar
 * un auto de verdad.
 *
 * Las pantallas de presentación (onboarding) se muestran UNA sola vez, la
 * primera vez que se abre la app. Después el splash lleva directo a la
 * bienvenida: quien ya conoce la app no tiene por qué volver a pasar por la
 * explicación cada vez que cierra sesión.
 */
export function AuthFlow() {
  // 'splash' -> ('onboarding' solo la primera vez) -> 'welcome'
  //   -> 'login' | 'register'
  //   -> 'confirm_email' (solo si el registro no devolvió sesión activa)
  //   -> (el padre deja de mostrar AuthFlow apenas isLoggedIn sea true)
  const [step, setStep] = useState("splash");

  const { onboardingVisto, marcarOnboardingVisto } = useApp();

  // Rol elegido en la bienvenida: 'renter' (arrendar) | 'owner' (publicar).
  // Solo afecta el copy del registro y el modo inicial de la app.
  const [role, setRole] = useState("renter");

  if (step === "splash") {
    return (
      <SplashScreen
        // Quien ya vio la presentación no necesita volver a mirar el logo casi
        // dos segundos en cada arranque.
        duracionMs={onboardingVisto ? 700 : 1800}
        onFinish={() => {
          // `onboardingVisto` puede seguir en null si el almacenamiento tarda
          // más que el splash; en ese caso se muestra la presentación, que es
          // el comportamiento seguro para alguien que abre la app por primera
          // vez.
          setStep(onboardingVisto ? "welcome" : "onboarding");
        }}
      />
    );
  }

  if (step === "onboarding") {
    return (
      <OnboardingScreen
        onFinish={() => {
          marcarOnboardingVisto();
          setStep("welcome");
        }}
      />
    );
  }

  if (step === "welcome") {
    return (
      <WelcomeScreen
        role={role}
        onSelectRole={setRole}
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
    paddingHorizontal: theme.spacing.xxl,
    paddingVertical: 34,
  },
  confirmCenter: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
