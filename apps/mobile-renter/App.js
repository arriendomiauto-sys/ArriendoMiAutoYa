import React from "react";
import { View, StyleSheet, SafeAreaView, StatusBar } from "react-native";
import { AppProvider, useApp, colors, AuthFlow } from "@rentacar/mobile-shared";
import { RenterApp } from "./src/RenterApp";

function Root() {
  const { isLoggedIn, authLoading, currentUser } = useApp();

  if (authLoading) return null;

  const enrolmentComplete =
    !!currentUser && !!currentUser.rut && currentUser.estado_documentos !== "pendiente";

  return (
    <SafeAreaView style={styles.appContainer}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.bodyContainer}>
        {isLoggedIn && enrolmentComplete ? <RenterApp /> : <AuthFlow role="renter" />}
      </View>
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <AppProvider>
      <View style={styles.outerFrame}>
        <Root />
      </View>
    </AppProvider>
  );
}

const styles = StyleSheet.create({
  outerFrame: { flex: 1, backgroundColor: colors.appOuter, alignItems: "center", justifyContent: "center" },
  appContainer: { flex: 1, width: "100%", maxWidth: 440, backgroundColor: colors.background, boxShadow: "0px 10px 28px rgba(15, 61, 62, 0.14)", elevation: 8 },
  bodyContainer: { flex: 1 },
});
