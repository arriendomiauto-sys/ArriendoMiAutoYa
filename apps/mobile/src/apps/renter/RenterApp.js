import React, { useState } from "react";
import {
  StyleSheet,
  View,
  SafeAreaView,
  StatusBar,
  TouchableOpacity,
  Text,
} from "react-native";
import { colors } from "../../theme/colors";
import { useApp } from "../../context/AppContext";
import { Icon } from "../../shared/components/Icon";

// Screens del Usuario Normal / Arrendatario
import { MarketplaceScreen } from "./screens/MarketplaceScreen";
import { MapExploreScreen } from "./screens/MapExploreScreen";
import { CarDetailScreen } from "./screens/CarDetailScreen";
import { EnrolmentScreen } from "./screens/EnrolmentScreen";
import { ActiveRentalScreen } from "./screens/ActiveRentalScreen";
import { ExtendRentalScreen } from "./screens/ExtendRentalScreen";
import { RentalHistoryScreen } from "./screens/RentalHistoryScreen";
import { RoadsideClaimScreen } from "./screens/RoadsideClaimScreen";
import { PaymentMethodsScreen } from "./screens/PaymentMethodsScreen";
import { CancelReservationModal } from "./screens/CancelReservationModal";
import { RenterProfileScreen } from "./screens/RenterProfileScreen";

// Modales Compartidos y Delivery
import { DeliveryScreen } from "../owner/screens/DeliveryScreen";
import { RentalChatScreen } from "../../shared/screens/RentalChatScreen";
import { NotificationsScreen } from "../../shared/screens/NotificationsScreen";
import { SupportScreen } from "../../shared/screens/SupportScreen";
import { ContractModal } from "../../shared/screens/ContractModal";

export function RenterApp({ onSwitchApp }) {
  const { activeReservation, setActiveReservation } = useApp();

  // Pestañas de Navegación del Arrendatario
  const [activeTab, setActiveTab] = useState("explore"); // 'explore' | 'rentals' | 'chat' | 'profile'

  // Modales y Flujos Secundarios
  const [selectedCar, setSelectedCar] = useState(null);
  const [showMap, setShowMap] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [showEnrolment, setShowEnrolment] = useState(false);
  const [showExtendRental, setShowExtendRental] = useState(false);
  const [showRoadsideClaim, setShowRoadsideClaim] = useState(false);
  const [showDeliveryFlow, setShowDeliveryFlow] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showSupport, setShowSupport] = useState(false);
  const [showContract, setShowContract] = useState(false);
  const [showWallet, setShowWallet] = useState(false);

  // Renderizar la pantalla activa según la pestaña seleccionada
  const renderContent = () => {
    // 1. Verificación de Identidad KYC
    if (showEnrolment) {
      return (
        <EnrolmentScreen
          onBack={() => setShowEnrolment(false)}
          onComplete={() => setShowEnrolment(false)}
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
            onBack={() => setShowPayment(false)}
            onPaymentSuccess={(res) => {
              setShowPayment(false);
              setSelectedCar(null);
              setActiveReservation(res);
              setActiveTab("rentals");
            }}
          />
        );
      }

      return (
        <CarDetailScreen
          car={selectedCar}
          onBack={() => setSelectedCar(null)}
          onProceedToPayment={(car) => {
            setSelectedCar(car);
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
          onSuccess={() => setShowExtendRental(false)}
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

    // 6. Billetera y Métodos de Pago directos
    if (showWallet) {
      return (
        <PaymentMethodsScreen
          onBack={() => setShowWallet(false)}
          onPaymentSuccess={() => setShowWallet(false)}
        />
      );
    }

    // 7. Inspección de Entrega / Devolución Digital
    if (showDeliveryFlow) {
      return (
        <DeliveryScreen
          onBack={() => setShowDeliveryFlow(false)}
          onCompleteDelivery={() => setShowDeliveryFlow(false)}
        />
      );
    }

    // 8. Contenido de las Pestañas Principales
    switch (activeTab) {
      case "explore":
        return (
          <MarketplaceScreen
            onSelectCar={(car) => setSelectedCar(car)}
            onOpenMap={() => setShowMap(true)}
            onOpenFilters={() => setShowMap(true)}
          />
        );

      case "rentals":
        if (activeReservation) {
          return (
            <ActiveRentalScreen
              reservation={activeReservation}
              onBack={() => setActiveReservation(null)}
              onStartDelivery={() => setShowDeliveryFlow(true)}
              onStartReturn={() => setShowDeliveryFlow(true)}
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
            onBack={() => setActiveTab("explore")}
            onOpenContract={() => setShowContract(true)}
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
            onSwitchToOwner={onSwitchApp ? () => onSwitchApp("owner") : null}
          />
        );

      default:
        return null;
    }
  };

  const isModalOpen =
    showEnrolment ||
    showMap ||
    !!selectedCar ||
    showExtendRental ||
    showRoadsideClaim ||
    showWallet ||
    showDeliveryFlow;

  return (
    <SafeAreaView style={styles.appContainer}>
      <StatusBar barStyle="dark-content" />

      {/* Pantalla Activa */}
      <View style={styles.screenContainer}>{renderContent()}</View>

      {/* Barra de Navegación Inferior Exclusiva del Arrendatario */}
      {!isModalOpen && (
        <View style={styles.bottomTabBar}>
          <TouchableOpacity
            style={styles.tabItem}
            onPress={() => setActiveTab("explore")}
            activeOpacity={0.8}
          >
            <Icon
              name="search"
              size={24}
              color={activeTab === "explore" ? colors.primary : colors.textMuted}
            />
            <Text
              style={[
                styles.tabLabel,
                activeTab === "explore" && styles.tabLabelActive,
              ]}
            >
              Explorar
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.tabItem}
            onPress={() => setActiveTab("rentals")}
            activeOpacity={0.8}
          >
            <Icon
              name="calendar"
              size={24}
              color={activeTab === "rentals" ? colors.primary : colors.textMuted}
            />
            <Text
              style={[
                styles.tabLabel,
                activeTab === "rentals" && styles.tabLabelActive,
              ]}
            >
              Mis Arriendos
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.tabItem}
            onPress={() => setActiveTab("chat")}
            activeOpacity={0.8}
          >
            <View style={styles.chatIconWrapper}>
              <Icon
                name="chat"
                size={24}
                color={activeTab === "chat" ? colors.primary : colors.textMuted}
              />
              <View style={styles.unreadDot} />
            </View>
            <Text
              style={[
                styles.tabLabel,
                activeTab === "chat" && styles.tabLabelActive,
              ]}
            >
              Mensajes
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.tabItem}
            onPress={() => setActiveTab("profile")}
            activeOpacity={0.8}
          >
            <Icon
              name="profile"
              size={24}
              color={activeTab === "profile" ? colors.primary : colors.textMuted}
            />
            <Text
              style={[
                styles.tabLabel,
                activeTab === "profile" && styles.tabLabelActive,
              ]}
            >
              Mi Perfil
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Modal Cancelar Reserva */}
      {showCancelModal && (
        <CancelReservationModal
          reservation={activeReservation}
          onClose={() => setShowCancelModal(false)}
          onConfirmCancel={() => {
            setShowCancelModal(false);
            setActiveReservation(null);
            setActiveTab("rentals");
          }}
        />
      )}

      {/* Modal de Notificaciones */}
      {showNotifications && (
        <NotificationsScreen onClose={() => setShowNotifications(false)} />
      )}

      {/* Modal de Soporte */}
      {showSupport && <SupportScreen onClose={() => setShowSupport(false)} />}

      {/* Modal de Contrato */}
      {showContract && <ContractModal onClose={() => setShowContract(false)} />}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  appContainer: {
    flex: 1,
    width: "100%",
    maxWidth: 440,
    backgroundColor: colors.background,
    boxShadow: "0px 10px 28px rgba(15, 61, 62, 0.14)",
    elevation: 8,
  },
  screenContainer: {
    flex: 1,
  },
  bottomTabBar: {
    height: 74,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    paddingBottom: 16,
    paddingTop: 8,
  },
  tabItem: {
    alignItems: "center",
    gap: 4,
    minWidth: 64,
  },
  tabLabel: {
    fontSize: 11,
    color: colors.textMuted,
  },
  tabLabelActive: {
    fontWeight: "600",
    color: colors.primary,
  },
  chatIconWrapper: {
    position: "relative",
  },
  unreadDot: {
    position: "absolute",
    top: -2,
    right: -3,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.danger,
  },
});
