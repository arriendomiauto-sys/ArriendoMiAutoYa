import React, { useState } from "react";
import { StyleSheet, View } from "react-native";
import { colors, useApp, showAlert, TarjetaScreen } from "@rentacar/mobile-shared";

// Screens del Usuario Normal / Arrendatario
import { MarketplaceScreen } from "./screens/MarketplaceScreen";
import { MapExploreScreen } from "./screens/MapExploreScreen";
import { CarDetailScreen } from "./screens/CarDetailScreen";
import { ActiveRentalScreen } from "./screens/ActiveRentalScreen";
import { ExtendRentalScreen } from "./screens/ExtendRentalScreen";
import { RentalHistoryScreen } from "./screens/RentalHistoryScreen";
import { RoadsideClaimScreen } from "./screens/RoadsideClaimScreen";
import { PaymentMethodsScreen } from "./screens/PaymentMethodsScreen";
import { CancelReservationModal } from "./screens/CancelReservationModal";
import { RenterProfileScreen } from "./screens/RenterProfileScreen";
import { MyQRCodeScreen } from "./screens/MyQRCodeScreen";
import { FavoritesScreen } from "./screens/FavoritesScreen";

// Modales Compartidos
import {
  RentalChatScreen,
  NotificationsScreen,
  SupportScreen,
  ContractModal,
  KycScreen,
  TabBar,
  useConversaciones,
} from "@rentacar/mobile-shared";

export function RenterApp() {
  const { activeReservation, setActiveReservation, currentUser } = useApp();
  const identidadVerificada = currentUser?.estado_documentos === "verificado";

  // Pestañas de Navegación del Arrendatario
  const [activeTab, setActiveTab] = useState("explore"); // 'explore' | 'rentals' | 'chat' | 'profile'

  // No leídos reales para el globo de "Mensajes". Antes el punto rojo estaba
  // pintado a mano y se veía encendido siempre, hubiera mensajes o no.
  const { noLeidos, refrescar: refrescarConversaciones } = useConversaciones();

  // Modales y Flujos Secundarios
  const [selectedCar, setSelectedCar] = useState(null);
  const [bookingDraft, setBookingDraft] = useState(null);
  const [showMap, setShowMap] = useState(false);
  const [showFavorites, setShowFavorites] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [showEnrolment, setShowEnrolment] = useState(false);
  const [showExtendRental, setShowExtendRental] = useState(false);
  const [showRoadsideClaim, setShowRoadsideClaim] = useState(false);
  const [showMyQRCode, setShowMyQRCode] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showSupport, setShowSupport] = useState(false);
  const [showContract, setShowContract] = useState(false);
  const [showWallet, setShowWallet] = useState(false);

  // Renderizar la pantalla activa según la pestaña seleccionada
  const renderContent = () => {
    // 1. Verificación de Identidad KYC (captura y sube documentos reales,
    // llama al OCR y a completarEnrolamiento; mismo componente que usa el
    // registro inicial en AuthFlow)
    if (showEnrolment) {
      return (
        <KycScreen
          role="renter"
          onBack={() => setShowEnrolment(false)}
          onComplete={() => setShowEnrolment(false)}
        />
      );
    }

    // 2b. Favoritos
    if (showFavorites) {
      return (
        <FavoritesScreen
          onBack={() => setShowFavorites(false)}
          onSelectCar={(car) => {
            setSelectedCar(car);
            setShowFavorites(false);
          }}
        />
      );
    }

    // 2. Mapa Interactivo de Vehículos
    if (showMap) {
      return (
        <MapExploreScreen
          onBack={() => setShowMap(false)}
          onSelectCar={(car) => {
            setSelectedCar(car);
            setShowMap(false);
          }}
        />
      );
    }

    // 3. Ficha Técnica y Proceso de Reserva / Pago
    if (selectedCar) {
      if (showPayment) {
        return (
          <PaymentMethodsScreen
            car={selectedCar}
            booking={bookingDraft}
            onBack={() => setShowPayment(false)}
            onPaymentSuccess={(res) => {
              setShowPayment(false);
              setSelectedCar(null);
              setBookingDraft(null);
              if (res) {
                setActiveReservation(res);
                setActiveTab("rentals");
              }
            }}
          />
        );
      }

      return (
        <CarDetailScreen
          car={selectedCar}
          onBack={() => setSelectedCar(null)}
          onProceedToPayment={(car, draft) => {
            if (!identidadVerificada) {
              showAlert(
                "Verifica tu identidad",
                "Antes de reservar necesitamos confirmar quién eres: sube tu carnet y una selfie. Toma un par de minutos.",
                [
                  { text: "Ahora no", style: "cancel" },
                  { text: "Validar identidad", onPress: () => setShowEnrolment(true) },
                ]
              );
              return;
            }
            // Sin tarjeta validada, el backend igual va a rechazar la
            // reserva — mejor avisar antes de que elija fechas y llegue al
            // pago, con una salida directa a agregarla.
            if (currentUser?.tarjeta_estado !== "validada") {
              showAlert(
                "Necesitas una tarjeta registrada",
                "Es la garantía con la que se retiene el hold de tu arriendo. Puedes agregarla ahora.",
                [
                  { text: "Ahora no", style: "cancel" },
                  {
                    text: "Agregar tarjeta",
                    onPress: () => {
                      setSelectedCar(null);
                      setShowWallet(true);
                    },
                  },
                ]
              );
              return;
            }
            setSelectedCar(car);
            setBookingDraft(draft);
            setShowPayment(true);
          }}
        />
      );
    }

    // 4. Extensión de Arriendo
    if (showExtendRental && activeReservation) {
      return (
        <ExtendRentalScreen
          reservation={activeReservation}
          onBack={() => setShowExtendRental(false)}
          onComplete={() => setShowExtendRental(false)}
        />
      );
    }

    // 5. Asistencia en Ruta y Siniestros
    if (showRoadsideClaim) {
      return (
        <RoadsideClaimScreen
          reservation={activeReservation}
          onBack={() => setShowRoadsideClaim(false)}
        />
      );
    }

    // 6. Tarjeta de crédito — agregarla o reemplazarla fuera del enrolamiento inicial.
    if (showWallet) {
      return <TarjetaScreen onBack={() => setShowWallet(false)} onDone={() => setShowWallet(false)} />;
    }

    // 7. Código de Entrega / Devolución (lo muestra el arrendatario al dueño)
    if (showMyQRCode) {
      return (
        <MyQRCodeScreen
          reservation={activeReservation}
          onBack={() => setShowMyQRCode(false)}
        />
      );
    }

    // 8. Cancelar reserva / Notificaciones / Soporte (pantalla completa)
    if (showCancelModal) {
      return (
        <CancelReservationModal
          reservation={activeReservation}
          onClose={() => setShowCancelModal(false)}
          onConfirmCancel={() => {
            setShowCancelModal(false);
            setActiveReservation(null);
            setActiveTab("rentals");
          }}
        />
      );
    }
    if (showNotifications) {
      return <NotificationsScreen variant="renter" onBack={() => setShowNotifications(false)} />;
    }
    if (showSupport) {
      return <SupportScreen variant="renter" onBack={() => setShowSupport(false)} />;
    }

    // 9. Contenido de las Pestañas Principales
    switch (activeTab) {
      case "explore":
        return (
          <MarketplaceScreen
            onSelectCar={(car) => setSelectedCar(car)}
            onOpenMap={() => setShowMap(true)}
            onOpenFavorites={() => setShowFavorites(true)}
            onOpenFilters={() => setShowMap(true)}
            onVerifyIdentity={() => setShowEnrolment(true)}
          />
        );

      case "rentals":
        if (activeReservation) {
          return (
            <ActiveRentalScreen
              reservation={activeReservation}
              onBack={() => setActiveReservation(null)}
              onStartDelivery={() => setShowMyQRCode(true)}
              onStartReturn={() => setShowMyQRCode(true)}
              onExtendRental={() => setShowExtendRental(true)}
              onRoadsideClaim={() => setShowRoadsideClaim(true)}
              onCancelReservation={() => setShowCancelModal(true)}
              onOpenChat={() => setActiveTab("chat")}
              onOpenContract={() => setShowContract(true)}
            />
          );
        }
        return (
          <RentalHistoryScreen
            onSelectReservation={(res) => setActiveReservation(res)}
            onBack={() => setActiveTab("explore")}
          />
        );

      case "chat":
        return (
          <RentalChatScreen
            variant="renter"
            reservation={activeReservation}
            onBack={() => setActiveTab("explore")}
          />
        );

      case "profile":
        return (
          <RenterProfileScreen
            onOpenEnrolment={() => setShowEnrolment(true)}
            onOpenPaymentMethods={() => setShowWallet(true)}
            onOpenRentalHistory={() => setActiveTab("rentals")}
            onOpenRoadsideClaim={() => setShowRoadsideClaim(true)}
            onOpenNotifications={() => setShowNotifications(true)}
            onOpenSupport={() => setShowSupport(true)}
            onOpenContract={() => setShowContract(true)}
            onOpenChat={() => setActiveTab("chat")}
          />
        );

      default:
        return null;
    }
  };

  const isModalOpen =
    showEnrolment ||
    showMap ||
    showFavorites ||
    !!selectedCar ||
    showExtendRental ||
    showRoadsideClaim ||
    showWallet ||
    showMyQRCode ||
    showCancelModal ||
    showNotifications ||
    showSupport ||
    showContract;

  return (
    <View style={styles.appContainer}>
      {/* Pantalla Activa */}
      <View style={styles.screenContainer}>{renderContent()}</View>

      {/* Barra de Navegación Inferior Exclusiva del Arrendatario */}
      {!isModalOpen && (
        <TabBar
          tabs={[
            { id: "explore", icon: "search", label: "Explorar" },
            { id: "rentals", icon: "calendar", label: "Mis Arriendos" },
            { id: "chat", icon: "chat", label: "Mensajes", badge: noLeidos },
            { id: "profile", icon: "profile", label: "Mi Perfil" },
          ]}
          activeTab={activeTab}
          onChange={(id) => {
            setActiveTab(id);
            // Salir de Mensajes es el momento en que los no leídos cambiaron:
            // el backend los marcó al abrir la conversación.
            if (activeTab === "chat" && id !== "chat") refrescarConversaciones();
          }}
        />
      )}

      {/* Modal de Contrato (RN Modal: se monta en su propia capa) */}
      {showContract && (
        <ContractModal
          visible={showContract}
          reservation={activeReservation}
          onClose={() => setShowContract(false)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  appContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  screenContainer: {
    flex: 1,
  },
});
