import React from "react";
import { View, StyleSheet } from "react-native";
import { StatusBar } from "expo-status-bar";
import {
  SafeAreaProvider,
  SafeAreaView,
  initialWindowMetrics,
} from "react-native-safe-area-context";
import { AppProvider, useApp, colors, AuthFlow } from "@rentacar/mobile-shared";
import { RenterApp } from "./src/renter/RenterApp";
import { OwnerApp } from "./src/owner/OwnerApp";

// App unificada: un solo binario con dos experiencias. `mode` (persistido en
// AppContext) decide cuál se muestra:
//   - "renter" -> RenterApp, tema claro
//   - "owner"  -> OwnerApp, tema oscuro
// El usuario elige el modo inicial en el registro y alterna entre ellos
// desde su perfil. La verificación de identidad (KYC) no bloquea el acceso:
// se pide recién al publicar o reservar un auto de verdad.
function Root() {
  const { isLoggedIn, authLoading, mode } = useApp();

  if (authLoading) return null;
  if (!isLoggedIn) return <AuthFlow />;
  return mode === "owner" ? <OwnerApp /> : <RenterApp />;
}

// El marco de área segura vive dentro del provider para poder teñirse según
// el modo activo (el dueño usa superficies oscuras, el arrendatario claras).
function ThemedFrame() {
  const { isLoggedIn, mode } = useApp();
  const dark = isLoggedIn && mode === "owner";

  return (
    <>
      {/* Barra de estado translúcida: el contenido queda debajo del notch
          gracias al SafeAreaView. */}
      <StatusBar style={dark ? "light" : "dark"} translucent />
      <View
        style={[
          styles.outerFrame,
          { backgroundColor: dark ? colors.darkBg : colors.appOuter },
        ]}
      >
        {/* Único borde de área segura de toda la app. Los edges top/left/right
            empujan el contenido fuera del notch; el inset inferior lo maneja
            cada barra fija (tab bar, botoneras). */}
        <SafeAreaView
          style={[
            styles.appContainer,
            { backgroundColor: dark ? colors.darkBg : colors.background },
          ]}
          edges={["top", "left", "right"]}
        >
          <View style={styles.bodyContainer}>
            <Root />
          </View>
        </SafeAreaView>
      </View>
    </>
  );
}

export default function App() {
  return (
    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
      <AppProvider>
        <ThemedFrame />
      </AppProvider>
    </SafeAreaProvider>
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
