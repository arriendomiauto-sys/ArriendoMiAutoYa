import React, { useState, useEffect, useCallback } from "react";
import { StyleSheet, View } from "react-native";
import {
  colors,
  useApp,
  ApiClient,
  showAlert,
  RentalChatScreen,
  TabBar,
  useConversaciones,
  NotificationsScreen,
  SupportScreen,
  ContractModal,
  DeliveryScreen,
  KycScreen,
  TarjetaScreen,
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
import { ChatListScreen } from "./screens/ChatListScreen";

export function OwnerApp() {
  const { currentUser } = useApp();
  const identidadVerificada = currentUser?.estado_documentos === "verificado";

  // Pestañas de Navegación del Dueño
  const [activeTab, setActiveTab] = useState("cars"); // 'cars' | 'bookings' | 'earnings' | 'chat' | 'profile'

  // No leídos reales para el globo de "Mensajes". Antes el punto rojo estaba
  // pintado a mano y se veía encendido siempre, hubiera mensajes o no.
  const { noLeidos, refrescar: refrescarConversaciones } = useConversaciones();

  // Flota real del dueño autenticado (cualquier estado, no solo activos) —
  // separada del listado público del marketplace.
  const [misAutos, setMisAutos] = useState([]);
  // Motivo del último fallo al traer la flota (o null). Antes solo se
  // registraba en consola: si GET /autos/mios fallaba, "Mi flota" quedaba
  // vacía y parecía que el dueño no tenía autos publicados.
  const [errorFlota, setErrorFlota] = useState(null);
  const cargarMisAutos = useCallback(async () => {
    try {
      const data = await ApiClient.getMisAutos();
      setMisAutos(Array.isArray(data) ? data : []);
      setErrorFlota(null);
    } catch (err) {
      console.warn("[OwnerApp] No se pudo cargar la flota:", err.message);
      setErrorFlota(err?.message || "No pudimos cargar tu flota.");
    }
  }, []);
  // Se reintenta cuando aparece el perfil: el primer render puede ocurrir
  // antes de que la sesión de Supabase esté disponible, y ahí la petición
  // se iba sin token y volvía 401 dejando la flota vacía para siempre.
  useEffect(() => {
    cargarMisAutos();
  }, [cargarMisAutos, currentUser?.id]);

  // Modales y Flujos Secundarios
  const [showAddCar, setShowAddCar] = useState(false);
  const [showEnrolment, setShowEnrolment] = useState(false);
  const [showTarjeta, setShowTarjeta] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [showMaintenance, setShowMaintenance] = useState(false);
  const [showDeliveryFlow, setShowDeliveryFlow] = useState(false);
  const [showDisputes, setShowDisputes] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showSupport, setShowSupport] = useState(false);
  const [showContract, setShowContract] = useState(false);
  const [selectedCarForModal, setSelectedCarForModal] = useState(null);
  const [selectedReservaForDelivery, setSelectedReservaForDelivery] = useState(null);
  const [selectedReservaForChat, setSelectedReservaForChat] = useState(null);
  const [selectedReservaForContract, setSelectedReservaForContract] = useState(null);

  const handleAddNewCar = () => {
    if (!identidadVerificada) {
      showAlert(
        "Verifica tu identidad",
        "Antes de publicar un vehículo necesitamos confirmar quién eres: sube tu carnet y una selfie. Toma un par de minutos.",
        [
          { text: "Ahora no", style: "cancel" },
          { text: "Validar identidad", onPress: () => setShowEnrolment(true) },
        ]
      );
      return;
    }
    // Sin tarjeta validada, el backend igual va a rechazar la publicación —
    // mejor avisar ANTES de que llene todo el formulario del auto, con una
    // salida directa a agregarla, en vez de que se entere recién al final.
    if (currentUser?.tarjeta_estado !== "validada") {
      showAlert(
        "Necesitas una tarjeta registrada",
        "Es la garantía con la que se cobra el deducible, los cargos de la devolución y los peajes que lleguen después. Puedes agregarla ahora.",
        [
          { text: "Ahora no", style: "cancel" },
          { text: "Agregar tarjeta", onPress: () => setShowTarjeta(true) },
        ]
      );
      return;
    }
    setShowAddCar(true);
  };

  // Renderizar la pantalla activa según la pestaña seleccionada
  const renderContent = () => {
    // Verificación de Identidad KYC (mismo componente que usa el registro)
    if (showEnrolment) {
      return (
        <KycScreen
          role="owner"
          onBack={() => setShowEnrolment(false)}
          onComplete={() => setShowEnrolment(false)}
        />
      );
    }

    if (showTarjeta) {
      return <TarjetaScreen onBack={() => setShowTarjeta(false)} onDone={() => setShowTarjeta(false)} />;
    }

    // Flujo Crítico de Entrega y Devolución 360°
    if (showDeliveryFlow) {
      return (
        <DeliveryScreen
          reserva={selectedReservaForDelivery}
          onBack={() => setShowDeliveryFlow(false)}
          onCompleteDelivery={() => {
            setShowDeliveryFlow(false);
            setSelectedReservaForDelivery(null);
          }}
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

    // Publicar / editar auto
    if (showAddCar) {
      return (
        <AddEditCarScreen
          onBack={() => setShowAddCar(false)}
          onComplete={() => {
            setShowAddCar(false);
            cargarMisAutos();
          }}
        />
      );
    }

    if (showNotifications) {
      return <NotificationsScreen variant="owner" onBack={() => setShowNotifications(false)} />;
    }

    if (showSupport) {
      return <SupportScreen variant="owner" onBack={() => setShowSupport(false)} />;
    }

    switch (activeTab) {
      case "cars":
        return (
          <MyCarsScreen
            cars={misAutos}
            setCars={setMisAutos}
            error={errorFlota}
            onRetry={cargarMisAutos}
            onAddNewCar={handleAddNewCar}
            identidadVerificada={identidadVerificada}
            onVerifyIdentity={() => setShowEnrolment(true)}
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
            onOpenDelivery={(reserva) => {
              setSelectedReservaForDelivery(reserva);
              setShowDeliveryFlow(true);
            }}
            onOpenContract={(reserva) => {
              setSelectedReservaForContract(reserva);
              setShowContract(true);
            }}
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
        if (selectedReservaForChat) {
          return (
            <RentalChatScreen
              variant="owner"
              reservation={selectedReservaForChat}
              onBack={() => setSelectedReservaForChat(null)}
            />
          );
        }
        return <ChatListScreen onSelectReserva={setSelectedReservaForChat} />;

      case "profile":
        return (
          <OwnerProfileScreen
            cars={misAutos}
            onOpenMyCars={() => setActiveTab("cars")}
            onOpenEarnings={() => setActiveTab("earnings")}
            onOpenMaintenance={() => {
              if (misAutos?.[0]) setSelectedCarForModal(misAutos[0]);
              setShowMaintenance(true);
            }}
            onOpenDisputes={() => setShowDisputes(true)}
            onOpenNotifications={() => setShowNotifications(true)}
            onOpenSupport={() => setShowSupport(true)}
            onOpenContract={() => setActiveTab("bookings")}
            onOpenChat={() => setActiveTab("chat")}
            onOpenEnrolment={() => setShowEnrolment(true)}
            onOpenTarjeta={() => setShowTarjeta(true)}
          />
        );

      default:
        return null;
    }
  };

  return (
    <View style={styles.appContainer}>
      {/* Pantalla Activa */}
      <View style={styles.screenContainer}>{renderContent()}</View>

      {/* Barra de Navegación Inferior Exclusiva del Dueño */}
      {!showEnrolment &&
        !showTarjeta &&
        !showDeliveryFlow &&
        !showCalendar &&
        !showMaintenance &&
        !showDisputes &&
        !showAddCar &&
        !showNotifications &&
        !showSupport &&
        !showContract && (
          <TabBar
            tabs={[
              { id: "cars", icon: "car", label: "Mi Flota" },
              { id: "bookings", icon: "calendar", label: "Solicitudes" },
              { id: "earnings", icon: "card", label: "Ganancias" },
              { id: "chat", icon: "chat", label: "Mensajes", badge: noLeidos },
              { id: "profile", icon: "profile", label: "Mi Perfil" },
            ]}
            activeTab={activeTab}
            onChange={(id) => {
              setActiveTab(id);
              // Salir de Mensajes es el momento en que los no leídos
              // cambiaron: el backend los marcó al abrir la conversación.
              if (activeTab === "chat" && id !== "chat") refrescarConversaciones();
            }}
          />
        )}

      {/* Modal de Contrato (RN Modal: se monta en su propia capa) */}
      {showContract && (
        <ContractModal
          visible={showContract}
          reservation={selectedReservaForContract}
          onClose={() => {
            setShowContract(false);
            setSelectedReservaForContract(null);
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  appContainer: {
    flex: 1,
    backgroundColor: colors.darkBg,
  },
  screenContainer: {
    flex: 1,
  },
});
