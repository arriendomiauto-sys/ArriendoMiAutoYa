import React, { useState } from "react";
import {
  StyleSheet,
  View,
  SafeAreaView,
  StatusBar,
  TouchableOpacity,
  Text,
} from "react-native";
import {
  colors,
  Icon,
  RentalChatScreen,
  NotificationsScreen,
  SupportScreen,
  ContractModal,
  DeliveryScreen,
} from "@rentacar/mobile-shared";

// Screens del Dueño
import { MyCarsScreen } from "./screens/MyCarsScreen";
import { AddEditCarScreen } from "./screens/AddEditCarScreen";
import { CarCalendarScreen } from "./screens/CarCalendarScreen";
import { CarMaintenanceScreen } from "./screens/CarMaintenanceScreen";
import { DriverBookingsScreen } from "./screens/DriverBookingsScreen";
import { EarningsScreen } from "./screens/EarningsScreen";
import { DisputesScreen } from "./screens/DisputesScreen";
import { OwnerProfileScreen } from "./screens/OwnerProfileScreen";

export function OwnerApp() {
  // Pestañas de Navegación del Dueño
  const [activeTab, setActiveTab] = useState("cars"); // 'cars' | 'bookings' | 'earnings' | 'chat' | 'profile'

  // Modales y Flujos Secundarios
  const [showAddCar, setShowAddCar] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [showMaintenance, setShowMaintenance] = useState(false);
  const [showDeliveryFlow, setShowDeliveryFlow] = useState(false);
  const [showDisputes, setShowDisputes] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showSupport, setShowSupport] = useState(false);
  const [showContract, setShowContract] = useState(false);
  const [selectedCarForModal, setSelectedCarForModal] = useState(null);

  // Renderizar la pantalla activa según la pestaña seleccionada
  const renderContent = () => {
    // Flujo Crítico de Entrega y Devolución 360°
    if (showDeliveryFlow) {
      return (
        <DeliveryScreen
          onBack={() => setShowDeliveryFlow(false)}
          onCompleteDelivery={() => setShowDeliveryFlow(false)}
        />
      );
    }

    // Modal de Calendario de Disponibilidad
    if (showCalendar) {
      return (
        <CarCalendarScreen
          car={selectedCarForModal}
          onBack={() => setShowCalendar(false)}
        />
      );
    }

    // Modal de Mantenimiento y Alertas Técnicas
    if (showMaintenance) {
      return (
        <CarMaintenanceScreen
          car={selectedCarForModal}
          onBack={() => setShowMaintenance(false)}
        />
      );
    }

    // Modal de Disputas y Daños
    if (showDisputes) {
      return <DisputesScreen onBack={() => setShowDisputes(false)} />;
    }

    switch (activeTab) {
      case "cars":
        return (
          <MyCarsScreen
            onAddNewCar={() => setShowAddCar(true)}
            onOpenDelivery={() => setShowDeliveryFlow(true)}
            onOpenCalendar={(car) => {
              setSelectedCarForModal(car);
              setShowCalendar(true);
            }}
            onOpenMaintenance={(car) => {
              setSelectedCarForModal(car);
              setShowMaintenance(true);
            }}
          />
        );

      case "bookings":
        return (
          <DriverBookingsScreen
            onStartDelivery={() => setShowDeliveryFlow(true)}
            onOpenChat={() => setActiveTab("chat")}
            onOpenContract={() => setShowContract(true)}
          />
        );

      case "earnings":
        return (
          <EarningsScreen
            onOpenDisputes={() => setShowDisputes(true)}
            onBack={() => setActiveTab("cars")}
          />
        );

      case "chat":
        return (
          <RentalChatScreen
            variant="owner"
            onBack={() => setActiveTab("cars")}
            onOpenContract={() => setShowContract(true)}
          />
        );

      case "profile":
        return (
          <OwnerProfileScreen
            onOpenMyCars={() => setActiveTab("cars")}
            onOpenEarnings={() => setActiveTab("earnings")}
            onOpenMaintenance={() => setShowMaintenance(true)}
            onOpenDisputes={() => setShowDisputes(true)}
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

  return (
    <SafeAreaView style={styles.appContainer}>
      <StatusBar barStyle="dark-content" />

      {/* Pantalla Activa */}
      <View style={styles.screenContainer}>{renderContent()}</View>

      {/* Barra de Navegación Inferior Exclusiva del Dueño */}
      {!showDeliveryFlow && !showCalendar && !showMaintenance && !showDisputes && (
        <View style={styles.bottomTabBar}>
          <TouchableOpacity
            style={styles.tabItem}
            onPress={() => setActiveTab("cars")}
            activeOpacity={0.8}
          >
            <Icon
              name="car"
              size={24}
              color={activeTab === "cars" ? colors.primary : colors.textMuted}
            />
            <Text
              style={[
                styles.tabLabel,
                activeTab === "cars" && styles.tabLabelActive,
              ]}
            >
              Mi Flota
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.tabItem}
            onPress={() => setActiveTab("bookings")}
            activeOpacity={0.8}
          >
            <Icon
              name="calendar"
              size={24}
              color={activeTab === "bookings" ? colors.primary : colors.textMuted}
            />
            <Text
              style={[
                styles.tabLabel,
                activeTab === "bookings" && styles.tabLabelActive,
              ]}
            >
              Solicitudes
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.tabItem}
            onPress={() => setActiveTab("earnings")}
            activeOpacity={0.8}
          >
            <Icon
              name="card"
              size={24}
              color={activeTab === "earnings" ? colors.primary : colors.textMuted}
            />
            <Text
              style={[
                styles.tabLabel,
                activeTab === "earnings" && styles.tabLabelActive,
              ]}
            >
              Ganancias
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

      {/* Modal Agregar / Editar Auto */}
      {showAddCar && <AddEditCarScreen onBack={() => setShowAddCar(false)} />}

      {/* Modal de Notificaciones */}
      {showNotifications && (
        <NotificationsScreen variant="owner" onClose={() => setShowNotifications(false)} />
      )}

      {/* Modal de Soporte */}
      {showSupport && <SupportScreen variant="owner" onClose={() => setShowSupport(false)} />}

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
    minWidth: 58,
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
