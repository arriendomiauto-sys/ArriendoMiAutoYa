import React, { useEffect, useState } from "react";
import { View } from "react-native";
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
  SwitchingScreen,
  NetworkBanner,
  useNetworkStatus,
  ForceUpdateScreen,
  useVersionCheck,
  MandatoDuenoModal,
  verificarMandatoAceptado,
} from "@rentacar/mobile-shared";
import { OwnerApp } from "./src/owner/OwnerApp";
import { OwnerAuthFlow } from "./src/owner/auth/OwnerAuthFlow";

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
        <OwnerAuthFlow />
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
      <View className="flex-1 bg-background web:bg-appOuter web:items-center web:justify-center">
        <SafeAreaView
          className="flex-1 w-full bg-background web:max-w-[440px] web:shadow-lg"
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
        <AppProvider initialMode="owner">
          <ThemedFrame />
        </AppProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
