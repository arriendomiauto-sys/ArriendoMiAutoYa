import React, { useState } from "react";
import {
  StyleSheet,
  View,
  SafeAreaView,
  StatusBar,
  TouchableOpacity,
  Text,
} from "react-native";
import { AppProvider, useApp } from "./src/context/AppContext";
import { colors } from "./src/theme/colors";

// Components
import { Header } from "./src/components/Header";
import { Icon } from "./src/components/Icon";

// Auth & KYC Screens (01 - 07)
import { SplashScreen } from "./src/screens/auth/SplashScreen";
import { OnboardingScreen } from "./src/screens/auth/OnboardingScreen";
import { WelcomeScreen } from "./src/screens/auth/WelcomeScreen";
import { RegisterScreen } from "./src/screens/auth/RegisterScreen";
import { LoginScreen } from "./src/screens/auth/LoginScreen";
import { EnrolmentScreen } from "./src/screens/passenger/EnrolmentScreen";

// Passenger Screens (08 - 19)
import { MarketplaceScreen } from "./src/screens/passenger/MarketplaceScreen";
import { MapExploreScreen } from "./src/screens/passenger/MapExploreScreen";
import { CarDetailScreen } from "./src/screens/passenger/CarDetailScreen";
import { PaymentMethodsScreen } from "./src/screens/passenger/PaymentMethodsScreen";
import { ActiveRentalScreen } from "./src/screens/passenger/ActiveRentalScreen";
import { RentalHistoryScreen } from "./src/screens/passenger/RentalHistoryScreen";
import { CancelReservationModal } from "./src/screens/passenger/CancelReservationModal";

// Critical Delivery & Return Flow (20 - 28)
import { DeliveryScreen } from "./src/screens/driver/DeliveryScreen";

// Driver Screens
import { MyCarsScreen } from "./src/screens/driver/MyCarsScreen";
import { AddEditCarScreen } from "./src/screens/driver/AddEditCarScreen";
import { EarningsScreen } from "./src/screens/driver/EarningsScreen";

// Shared Modals & Screens
import { ProfileScreen } from "./src/screens/shared/ProfileScreen";
import { RentalChatScreen } from "./src/screens/shared/RentalChatScreen";
import { ContractModal } from "./src/screens/shared/ContractModal";
import { NotificationsScreen } from "./src/screens/shared/NotificationsScreen";
import { SupportScreen } from "./src/screens/shared/SupportScreen";

function MainContent() {
  const { mode, isAuthenticated, currentUser, activeReservation, setActiveReservation } = useApp();

  // App Flow State
  const [appState, setAppState] = useState("splash"); // 'splash' | 'onboarding' | 'welcome' | 'register' | 'login' | 'main'
  const [activeTab, setActiveTab] = useState("marketplace"); // 'marketplace' | 'reservas' | 'mensajes' | 'perfil'

  // Modals & Navigation Stack
  const [selectedCar, setSelectedCar] = useState(null);
  const [showMap, setShowMap] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [showDeliveryFlow, setShowDeliveryFlow] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showEnrolment, setShowEnrolment] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [showContract, setShowContract] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showSupport, setShowSupport] = useState(false);
  const [showAddCar, setShowAddCar] = useState(false);

  // Splash Flow
  if (appState === "splash") {
    return <SplashScreen onFinish={() => setAppState("onboarding")} />;
  }

  // Onboarding Flow (02a, 02b, 02c)
  if (appState === "onboarding") {
    return <OnboardingScreen onFinish={() => setAppState("welcome")} />;
  }

  // Welcome Screen (03)
  if (appState === "welcome") {
    return (
      <WelcomeScreen
        onNavigate={(screen) => {
          if (screen === "login") setAppState("login");
          else if (screen === "register") setAppState("register");
          else setAppState("main");
        }}
      />
    );
  }

  // Register Screen (04)
  if (appState === "register") {
    return (
      <RegisterScreen
        onNavigate={(screen) => {
          if (screen === "welcome") setAppState("welcome");
          else if (screen === "login") setAppState("login");
          else setAppState("main");
        }}
      />
    );
  }

  // Login Screen
  if (appState === "login") {
    return (
      <LoginScreen
        onNavigate={(screen) => {
          if (screen === "welcome") setAppState("welcome");
          else if (screen === "register") setAppState("register");
          else setAppState("main");
        }}
      />
    );
  }

  // KYC Enrolment (05a, 05b, 05c, 06a, 06b)
  if (showEnrolment) {
    return (
      <EnrolmentScreen
        onBack={() => setShowEnrolment(false)}
        onComplete={() => setShowEnrolment(false)}
      />
    );
  }

  // Map Screen (09 & 10)
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

  // Car Detail Screen (11, 12, 13)
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
            setActiveTab("reservas");
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

  // Critical Delivery & Return Suite (20 to 28)
  if (showDeliveryFlow) {
    return (
      <DeliveryScreen
        onBack={() => setShowDeliveryFlow(false)}
        onCompleteDelivery={() => setShowDeliveryFlow(false)}
      />
    );
  }

  // Active Screen Content based on Bottom Tab
  const renderTabContent = () => {
    if (activeTab === "marketplace") {
      if (mode === "conductor") {
        return (
          <MyCarsScreen
            onOpenAddCar={() => setShowAddCar(true)}
            onOpenDelivery={() => setShowDeliveryFlow(true)}
            onOpenEarnings={() => setActiveTab("reservas")}
          />
        );
      }
      return (
        <MarketplaceScreen
          onSelectCar={(car) => setSelectedCar(car)}
          onOpenMap={() => setShowMap(true)}
          onOpenFilters={() => setShowMap(true)}
        />
      );
    }

    if (activeTab === "reservas") {
      if (mode === "conductor") {
        return <EarningsScreen onBack={() => setActiveTab("marketplace")} />;
      }
      if (activeReservation) {
        return (
          <ActiveRentalScreen
            reservation={activeReservation}
            onBack={() => setActiveReservation(null)}
            onStartDelivery={() => setShowDeliveryFlow(true)}
            onStartReturn={() => setShowDeliveryFlow(true)}
            onCancelReservation={() => setShowCancelModal(true)}
            onOpenChat={() => setShowChat(true)}
            onOpenContract={() => setShowContract(true)}
          />
        );
      }
      return (
        <RentalHistoryScreen
          onSelectReservation={(res) => setActiveReservation(res)}
          onBack={() => setActiveTab("marketplace")}
        />
      );
    }

    if (activeTab === "mensajes") {
      return (
        <RentalChatScreen
          onBack={() => setActiveTab("marketplace")}
          onOpenContract={() => setShowContract(true)}
        />
      );
    }

    if (activeTab === "perfil") {
      return (
        <ProfileScreen
          onOpenEnrolment={() => setShowEnrolment(true)}
          onOpenPaymentMethods={() => setShowPayment(true)}
          onOpenRentalHistory={() => setActiveTab("reservas")}
          onOpenMyCars={() => setActiveTab("marketplace")}
          onOpenEarnings={() => setActiveTab("reservas")}
          onOpenNotifications={() => setShowNotifications(true)}
          onOpenSupport={() => setShowSupport(true)}
          onOpenContract={() => setShowContract(true)}
          onOpenChat={() => setActiveTab("mensajes")}
        />
      );
    }

    return null;
  };

  return (
    <SafeAreaView style={styles.appContainer}>
      <StatusBar barStyle="dark-content" />

      {/* Main Active Tab Content */}
      <View style={styles.screenContainer}>{renderTabContent()}</View>

      {/* Bottom Navigation Bar (Pantalla 08 / 17 / 18) */}
      <View style={styles.bottomTabBar}>
        <TouchableOpacity
          style={styles.tabItem}
          onPress={() => setActiveTab("marketplace")}
          activeOpacity={0.8}
        >
          <Icon
            name="search"
            size={24}
            color={activeTab === "marketplace" ? colors.primary : colors.textMuted}
          />
          <Text
            style={[
              styles.tabLabel,
              activeTab === "marketplace" && styles.tabLabelActive,
            ]}
          >
            Buscar
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.tabItem}
          onPress={() => setActiveTab("reservas")}
          activeOpacity={0.8}
        >
          <Icon
            name="calendar"
            size={24}
            color={activeTab === "reservas" ? colors.primary : colors.textMuted}
          />
          <Text
            style={[
              styles.tabLabel,
              activeTab === "reservas" && styles.tabLabelActive,
            ]}
          >
            Reservas
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.tabItem}
          onPress={() => setActiveTab("mensajes")}
          activeOpacity={0.8}
        >
          <View style={styles.chatIconWrapper}>
            <Icon
              name="chat"
              size={24}
              color={activeTab === "mensajes" ? colors.primary : colors.textMuted}
            />
            <View style={styles.unreadDot} />
          </View>
          <Text
            style={[
              styles.tabLabel,
              activeTab === "mensajes" && styles.tabLabelActive,
            ]}
          >
            Mensajes
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.tabItem}
          onPress={() => setActiveTab("perfil")}
          activeOpacity={0.8}
        >
          <Icon
            name="profile"
            size={24}
            color={activeTab === "perfil" ? colors.primary : colors.textMuted}
          />
          <Text
            style={[
              styles.tabLabel,
              activeTab === "perfil" && styles.tabLabelActive,
            ]}
          >
            Perfil
          </Text>
        </TouchableOpacity>
      </View>

      {/* Cancel Reservation Modal (Pantalla 19) */}
      {showCancelModal && (
        <CancelReservationModal
          reservation={activeReservation}
          onClose={() => setShowCancelModal(false)}
          onConfirmCancel={(refund) => {
            setShowCancelModal(false);
            setActiveReservation(null);
            setActiveTab("reservas");
          }}
        />
      )}

      {/* Notifications Modal */}
      {showNotifications && (
        <NotificationsScreen onClose={() => setShowNotifications(false)} />
      )}

      {/* Support / Help Center Modal */}
      {showSupport && <SupportScreen onClose={() => setShowSupport(false)} />}

      {/* Digital Legal Contract Modal */}
      {showContract && <ContractModal onClose={() => setShowContract(false)} />}

      {/* Add / Edit Car Modal */}
      {showAddCar && <AddEditCarScreen onBack={() => setShowAddCar(false)} />}
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <AppProvider>
      <View style={styles.outerFrame}>
        <MainContent />
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
    fontSize: 12,
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
