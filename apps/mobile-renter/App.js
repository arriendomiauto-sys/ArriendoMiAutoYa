import React from "react";
import { View, Platform } from "react-native";
let GestureHandlerRootView = View;
try {
  const gh = require("react-native-gesture-handler");
  if (gh && gh.GestureHandlerRootView) {
    GestureHandlerRootView = gh.GestureHandlerRootView;
  }
} catch {
  // Fallback a View si el módulo nativo no está registrado
}
import { StatusBar } from "expo-status-bar";
import {
  SafeAreaProvider,
  SafeAreaView,
  initialWindowMetrics,
} from "react-native-safe-area-context";
import {
  AppProvider,
  useApp,
  colors,
  AuthFlow,
  SwitchingScreen,
  ArranqueGate,
  NetworkBanner,
  useNetworkStatus,
  ForceUpdateScreen,
  useVersionCheck,
} from "@rentacar/mobile-shared";
import { RenterApp } from "./src/renter/RenterApp";

const renterLogo = require("./assets/logo.png");

// App del Arrendatario, separada de la de Dueño (mobile-owner). Cada una es
// un binario propio con su propio rol fijo — ver
// docs/superpowers/specs/2026-09-15-mobile-app-split-design.md.
function Root() {
  const { isLoggedIn, authLoading, transition } = useApp();
  const { bloqueado, urlStore } = useVersionCheck();

  if (bloqueado) {
    return <ForceUpdateScreen urlStore={urlStore} />;
  }

  // ArranqueGate cubre la revisión de la sesión al abrir la app (carga, "sin
  // conexión" y el paso a login o a la app). La transición de cuenta se dibuja
  // encima solo cuando esa carga ya terminó, para no taparla con otra pantalla.
  return (
    <>
      <ArranqueGate variante="renter" logoSource={renterLogo}>
        {isLoggedIn ? <RenterApp /> : <AuthFlow fixedRole="renter" />}
      </ArranqueGate>
      {transition && !authLoading ? (
        <SwitchingScreen
          overlay
          mode={transition.mode}
          title={transition.title}
          subtitle={transition.subtitle}
          exito={transition.exito}
        />
      ) : null}
    </>
  );
}

function ThemedFrame() {
  const { isConnected } = useNetworkStatus();
  return (
    <>
      <StatusBar style="dark" translucent />
      <View className={`flex-1 ${isWeb ? "bg-appOuter items-center justify-center" : "bg-background"}`}>
        <SafeAreaView
          className={`flex-1 w-full bg-background ${isWeb ? "max-w-[440px] shadow-2xl" : ""}`}
          edges={["top", "left", "right"]}
        >
          <View className="flex-1">
            <Root />
            <NetworkBanner visible={!isConnected} />
          </View>
        </SafeAreaView>
      </View>
    </>
  );
}

export default function App() {
  return (
    <GestureHandlerRootView className="flex-1">
      <SafeAreaProvider initialMetrics={initialWindowMetrics}>
        <AppProvider initialMode="renter">
          <ThemedFrame />
        </AppProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const isWeb = Platform.OS === "web";
