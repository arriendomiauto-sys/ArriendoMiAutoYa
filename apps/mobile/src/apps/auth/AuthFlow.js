import React, { useState } from "react";
import { SplashScreen } from "./screens/SplashScreen";
import { OnboardingScreen } from "./screens/OnboardingScreen";
import { WelcomeScreen } from "./screens/WelcomeScreen";
import { LoginScreen } from "./screens/LoginScreen";
import { RegisterScreen } from "./screens/RegisterScreen";
import { ForgotPasswordScreen } from "./screens/ForgotPasswordScreen";

import { KycScreen } from "./screens/KycScreen";

export function AuthFlow({ onAuthSuccess }) {
  const [step, setStep] = useState("splash"); // 'splash' | 'onboarding' | 'welcome' | 'login' | 'register' | 'kyc' | 'forgot'
  const [registeredRole, setRegisteredRole] = useState("renter");

  if (step === "splash") {
    return <SplashScreen onFinish={() => setStep("onboarding")} />;
  }

  if (step === "onboarding") {
    return <OnboardingScreen onFinish={() => setStep("welcome")} />;
  }

  if (step === "welcome") {
    return (
      <WelcomeScreen
        onNavigate={(screen) => {
          if (screen === "login") setStep("login");
          else if (screen === "register") setStep("register");
          else if (onAuthSuccess) onAuthSuccess("renter");
        }}
      />
    );
  }

  if (step === "register") {
    return (
      <RegisterScreen
        onNavigate={(screen, role) => {
          if (screen === "welcome") setStep("welcome");
          else if (screen === "login") setStep("login");
          else if (screen === "kyc") {
            setRegisteredRole(role || "renter");
            setStep("kyc");
          } else if (onAuthSuccess) {
            onAuthSuccess(role || "renter");
          }
        }}
      />
    );
  }

  if (step === "kyc") {
    return (
      <KycScreen
        role={registeredRole}
        onBack={() => setStep("register")}
        onComplete={(finalRole) => {
          if (onAuthSuccess) onAuthSuccess(finalRole || registeredRole);
        }}
      />
    );
  }

  if (step === "login") {
    return (
      <LoginScreen
        onNavigate={(screen, role) => {
          if (screen === "welcome") setStep("welcome");
          else if (screen === "register") setStep("register");
          else if (screen === "forgot") setStep("forgot");
          else if (onAuthSuccess) onAuthSuccess(role || "renter");
        }}
      />
    );
  }

  if (step === "forgot") {
    return (
      <ForgotPasswordScreen
        onBack={() => setStep("login")}
        onSuccess={() => setStep("login")}
      />
    );
  }

  return null;
}

export * from "./screens";
