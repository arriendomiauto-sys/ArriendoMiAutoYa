import React, { useState } from "react";
import { View, StatusBar } from "react-native";
import { Button, EmptyState } from "@rentacar/mobile-shared";
import { OwnerLoginScreen } from "./OwnerLoginScreen";
import { OwnerRegisterScreen } from "./OwnerRegisterScreen";
import { OwnerForgotPasswordScreen } from "./OwnerForgotPasswordScreen";

/**
 * Orquestador del flujo de autenticación de la app de DUEÑO — fork de
 * `AuthFlow` (packages/mobile-shared/auth/AuthFlow.js) que usa las pantallas
 * propias (Login/Register/Forgot) en vez de las compartidas.
 *
 * Arranca directo en el login: la pantalla de carga (`ArranqueGate`, en App.js)
 * ya revisó la sesión antes de llegar acá, así que no hay splash, onboarding ni
 * bienvenida. Desde el login se va a crear cuenta o a recuperar la contraseña,
 * y de ahí se vuelve al login.
 */
export function OwnerAuthFlow() {
  const [step, setStep] = useState("login");

  if (step === "register") {
    return (
      <OwnerRegisterScreen
        onNavigate={(screen) => {
          if (screen === "welcome" || screen === "login") setStep("login");
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

  if (step === "forgot") {
    return <OwnerForgotPasswordScreen onNavigate={(screen) => setStep(screen)} />;
  }

  return (
    <OwnerLoginScreen
      onNavigate={(screen) => {
        if (screen === "register") setStep("register");
        else if (screen === "forgot") setStep("forgot");
      }}
    />
  );
}
