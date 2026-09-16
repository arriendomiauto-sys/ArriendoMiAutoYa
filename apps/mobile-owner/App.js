import React, { useEffect, useState } from "react";
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
  MandatoDuenoModal,
  verificarMandatoAceptado,
} from "@rentacar/mobile-shared";
import { OwnerApp } from "./src/owner/OwnerApp";

// App del Dueño, separada de la de Arrendatario (mobile-renter). Antes de
// entrar al home de dueño se exige el mandato de intermediación (mismo
// modal que en el binario único se disparaba al "cambiar a modo dueño";
// acá se dispara una vez, al loguearse, porque este binario SOLO es dueño).
function Root() {
  const { isLoggedIn, authLoading, currentUser, transition } = useApp();
  const { bloqueado, urlStore } = useVersionCheck();

  // null = todavía no se sabe si aceptó el mandato (se está consultando).
  const [mandatoAceptado, setMandatoAceptado] = useState(null);

  useEffect(() => {
    if (!isLoggedIn || !currentUser?.id) {
      setMandatoAceptado(null);
      return;
    }
    let vivo = true;
    verificarMandatoAceptado(currentUser.id).then((aceptado) => {
      if (vivo) setMandatoAceptado(aceptado);
    });
    return () => {
      vivo = false;
    };
  }, [isLoggedIn, currentUser?.id]);

  if (bloqueado) {
    return <ForceUpdateScreen urlStore={urlStore} />;
  }

  if (authLoading) {
    return <SwitchingScreen mode="owner" title="Cargando tu sesión" subtitle="Un segundo, estamos abriendo la app." />;
  }

  return (
    <>
      {isLoggedIn ? (
        mandatoAceptado === false ? (
          <MandatoDuenoModal
            visible
            userId={currentUser?.id}
            onClose={() => {}}
            onAccepted={() => setMandatoAceptado(true)}
          />
        ) : mandatoAceptado === null ? (
          <SwitchingScreen mode="owner" title="Cargando tu cuenta" subtitle="Un segundo más." />
        ) : (
          <OwnerApp />
        )
      ) : (
        <AuthFlow fixedRole="owner" />
      )}
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
        <AppProvider initialMode="owner">
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
