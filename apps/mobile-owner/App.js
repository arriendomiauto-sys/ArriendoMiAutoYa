import React from "react";
import { View, StyleSheet } from "react-native";
import { StatusBar } from "expo-status-bar";
import {
  SafeAreaProvider,
  SafeAreaView,
  initialWindowMetrics,
} from "react-native-safe-area-context";
import { AppProvider, useApp, colors, AuthFlow } from "@rentacar/mobile-shared";
import { OwnerApp } from "./src/OwnerApp";

function Root() {
  const { isLoggedIn, authLoading } = useApp();

  if (authLoading) return null;

  // La cuenta se crea simple: basta con estar logueado para entrar a la
  // app. La verificación de identidad (KYC) ya no bloquea el acceso — se
  // pide recién cuando el dueño intenta publicar un auto de verdad
  // (OwnerApp gatilla el flujo de KYC en ese momento puntual).
  return (
    <View style={styles.bodyContainer}>
      {isLoggedIn ? <OwnerApp /> : <AuthFlow role="owner" />}
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
      <AppProvider>
        {/* Barra de estado translúcida: el contenido queda debajo del
            notch / barra de notificaciones gracias al SafeAreaView. */}
        <StatusBar style="light" translucent />
        <View style={styles.outerFrame}>
          {/* Único borde de área segura de toda la app. Los edges
              top/left/right empujan el contenido fuera del notch; el
              inset inferior lo maneja cada barra fija (tab bar, botoneras). */}
          <SafeAreaView
            style={styles.appContainer}
            edges={["top", "left", "right"]}
          >
            <Root />
          </SafeAreaView>
        </View>
      </AppProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  outerFrame: {
    flex: 1,
    backgroundColor: colors.darkBg,
    alignItems: "center",
    justifyContent: "center",
  },
  appContainer: {
    flex: 1,
    width: "100%",
    maxWidth: 440,
    backgroundColor: colors.darkBg,
    boxShadow: "0px 10px 28px rgba(15, 61, 62, 0.14)",
    elevation: 8,
  },
  bodyContainer: { flex: 1 },
});
