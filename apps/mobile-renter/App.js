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
  DevScreenPicker,
  ErrorBoundary,
} from "@rentacar/mobile-shared";
import { RenterApp } from "./src/renter/RenterApp";
import { CarDetailScreen } from "./src/renter/screens/CarDetailScreen";
import { MarketplaceScreen } from "./src/renter/screens/MarketplaceScreen";
import { MapExploreScreen } from "./src/renter/screens/MapExploreScreen";
import { ActiveRentalScreen } from "./src/renter/screens/ActiveRentalScreen";
import { RentalHistoryScreen } from "./src/renter/screens/RentalHistoryScreen";
import { PaymentMethodsScreen } from "./src/renter/screens/PaymentMethodsScreen";
import { RoadsideClaimScreen } from "./src/renter/screens/RoadsideClaimScreen";
import { FavoritesScreen } from "./src/renter/screens/FavoritesScreen";
import { RenterProfileScreen } from "./src/renter/screens/RenterProfileScreen";

const renterLogo = require("./assets/logo.png");

const DEMO_CAR = {
  id: "demo-bmw-1",
  marca: "BMW",
  modelo: "Serie 3",
  anio: 2024,
  categoria: "premium",
  tarifa_dia: 180000,
  monto_garantia: 350000,
  ubicacion_base: "Las Condes, Santiago",
  dueno_nombre: "Ignacio Silva",
  dueno_rating: 4.9,
  descripcion: "Excelente estado, mantenimiento en concesionario oficial, transmisión automática, asientos de cuero y CarPlay.",
  fotos: [
    "https://images.unsplash.com/photo-1555215695-3004980ad54e?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=800&q=80",
  ],
  transmision: "automatica",
  combustible: "bencina",
  asientos: 5,
  puertas: 4,
  equipamiento: { ac: true, bluetooth: true, camara_retroceso: true, isofix: true },
};

const DEV_SCREENS = [
  {
    id: "car_detail",
    nombre: "Ficha del Auto (CarDetailScreen)",
    categoria: "Arriendo",
    descripcion: "Ficha completa con carrusel, zoom, sellos de confianza y validación de licencia",
    render: ({ onBack }) => (
      <CarDetailScreen car={DEMO_CAR} onBack={onBack} onProceedToPayment={() => {}} />
    ),
  },
  {
    id: "marketplace",
    nombre: "Marketplace / Explorar",
    categoria: "Exploración",
    descripcion: "Catálogo de vehículos con chips de categorías con íconos y buscador",
    render: ({ onBack }) => (
      <MarketplaceScreen
        onSelectCar={() => {}}
        onOpenMap={() => {}}
        onOpenFavorites={() => {}}
        onVerifyIdentity={() => {}}
      />
    ),
  },
  {
    id: "map_explore",
    nombre: "Mapa de Autos (MapExploreScreen)",
    categoria: "Exploración",
    descripcion: "Mapa interactivo con pines de autos disponibles por ubicación",
    render: ({ onBack }) => <MapExploreScreen onSelectCar={() => {}} onBack={onBack} />,
  },
  {
    id: "active_rental",
    nombre: "Arriendo Activo (ActiveRentalScreen)",
    categoria: "Arriendo",
    descripcion: "Dashboard de arriendo en curso con entrega y devolución",
    render: ({ onBack }) => (
      <ActiveRentalScreen
        onOpenChat={() => {}}
        onExtend={() => {}}
        onRoadsideClaim={() => {}}
        onViewContract={() => {}}
        onDelivery={() => {}}
        onShowQR={() => {}}
      />
    ),
  },
  {
    id: "payment_methods",
    nombre: "Métodos de Pago (PaymentMethodsScreen)",
    categoria: "Pagos",
    descripcion: "Hold de garantía, tarjeta de crédito y resumen antes de pagar",
    render: ({ onBack }) => (
      <PaymentMethodsScreen
        car={DEMO_CAR}
        bookingDraft={{
          fechaInicio: new Date().toISOString(),
          fechaFin: new Date(Date.now() + 3 * 86400000).toISOString(),
          dias: 3,
          montoCobro: 540000,
          montoGarantia: 350000,
        }}
        onBack={onBack}
        onSuccess={() => {}}
      />
    ),
  },
  {
    id: "rental_history",
    nombre: "Historial de Arriendos",
    categoria: "Arriendos",
    descripcion: "Lista de reservas pasadas y en curso",
    render: ({ onBack }) => (
      <RentalHistoryScreen onSelectReservation={() => {}} onResumePayment={() => {}} />
    ),
  },
  {
    id: "roadside_claim",
    nombre: "Asistencia en Ruta (RoadsideClaimScreen)",
    categoria: "Emergencias",
    descripcion: "Reporte de siniestros, grúa y asistencia técnica",
    render: ({ onBack }) => <RoadsideClaimScreen onBack={onBack} />,
  },
  {
    id: "favorites",
    nombre: "Favoritos (FavoritesScreen)",
    categoria: "Exploración",
    descripcion: "Lista de autos marcados como favoritos",
    render: ({ onBack }) => <FavoritesScreen onSelectCar={() => {}} onBack={onBack} />,
  },
  {
    id: "profile",
    nombre: "Perfil de Arrendatario",
    categoria: "Usuario",
    descripcion: "Datos personales, licencia, documentos y verificación de identidad",
    render: ({ onBack }) => (
      <RenterProfileScreen
        onEditProfile={() => {}}
        onManageCards={() => {}}
        onOpenAntecedentes={() => {}}
        onOpenHistory={() => {}}
      />
    ),
  },
];

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
    <DevScreenPicker screens={DEV_SCREENS}>
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
    </DevScreenPicker>
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
      <ErrorBoundary>
        <SafeAreaProvider initialMetrics={initialWindowMetrics}>
          <AppProvider initialMode="renter">
            <ThemedFrame />
          </AppProvider>
        </SafeAreaProvider>
      </ErrorBoundary>
    </GestureHandlerRootView>
  );
}

const isWeb = Platform.OS === "web";
