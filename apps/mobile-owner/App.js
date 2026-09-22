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
  ArranqueGate,
  NetworkBanner,
  useNetworkStatus,
  ForceUpdateScreen,
  useVersionCheck,
  MandatoDuenoModal,
  verificarMandatoAceptado,
  DevScreenPicker,
} from "@rentacar/mobile-shared";
import { OwnerApp } from "./src/owner/OwnerApp";
import { OwnerAuthFlow } from "./src/owner/auth/OwnerAuthFlow";
import { MyCarsScreen } from "./src/owner/screens/MyCarsScreen";
import { AddEditCarScreen } from "./src/owner/screens/AddEditCarScreen";
import { CarCalendarScreen } from "./src/owner/screens/CarCalendarScreen";
import { DriverBookingsScreen } from "./src/owner/screens/DriverBookingsScreen";
import { EarningsScreen } from "./src/owner/screens/EarningsScreen";
import { OwnerProfileScreen } from "./src/owner/screens/OwnerProfileScreen";

// Logo propio de la app de dueño: `BrandLogo` (paquete compartido) trae por
// defecto el de mobile-renter, así que se pasa explícito a la pantalla de carga.
// El PNG viene con ~12.5% de margen vacío alrededor del isotipo (el de
// mobile-renter llega justo al borde); sin compensarlo con zoom se ve como un
// doble marco (uno del propio PNG y otro del recorte redondeado de BrandLogo).
const ownerLogo = require("./assets/logo.png");
const OWNER_LOGO_ZOOM = 1.33;

const DEMO_OWNER_CAR = {
  id: "car-owner-1",
  marca: "Toyota",
  modelo: "RAV4",
  anio: 2023,
  categoria: "suv",
  tarifa_dia: 80000,
  estado: "aprobado",
  publicado: true,
  fotos: [
    "https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?auto=format&fit=crop&w=800&q=80",
  ],
};

const DEV_SCREENS_OWNER = [
  {
    id: "my_cars",
    nombre: "Mis Autos / Flota (MyCarsScreen)",
    categoria: "Flota",
    descripcion: "Lista de vehículos publicados, estados y botón para añadir",
    render: ({ onBack }) => (
      <MyCarsScreen onAddCar={() => {}} onSelectCar={() => {}} onCalendar={() => {}} />
    ),
  },
  {
    id: "add_car",
    nombre: "Publicar / Enrolar Auto (AddEditCarScreen)",
    categoria: "Publicación",
    descripcion: "Wizard de 4 pasos: Datos, Categoría, 9 Fotos guiadas y Documentación",
    render: ({ onBack }) => (
      <AddEditCarScreen car={null} onBack={onBack} onSuccess={() => {}} />
    ),
  },
  {
    id: "calendar",
    nombre: "Calendario de Disponibilidad (CarCalendarScreen)",
    categoria: "Gestión",
    descripcion: "Bloqueo de fechas, precios especiales y reservas en curso",
    render: ({ onBack }) => (
      <CarCalendarScreen car={DEMO_OWNER_CAR} onBack={onBack} />
    ),
  },
  {
    id: "driver_bookings",
    nombre: "Solicitudes de Reserva (DriverBookingsScreen)",
    categoria: "Reservas",
    descripcion: "Aprobación y gestión de arriendos entrantes",
    render: ({ onBack }) => (
      <DriverBookingsScreen onSelectBooking={() => {}} onDelivery={() => {}} />
    ),
  },
  {
    id: "earnings",
    nombre: "Ganancias y Finanzas (EarningsScreen)",
    categoria: "Finanzas",
    descripcion: "Métricas de ingresos, liquidaciones y comisiones del dueño",
    render: ({ onBack }) => (
      <EarningsScreen onManageBankAccount={() => {}} />
    ),
  },
  {
    id: "owner_profile",
    nombre: "Perfil de Dueño (OwnerProfileScreen)",
    categoria: "Usuario",
    descripcion: "Datos de contacto, cuenta bancaria para pagos y ajustes",
    render: ({ onBack }) => (
      <OwnerProfileScreen
        onEditProfile={() => {}}
        onManageBankAccount={() => {}}
        onTerms={() => {}}
      />
    ),
  },
];

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

  // ArranqueGate cubre la revisión de la sesión al abrir la app (carga, "sin
  // conexión" y el paso a login o a la app). La transición de cuenta se dibuja
  // encima solo cuando esa carga ya terminó, para no taparla con otra pantalla.
  return (
    <DevScreenPicker screens={DEV_SCREENS_OWNER}>
      <ArranqueGate variante="owner" logoSource={ownerLogo} logoZoom={OWNER_LOGO_ZOOM}>
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
    </DevScreenPicker>
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
