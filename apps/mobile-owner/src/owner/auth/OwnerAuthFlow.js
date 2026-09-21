import React, { useState } from "react";
import { View, StatusBar } from "react-native";
import {
  useApp,
  SplashScreen,
  OnboardingScreen,
  Button,
  EmptyState,
} from "@rentacar/mobile-shared";
import { OwnerWelcomeScreen } from "./OwnerWelcomeScreen";
import { OwnerLoginScreen } from "./OwnerLoginScreen";
import { OwnerRegisterScreen } from "./OwnerRegisterScreen";
import { OwnerForgotPasswordScreen } from "./OwnerForgotPasswordScreen";

// Logo propio de la app de dueño: `BrandLogo` (paquete compartido) trae por
// defecto el logo de mobile-renter, así que hay que pasarlo explícito acá
// para que el splash muestre la marca correcta.
//
// El PNG de este logo viene con ~12.5% de margen vacío alrededor del
// isotipo (a diferencia del logo de mobile-renter, que llega justo al
// borde); sin compensarlo con zoom se ve como un doble marco (uno del
// propio PNG y otro del recorte redondeado de BrandLogo).
const ownerLogo = require("../../../assets/logo.png");
const OWNER_LOGO_ZOOM = 1.33;

/**
 * Orquestador del flujo de autenticación de la app de DUEÑO — fork de
 * `AuthFlow` (packages/mobile-shared/auth/AuthFlow.js) que usa las pantallas
 * nuevas (Welcome/Login/Register/Forgot) en vez de las compartidas.
 * mobile-renter sigue usando el `AuthFlow` compartido sin cambios.
 *
 * Splash y Onboarding NO se rediseñaron (fuera del alcance pedido) — se
 * reutilizan tal cual del paquete compartido.
 */
export function OwnerAuthFlow() {
  const [step, setStep] = useState("splash");
  const { onboardingVisto, marcarOnboardingVisto } = useApp();

  if (step === "splash") {
    return (
      <SplashScreen
        duracionMs={onboardingVisto ? 700 : 1800}
        logoSource={ownerLogo}
        logoZoom={OWNER_LOGO_ZOOM}
        onFinish={() => setStep(onboardingVisto ? "welcome" : "onboarding")}
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
      <OwnerWelcomeScreen
        onNavigate={(screen) => {
          if (screen === "login") setStep("login");
          else if (screen === "register") setStep("register");
        }}
      />
    );
  }

  if (step === "register") {
    return (
      <OwnerRegisterScreen
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
      <View className="flex-1 bg-background justify-between px-8 py-[34px]">
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
      <OwnerLoginScreen
        onNavigate={(screen) => {
          if (screen === "welcome") setStep("welcome");
          else if (screen === "register") setStep("register");
          else if (screen === "forgot") setStep("forgot");
        }}
      />
    );
  }

  if (step === "forgot") {
    return <OwnerForgotPasswordScreen onNavigate={(screen) => setStep(screen)} />;
  }

  return null;
}

