import React, { useState } from "react";
import { View, StatusBar } from "react-native";
import { useApp } from "../context/AppContext";
import { Button, EmptyState } from "../components/ui";
import { SplashScreen } from "./screens/SplashScreen";
import { OnboardingScreen } from "./screens/OnboardingScreen";
import { WelcomeScreen } from "./screens/WelcomeScreen";
import { LoginScreen } from "./screens/LoginScreen";
import { RegisterScreen } from "./screens/RegisterScreen";
import { ForgotPasswordScreen } from "./screens/ForgotPasswordScreen";

/**
 * Orquestador del flujo de autenticación.
 *
 * 'splash' -> ('onboarding' solo la primera vez) -> 'welcome'
 *   -> 'login' | 'register'
 *   -> 'confirm_email' (solo si el registro no devolvió sesión activa)
 *   -> (el padre deja de mostrar AuthFlow apenas isLoggedIn sea true)
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
  const [step, setStep] = useState("splash");

  const appCtx = typeof useApp === "function" ? useApp() : null;
  const onboardingVisto = appCtx?.onboardingVisto;
  const marcarOnboardingVisto = appCtx?.marcarOnboardingVisto;

  // Rol elegido en la bienvenida: 'renter' (arrendar) | 'owner' (publicar).
  // Si `fixedRole` viene fijo (apps separadas), el rol nunca cambia y la
  // bienvenida no ofrece elegir el otro.
  const [role, setRole] = useState(fixedRole || "renter");

  if (step === "splash") {
    return (
      <SplashScreen
        duracionMs={onboardingVisto ? 700 : 1800}
        onFinish={() => {
          setStep(onboardingVisto ? "welcome" : "onboarding");
        }}
      />
    );
  }

  if (step === "onboarding") {
    return (
      <OnboardingScreen
        onFinish={() => {
          marcarOnboardingVisto?.();
          setStep("welcome");
        }}
      />
    );
  }

  if (step === "welcome") {
    return (
      <WelcomeScreen
        role={role}
        fixedRole={fixedRole}
        onSelectRole={fixedRole ? undefined : setRole}
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
      <View className="flex-1 bg-surface justify-between px-8 py-[34px]">
        <StatusBar barStyle="dark-content" />
        <View className="flex-1 items-center justify-center">
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
