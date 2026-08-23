import React, { useState, useEffect } from "react";
import {
  StyleSheet,
  View,
  SafeAreaView,
  StatusBar,
} from "react-native";
import { AppProvider, useApp } from "./src/context/AppContext";
import { colors } from "./src/theme/colors";

// Aplicaciones Independientes
import { OwnerApp } from "./src/apps/owner/OwnerApp";
import { RenterApp } from "./src/apps/renter/RenterApp";
import { AuthFlow } from "./src/apps/auth/AuthFlow";

function MainNavigator() {
  const { isLoggedIn, mode, setMode } = useApp();
  // 'auth' | 'owner' | 'renter'
  const [currentApp, setCurrentApp] = useState(
    !isLoggedIn ? "auth" : mode === "conductor" ? "owner" : "renter"
  );

  // Atajos de teclado para alternar rápidamente entre apps durante pruebas:
  // Tecla '1' o 'U' -> App Usuario (Renter)
  // Tecla '2' o 'D' -> App Dueño (Owner)
  // Tecla '3' o 'A' -> Flujo de Autenticación (Auth)
  useEffect(() => {
    if (typeof window !== "undefined" && window.addEventListener) {
      const handleKeyDown = (e) => {
        const key = e.key?.toLowerCase();
        if (key === "1" || key === "u") {
          setMode("pasajero");
          setCurrentApp("renter");
        } else if (key === "2" || key === "d") {
          setMode("conductor");
          setCurrentApp("owner");
        } else if (key === "3" || key === "a") {
          setCurrentApp("auth");
        }
      };

      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
    }
  }, [setMode]);

  const handleAuthSuccess = (selectedRole) => {
    const target = selectedRole === "owner" || selectedRole === "conductor" ? "owner" : "renter";
    setMode(target === "owner" ? "conductor" : "pasajero");
    setCurrentApp(target);
  };

  const handleSwitchApp = (targetApp) => {
    setMode(targetApp === "owner" ? "conductor" : "pasajero");
    setCurrentApp(targetApp);
  };

  return (
    <SafeAreaView style={styles.appContainer}>
      <StatusBar barStyle="dark-content" />

      {/* Renderizado de la App según rol y flujo en producción */}
      <View style={styles.bodyContainer}>
        {currentApp === "auth" && (
          <AuthFlow onAuthSuccess={handleAuthSuccess} />
        )}
        {currentApp === "owner" && (
          <OwnerApp onSwitchApp={handleSwitchApp} />
        )}
        {currentApp === "renter" && (
          <RenterApp onSwitchApp={handleSwitchApp} />
        )}
      </View>
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <AppProvider>
      <View style={styles.outerFrame}>
        <MainNavigator />
      </View>
    </AppProvider>
  );
}

const styles = StyleSheet.create({
  outerFrame: {
    flex: 1,
    backgroundColor: colors.appOuter,
    alignItems: "center",
    justifyContent: "center",
  },
  appContainer: {
    flex: 1,
    width: "100%",
    maxWidth: 440,
    backgroundColor: colors.background,
    boxShadow: "0px 10px 28px rgba(15, 61, 62, 0.14)",
    elevation: 8,
  },
  bodyContainer: {
    flex: 1,
  },
});
