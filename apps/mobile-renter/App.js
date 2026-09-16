import React from "react";
import { View, StyleSheet } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
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
      <View style={[styles.outerFrame, { backgroundColor: colors.appOuter }]}>
        <SafeAreaView
          style={[styles.appContainer, { backgroundColor: colors.background }]}
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
      <SafeAreaProvider>
        <AppProvider initialMode="renter">
          <ThemedFrame />
        </AppProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  outerFrame: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  appContainer: {
    flex: 1,
    width: "100%",
    maxWidth: 440,
    boxShadow: "0px 10px 28px rgba(15, 61, 62, 0.14)",
    elevation: 8,
  },
  bodyContainer: { flex: 1 },
});
