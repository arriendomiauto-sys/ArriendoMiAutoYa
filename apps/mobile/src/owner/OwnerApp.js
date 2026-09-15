import React, { useState, useEffect, useCallback } from "react";
import { StyleSheet, View } from "react-native";
import {
  colors,
  useApp,
  useBackAndroid,
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
  EditProfileScreen,
  MandatoDuenoModal,
  msjError,
  verificarMandatoAceptado,
  ChatListScreen,
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
  const { currentUser, pendingDeepLink, clearPendingDeepLink } = useApp();
  const identidadVerificada = currentUser?.estado_documentos === "verificado";

  // Pestañas de Navegación del Dueño. "Mensajes" ya no es pestaña: se abre
  // desde el ícono del header de cada pantalla (ver `showChat`).
  const [activeTab, setActiveTab] = useState("cars"); // 'cars' | 'bookings' | 'earnings' | 'profile'
  const [showChat, setShowChat] = useState(false);

  // No leídos reales para el globo de "Mensajes".
  const { noLeidos, refrescar: refrescarConversaciones } = useConversaciones();

  // Flota real del dueño autenticado (cualquier estado, no solo activos).
  const [misAutos, setMisAutos] = useState([]);
  const [errorFlota, setErrorFlota] = useState(null);
  const [cargandoFlota, setCargandoFlota] = useState(false);
  const cargarMisAutos = useCallback(async () => {
    setCargandoFlota(true);
    try {
      const data = await ApiClient.getMisAutos();
      setMisAutos(Array.isArray(data) ? data : []);
      setErrorFlota(null);
    } catch (err) {
      console.warn("[OwnerApp] No se pudo cargar la flota:", err.message);
      setErrorFlota(msjError(err, "No pudimos cargar tu flota."));
    } finally {
      setCargandoFlota(false);
    }
  }, []);
  useEffect(() => {
    cargarMisAutos();
    // Pre-cargar ganancias en segundo plano para que la pestaña abra al instante
    ApiClient.prefetchMisGanancias();
  }, [cargarMisAutos, currentUser?.id]);

  // Modales y Flujos Secundarios
  const [showAddCar, setShowAddCar] = useState(false);
  const [showEnrolment, setShowEnrolment] = useState(false);
  const [showTarjeta, setShowTarjeta] = useState(false);
  const [showEditProfile, setShowEditProfile] = useState(false);
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
  const [showMandato, setShowMandato] = useState(false);

  useEffect(() => {
    verificarMandatoAceptado(currentUser?.id).then((aceptado) => {
      if (!aceptado) setShowMandato(true);
    });
  }, [currentUser?.id]);

  // Deep link desde una notificación push tocada (ver AppContext). Solo
  // actúa mientras OwnerApp esté montado (mode === "owner"); si la reserva
  // no aparece en las reservas del dueño, se descarta en silencio.
  useEffect(() => {
    if (!pendingDeepLink) return;
    const { tipo, entidadId } = pendingDeepLink;
    if (tipo === "kyc") {
      setActiveTab("profile");
      clearPendingDeepLink();
      return;
    }
    if ((tipo === "reserva" || tipo === "mensaje" || tipo === "disputa") && entidadId) {
      ApiClient.getReservas("dueno")
        .then((lista) => {
          const r = (lista || []).find((x) => x.id === entidadId);
          if (!r) return;
          if (tipo === "mensaje") {
            setSelectedReservaForChat(r);
            setShowChat(true);
          } else if (tipo === "disputa") {
            setShowDisputes(true);
          } else {
            setActiveTab("bookings");
          }
        })
        .catch(() => {})
        .finally(clearPendingDeepLink);
      return;
    }
    clearPendingDeepLink();
  }, [pendingDeepLink]);

  const abrirMensajes = () => setShowChat(true);
  const cerrarMensajes = () => {
    setShowChat(false);
    setSelectedReservaForChat(null);
    // Al salir de Mensajes el backend ya marcó como leídos los que se
    // abrieron: es el momento de refrescar el contador del globo.
    refrescarConversaciones();
  };

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

  const renderContent = () => {
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

    if (showEditProfile) {
      return (
        <EditProfileScreen
          onBack={() => setShowEditProfile(false)}
          onDone={() => setShowEditProfile(false)}
          onOpenKyc={() => {
            setShowEditProfile(false);
            setShowEnrolment(true);
          }}
        />
      );
    }

    if (showDeliveryFlow) {
      return (
        <DeliveryScreen
          reserva={selectedReservaForDelivery}
          onBack={() => setShowDeliveryFlow(false)}
          onCompleteDelivery={() => {
            setShowDeliveryFlow(false);
            setSelectedReservaForDelivery(null);
          }}
          onOpenDisputes={() => {
            setShowDeliveryFlow(false);
            setSelectedReservaForDelivery(null);
            setShowDisputes(true);
          }}
        />
      );
    }

    if (showCalendar) {
      return <CarCalendarScreen car={selectedCarForModal} onBack={() => setShowCalendar(false)} />;
    }

    if (showMaintenance) {
      return <CarMaintenanceScreen car={selectedCarForModal} onBack={() => setShowMaintenance(false)} />;
    }

    if (showDisputes) {
      return <DisputesScreen onBack={() => setShowDisputes(false)} />;
    }

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
      return (
        <NotificationsScreen
          variant="owner"
          onBack={() => setShowNotifications(false)}
          onSelectNotification={(n) => {
            setShowNotifications(false);
            if (n.entidad_tipo !== "reserva" || !n.entidad_id) return;
            ApiClient.getReservas("dueno")
              .then((lista) => {
                const r = (lista || []).find((x) => x.id === n.entidad_id);
                if (!r) return;
                if (n.tipo === "mensaje") {
                  setSelectedReservaForChat(r);
                  setShowChat(true);
                } else {
                  setActiveTab("bookings");
                }
              })
              .catch(() => {});
          }}
        />
      );
    }

    if (showSupport) {
      return <SupportScreen variant="owner" onBack={() => setShowSupport(false)} />;
    }

    // Mensajes: fuera del navbar, se abre desde el header.
    if (showChat) {
      if (selectedReservaForChat) {
        return (
          <RentalChatScreen
            variant="owner"
            reservation={selectedReservaForChat}
            onBack={() => setSelectedReservaForChat(null)}
          />
        );
      }
      return <ChatListScreen rol="owner" onSelectReserva={setSelectedReservaForChat} onBack={cerrarMensajes} />;
    }

    switch (activeTab) {
      case "cars":
        return (
          <MyCarsScreen
            cars={misAutos}
            setCars={setMisAutos}
            error={errorFlota}
            loading={cargandoFlota}
            onRetry={cargarMisAutos}
            onAddNewCar={handleAddNewCar}
            identidadVerificada={identidadVerificada}
            onVerifyIdentity={() => setShowEnrolment(true)}
            noLeidos={noLeidos}
            onOpenChat={abrirMensajes}
            onOpenEarnings={() => setActiveTab("earnings")}
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
            noLeidos={noLeidos}
            onOpenChat={abrirMensajes}
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
            noLeidos={noLeidos}
            onOpenChat={abrirMensajes}
            onOpenDisputes={() => setShowDisputes(true)}
          />
        );

      case "profile":
        return (
          <OwnerProfileScreen
            cars={misAutos}
            noLeidos={noLeidos}
            onOpenChat={abrirMensajes}
            onOpenEditProfile={() => setShowEditProfile(true)}
            onOpenDisputes={() => setShowDisputes(true)}
            onOpenNotifications={() => setShowNotifications(true)}
            onOpenSupport={() => setShowSupport(true)}
            onOpenEnrolment={() => setShowEnrolment(true)}
            onOpenTarjeta={() => setShowTarjeta(true)}
          />
        );

      default:
        return null;
    }
  };

  const barraOculta =
    showEnrolment ||
    showTarjeta ||
    showEditProfile ||
    showDeliveryFlow ||
    showCalendar ||
    showMaintenance ||
    showDisputes ||
    showAddCar ||
    showNotifications ||
    showSupport ||
    showContract ||
    showChat;

  // Back físico de Android: capas abiertas en orden de apilado (la primera es
  // la más visible y la que cierra primero). `showContract` y `showMandato`
  // NO están acá: son <Modal> nativos que ya se cierran solos vía su
  // `onRequestClose`.
  const capasAbiertas = [];
  if (showEnrolment) capasAbiertas.push({ nivel: "kyc", onCerrar: () => setShowEnrolment(false) });
  if (showTarjeta) capasAbiertas.push({ nivel: "tarjetas", onCerrar: () => setShowTarjeta(false) });
  if (showEditProfile) capasAbiertas.push({ nivel: "editar-perfil", onCerrar: () => setShowEditProfile(false) });
  if (showDeliveryFlow) capasAbiertas.push({ nivel: "entrega", onCerrar: () => setShowDeliveryFlow(false) });
  if (showCalendar) capasAbiertas.push({ nivel: "calendario", onCerrar: () => setShowCalendar(false) });
  if (showMaintenance) capasAbiertas.push({ nivel: "mantencion", onCerrar: () => setShowMaintenance(false) });
  if (showDisputes) capasAbiertas.push({ nivel: "disputas", onCerrar: () => setShowDisputes(false) });
  if (showAddCar) capasAbiertas.push({ nivel: "alta-auto", onCerrar: () => setShowAddCar(false) });
  if (showNotifications) capasAbiertas.push({ nivel: "notificaciones", onCerrar: () => setShowNotifications(false) });
  if (showSupport) capasAbiertas.push({ nivel: "soporte", onCerrar: () => setShowSupport(false) });
  if (showChat) {
    if (selectedReservaForChat) {
      capasAbiertas.push({ nivel: "chat-reserva", onCerrar: () => setSelectedReservaForChat(null) });
    } else {
      capasAbiertas.push({ nivel: "mensajes", onCerrar: cerrarMensajes });
    }
  }
  if (activeTab === "bookings") capasAbiertas.push({ nivel: "solicitudes", onCerrar: () => setActiveTab("cars") });
  if (activeTab === "earnings") capasAbiertas.push({ nivel: "ganancias", onCerrar: () => setActiveTab("cars") });
  if (activeTab === "profile") capasAbiertas.push({ nivel: "perfil", onCerrar: () => setActiveTab("cars") });
  useBackAndroid(capasAbiertas);

  return (
    <View style={styles.appContainer}>
      <View style={styles.screenContainer}>{renderContent()}</View>

      {!barraOculta && (
        <TabBar
          tabs={[
            { id: "cars", icon: "car", label: "Mi Flota" },
            { id: "bookings", icon: "calendar", label: "Solicitudes" },
            { id: "earnings", icon: "card", label: "Ganancias" },
            { id: "profile", icon: "profile", label: "Mi Perfil" },
          ]}
          activeTab={activeTab}
          onChange={setActiveTab}
          centerAction={{ icon: "plus", label: "Publicar", onPress: handleAddNewCar }}
        />
      )}

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

      {showMandato && (
        <MandatoDuenoModal
          visible={showMandato}
          userId={currentUser?.id}
          onClose={() => setShowMandato(false)}
          onAccepted={() => setShowMandato(false)}
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
