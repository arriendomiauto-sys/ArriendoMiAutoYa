import React, { useState, useEffect, useCallback } from "react";
import { View } from "react-native";
let GestureDetector = null;
try {
  GestureDetector = require("react-native-gesture-handler").GestureDetector;
} catch {
  // react-native-gesture-handler no disponible en binario nativo
}
import {
  colors,
  useApp,
  useBackAndroid,
  showAlert,
  TarjetaScreen,
  EditProfileScreen,
  ApiClient,
  ScreenTransition,
  useDireccionTransicion,
} from "@rentacar/mobile-shared";

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
  ChatListScreen,
  NotificationsScreen,
  SupportScreen,
  AntecedentesScreen,
  ContractModal,
  KycScreen,
  CompletarLicenciaScreen,
  TabBar,
  useConversaciones,
  PromoterPanelScreen,
  AppTourScreen,
} from "@rentacar/mobile-shared";

export function RenterApp() {
  const {
    activeReservation,
    setActiveReservation,
    currentUser,
    pendingDeepLink,
    clearPendingDeepLink,
    tourVisto,
    marcarTourVisto,
  } = useApp();
  const identidadVerificada = currentUser?.estado_documentos === "verificado";
  // Licencia lista para arrendar: "verificada", o una cuenta antigua que ya
  // tenía la clase cargada antes de que existiera `licencia_estado`.
  const licenciaListaParaArrendar =
    currentUser?.licencia_estado === "verificada" ||
    (!currentUser?.licencia_estado && !!currentUser?.licencia_clase);

  // Pestañas de Navegación del Arrendatario
  const [activeTab, setActiveTab] = useState("explore"); // 'explore' | 'rentals' | 'chat' | 'profile'

  // No leídos reales para el globo de "Mensajes". Antes el punto rojo estaba
  // pintado a mano y se veía encendido siempre, hubiera mensajes o no.
  const { noLeidos, refrescar: refrescarConversaciones } = useConversaciones();

  // Modales y Flujos Secundarios
  const [selectedCar, setSelectedCar] = useState(null);
  const [bookingDraft, setBookingDraft] = useState(null);
  // Reanudar el pago de una reserva pendiente_pago ya existente (desde
  // "Mis reservas" o el reintento en el arriendo activo) — no pasa por la
  // ficha del auto, va directo a elegir tarjetas.
  const [resumingReservation, setResumingReservation] = useState(null);
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
  const [showAntecedentes, setShowAntecedentes] = useState(false);
  const [showContract, setShowContract] = useState(false);
  const [showWallet, setShowWallet] = useState(false);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [showLicencia, setShowLicencia] = useState(false);
  const [showPromoterPanel, setShowPromoterPanel] = useState(false);
  // Conversación elegida a mano desde la lista de Mensajes (cuando no hay un
  // arriendo activo obvio al que entrar directo).
  const [chatReservaSeleccionada, setChatReservaSeleccionada] = useState(null);

  // Callbacks estables del marketplace: con CarCard memoizado, una nueva
  // referencia por render haría renderizar los cards de la lista cada vez
  // que cambia el contexto (autos, facturación, etc.). Viven acá, arriba de
  // los early-returns de `renderContent`, para respetar las reglas de hooks.
  const abrirAuto = useCallback((car) => setSelectedCar(car), []);
  const abrirMapa = useCallback(() => setShowMap(true), []);
  const abrirFavoritos = useCallback(() => setShowFavorites(true), []);
  const abrirEnrolamiento = useCallback(() => setShowEnrolment(true), []);
  const abrirArriendos = useCallback(() => setActiveTab("rentals"), []);

  // Deep link desde una notificación push tocada (ver AppContext). Solo
  // actúa mientras RenterApp esté montado (mode === "renter"); si la
  // reserva no aparece en las reservas del cliente (p. ej. llegó estando en
  // modo dueño), se descarta en silencio.
  useEffect(() => {
    if (!pendingDeepLink) return;
    const { tipo, entidadId } = pendingDeepLink;
    if (tipo === "kyc") {
      setActiveTab("profile");
      clearPendingDeepLink();
      return;
    }
    if ((tipo === "reserva" || tipo === "mensaje" || tipo === "disputa") && entidadId) {
      ApiClient.getReservas("cliente")
        .then((lista) => {
          const r = (lista || []).find((x) => x.id === entidadId);
          if (r) {
            setActiveReservation(r);
            setActiveTab(tipo === "mensaje" ? "chat" : "rentals");
          }
        })
        .catch(() => {})
        .finally(clearPendingDeepLink);
      return;
    }
    clearPendingDeepLink();
  }, [pendingDeepLink]);

  // Renderizar la pantalla activa según la pestaña seleccionada
  const renderContent = () => {
    // 0. Recorrido guiado, una sola vez, la primera vez que la cuenta llega
    // a esta pantalla (tourVisto arranca en `null` mientras se lee del
    // almacenamiento -- recién cuando es explícitamente `false` se sabe que
    // nunca se vio). Va primero: en una cuenta recién creada no hay ninguna
    // otra capa abierta todavía, así que no le pisa nada.
    if (tourVisto === false) {
      return <AppTourScreen role="renter" onFinish={marcarTourVisto} />;
    }

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

    // 1c. Validación de licencia para quien se verificó solo como dueño y
    // ahora quiere arrendar (mini-flujo: solo la licencia, reusa identidad).
    if (showLicencia) {
      return (
        <CompletarLicenciaScreen
          onCancel={() => setShowLicencia(false)}
          onDone={() => setShowLicencia(false)}
        />
      );
    }

    // 1c2. Panel de "invita y gana" (código propio + estadísticas)
    if (showPromoterPanel) {
      return <PromoterPanelScreen onBack={() => setShowPromoterPanel(false)} />;
    }

    // 1b. Editar datos de contacto de la cuenta (nombre / teléfono)
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

    // 2c. Reanudar el pago de una reserva pendiente_pago ya existente.
    if (resumingReservation) {
      return (
        <PaymentMethodsScreen
          existingReservation={resumingReservation}
          onBack={() => setResumingReservation(null)}
          onPaymentSuccess={(res) => {
            setResumingReservation(null);
            if (res) {
              setActiveReservation(res);
              setActiveTab("rentals");
            }
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
            // Verificado como dueño (o antes de que existiera el flujo de
            // licencia): falta validar la licencia para poder conducir.
            if (!licenciaListaParaArrendar) {
              const enRevision = currentUser?.licencia_estado === "revision";
              showAlert(
                enRevision ? "Tu licencia está en revisión" : "Falta validar tu licencia",
                enRevision
                  ? "Un ejecutivo la está revisando. Te avisamos apenas puedas reservar."
                  : "Para arrendar necesitamos validar tu licencia de conducir. Son 30 segundos: una foto y listo.",
                enRevision
                  ? [{ text: "Entendido", style: "cancel" }]
                  : [
                      { text: "Ahora no", style: "cancel" },
                      { text: "Validar licencia", onPress: () => setShowLicencia(true) },
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
      return (
        <NotificationsScreen
          variant="renter"
          onBack={() => setShowNotifications(false)}
          onSelectNotification={(n) => {
            setShowNotifications(false);
            if (n.entidad_tipo !== "reserva" || !n.entidad_id) return;
            ApiClient.getReservas("cliente")
              .then((lista) => {
                const r = (lista || []).find((x) => x.id === n.entidad_id);
                if (!r) return;
                setActiveReservation(r);
                setActiveTab(n.tipo === "mensaje" ? "chat" : "rentals");
              })
              .catch(() => {});
          }}
        />
      );
    }
    if (showSupport) {
      return <SupportScreen variant="renter" onBack={() => setShowSupport(false)} />;
    }
    if (showAntecedentes) {
      return <AntecedentesScreen onBack={() => setShowAntecedentes(false)} />;
    }

    // 9. Contenido de las Pestañas Principales
    switch (activeTab) {
      case "explore":
        return (
          <MarketplaceScreen
            onSelectCar={abrirAuto}
            onOpenMap={abrirMapa}
            onOpenFavorites={abrirFavoritos}
            onVerifyIdentity={abrirEnrolamiento}
            onOpenActiveRental={abrirArriendos}
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
              onResumirPago={(res) => setResumingReservation(res)}
              onUpdateReservation={(updated) => setActiveReservation((prev) => ({ ...prev, ...updated }))}
            />
          );
        }
        return (
          <RentalHistoryScreen
            onSelectReservation={(res) => setActiveReservation(res)}
            onContinuarPago={(res) => setResumingReservation(res)}
            onExplorar={() => setActiveTab("explore")}
            onBack={() => setActiveTab("explore")}
          />
        );

      case "chat":
        // Con un arriendo activo, entra directo a esa conversación (como
        // siempre); si no, o al volver de una elegida a mano, muestra la
        // lista de conversaciones — igual que ya tiene el dueño.
        if (chatReservaSeleccionada || activeReservation) {
          return (
            <RentalChatScreen
              variant="renter"
              reservation={chatReservaSeleccionada || activeReservation}
              onBack={() => (chatReservaSeleccionada ? setChatReservaSeleccionada(null) : setActiveTab("explore"))}
            />
          );
        }
        return (
          <ChatListScreen
            rol="renter"
            onSelectReserva={setChatReservaSeleccionada}
            onBack={() => setActiveTab("explore")}
          />
        );

      case "profile":
        return (
          <RenterProfileScreen
            onOpenEnrolment={() => setShowEnrolment(true)}
            onOpenPaymentMethods={() => setShowWallet(true)}
            onOpenEditProfile={() => setShowEditProfile(true)}
            onOpenFavorites={() => setShowFavorites(true)}
            onOpenNotifications={() => setShowNotifications(true)}
            onOpenSupport={() => setShowSupport(true)}
            onOpenAntecedentes={() => setShowAntecedentes(true)}
            onOpenPromoterPanel={() => setShowPromoterPanel(true)}
          />
        );

      default:
        return null;
    }
  };

  const isModalOpen =
    showEnrolment ||
    showEditProfile ||
    showPromoterPanel ||
    showMap ||
    showFavorites ||
    !!selectedCar ||
    !!resumingReservation ||
    showExtendRental ||
    showRoadsideClaim ||
    showWallet ||
    showMyQRCode ||
    showCancelModal ||
    showNotifications ||
    showSupport ||
    showAntecedentes ||
    showContract;

  // Back físico de Android: capas abiertas en orden de apilado (la primera es
  // la más visible y la que cierra primero). `showContract` NO está acá: es un
  // <Modal> nativo que ya se cierra solo vía su `onRequestClose`.
  const capasAbiertas = [];
  if (showEnrolment) capasAbiertas.push({ nivel: "kyc", onCerrar: () => setShowEnrolment(false) });
  if (showLicencia) capasAbiertas.push({ nivel: "licencia", onCerrar: () => setShowLicencia(false) });
  if (showPromoterPanel) capasAbiertas.push({ nivel: "invita-y-gana", onCerrar: () => setShowPromoterPanel(false) });
  if (showEditProfile) capasAbiertas.push({ nivel: "editar-perfil", onCerrar: () => setShowEditProfile(false) });
  if (showFavorites) capasAbiertas.push({ nivel: "favoritos", onCerrar: () => setShowFavorites(false) });
  if (showMap) capasAbiertas.push({ nivel: "mapa", onCerrar: () => setShowMap(false) });
  if (resumingReservation) capasAbiertas.push({ nivel: "pago-reanudado", onCerrar: () => setResumingReservation(null) });
  if (selectedCar && showPayment) capasAbiertas.push({ nivel: "pago", onCerrar: () => setShowPayment(false) });
  if (selectedCar && !showPayment) capasAbiertas.push({ nivel: "detalle-auto", onCerrar: () => setSelectedCar(null) });
  if (showExtendRental && activeReservation) capasAbiertas.push({ nivel: "extender-arriendo", onCerrar: () => setShowExtendRental(false) });
  if (showRoadsideClaim) capasAbiertas.push({ nivel: "asistencia-ruta", onCerrar: () => setShowRoadsideClaim(false) });
  if (showWallet) capasAbiertas.push({ nivel: "tarjetas", onCerrar: () => setShowWallet(false) });
  if (showMyQRCode) capasAbiertas.push({ nivel: "qr", onCerrar: () => setShowMyQRCode(false) });
  if (showCancelModal) capasAbiertas.push({ nivel: "cancelar-reserva", onCerrar: () => setShowCancelModal(false) });
  if (showNotifications) capasAbiertas.push({ nivel: "notificaciones", onCerrar: () => setShowNotifications(false) });
  if (showSupport) capasAbiertas.push({ nivel: "soporte", onCerrar: () => setShowSupport(false) });
  if (showAntecedentes) capasAbiertas.push({ nivel: "antecedentes", onCerrar: () => setShowAntecedentes(false) });
  if (activeTab === "rentals") {
    if (activeReservation) {
      capasAbiertas.push({ nivel: "arriendo-activo", onCerrar: () => setActiveReservation(null) });
    } else {
      capasAbiertas.push({ nivel: "historial", onCerrar: () => setActiveTab("explore") });
    }
  }
  if (activeTab === "chat") {
    if (chatReservaSeleccionada || activeReservation) {
      capasAbiertas.push({
        nivel: "chat-reserva",
        onCerrar: () => (chatReservaSeleccionada ? setChatReservaSeleccionada(null) : setActiveTab("explore")),
      });
    } else {
      capasAbiertas.push({ nivel: "mensajes", onCerrar: () => setActiveTab("explore") });
    }
  }
  if (activeTab === "profile") capasAbiertas.push({ nivel: "perfil", onCerrar: () => setActiveTab("explore") });
  // Devuelve el gesto de "deslizar desde el borde para volver" (además de
  // registrar el back físico/gesto de Android): esta app no usa
  // react-navigation, así que ese swipe no viene gratis en iOS.
  const gestoVolver = useBackAndroid(capasAbiertas);

  // Misma pila que ya identifica qué capa está abierta para el back: sirve
  // igual de bien como "qué pantalla se ve ahora" para disparar la
  // transición de entrada cada vez que cambia (ver ScreenTransition).
  const pantallaActual = capasAbiertas[0]?.nivel || `tab-${activeTab}`;
  // Abrir una capa entra desde la derecha, cerrarla desde la izquierda y
  // cambiar de pestaña es un fundido.
  const direccionTransicion = useDireccionTransicion(capasAbiertas.length, activeTab);

  const contenido = (
    <View className="flex-1 bg-background">
      {/* Pantalla Activa */}
      <View className="flex-1">
        <ScreenTransition key={pantallaActual} direccion={direccionTransicion}>
          {renderContent()}
        </ScreenTransition>
      </View>

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

  return GestureDetector && gestoVolver ? (
    <GestureDetector gesture={gestoVolver}>{contenido}</GestureDetector>
  ) : (
    contenido
  );
}
