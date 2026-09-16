import React from "react";
import { View, StyleSheet, Platform } from "react-native";
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
  NetworkBanner,
  useNetworkStatus,
  ForceUpdateScreen,
  useVersionCheck,
} from "@rentacar/mobile-shared";
import { RenterApp } from "./src/renter/RenterApp";

// App del Arrendatario, separada de la de Dueño (mobile-owner). Cada una es
// un binario propio con su propio rol fijo — ver
// docs/superpowers/specs/2026-09-15-mobile-app-split-design.md.
function Root() {
  const { isLoggedIn, authLoading, transition } = useApp();
  const { bloqueado, urlStore } = useVersionCheck();

  if (bloqueado) {
    return <ForceUpdateScreen urlStore={urlStore} />;
  }

  if (authLoading) {
    return <SwitchingScreen mode="renter" title="Cargando tu sesión" subtitle="Un segundo, estamos abriendo la app." />;
  }

  return (
    <>
      {isLoggedIn ? <RenterApp /> : <AuthFlow fixedRole="renter" />}
      {transition ? (
        <SwitchingScreen
          overlay
          mode={transition.mode}
          title={transition.title}
          subtitle={transition.subtitle}
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
      <View style={styles.outerFrame}>
        <SafeAreaView
          style={styles.appContainer}
          edges={["top", "left", "right"]}
        >
          <View style={styles.bodyContainer}>
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
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider initialMetrics={initialWindowMetrics}>
        <AppProvider initialMode="renter">
          <ThemedFrame />
        </AppProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const isWeb = Platform.OS === "web";

const styles = StyleSheet.create({
  outerFrame: {
    flex: 1,
    backgroundColor: isWeb ? colors.appOuter : colors.background,
    ...(isWeb
      ? {
          alignItems: "center",
          justifyContent: "center",
        }
      : {}),
  },
  appContainer: {
    flex: 1,
    width: "100%",
    backgroundColor: colors.background,
    ...(isWeb
      ? {
          maxWidth: 440,
          boxShadow: "0px 10px 28px rgba(15, 61, 62, 0.14)",
          elevation: 8,
        }
      : {}),
  },
  bodyContainer: { flex: 1 },
});
