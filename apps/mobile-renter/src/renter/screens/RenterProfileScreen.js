import React, { useState, useEffect } from "react";
import { View, Text, ScrollView, StatusBar, TouchableOpacity } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  useApp,
  Icon,
  AvatarFoto,
  Card,
  Rating,
  MenuList,
  MenuRow,
  ApiClient,
  showAlert,
  msjError,
  LegalModal,
  ReadinessBand,
  AdminPromoterInviteModal,
  AntecedentesBanner,
} from "@rentacar/mobile-shared";

/**
 * Perfil del arrendatario. Es el centro de la cuenta, no un menú de atajos:
 * responde primero "¿puedo reservar?" (banda de estado) y después da acceso a
 * los ajustes en una sola lista. Lo que ya vive en una pestaña (arriendos,
 * mensajes) o en el arriendo activo no se repite aquí.
 */
export function RenterProfileScreen({
  onOpenEnrolment,
  onOpenPaymentMethods,
  onOpenAntecedentes,
  estadoAntecedentes,
  antecedentesObligatorios,
  onOpenEditProfile,
  onOpenFavorites,
  onOpenNotifications,
  onOpenSupport,
  onOpenPromoterPanel,
}) {
  const insets = useSafeAreaInsets();
  const { currentUser, reservations, logout } = useApp();
  const [calificaciones, setCalificaciones] = useState([]);
  const [showLegal, setShowLegal] = useState(false);
  const [showAdminPromoterModal, setShowAdminPromoterModal] = useState(false);
  const [eliminando, setEliminando] = useState(false);

  useEffect(() => {
    if (!currentUser?.id) return;
    ApiClient.getCalificaciones(currentUser.id)
      .then(setCalificaciones)
      .catch(() => {});
  }, [currentUser?.id]);

  const user = currentUser || {};
  const esPromotor = Boolean(
    user.es_promotor ||
    user.roles_activos?.includes("promotor") ||
    user.roles_activos?.includes("admin")
  );
  const esAdmin = Boolean(user.roles_activos?.includes("admin"));

  const handleKycPress = () => {
    if (user.estado_documentos === "verificado") {
      showAlert(
        "Identidad verificada",
        "Tus documentos de identidad ya están aprobados. Tu cuenta está 100% habilitada para reservar vehículos."
      );
      return;
    }
    if (user.estado_documentos === "requiere_revision_manual") {
      showAlert(
        "Documentos en revisión",
        "Tus documentos están siendo revisados por nuestro equipo. Te notificaremos cuando tu cuenta quede lista."
      );
      return;
    }
    onOpenEnrolment?.();
  };

  const resolverEstado = (tipo) => (tipo === "identidad" ? handleKycPress() : onOpenPaymentMethods?.());

  const ratingNum = calificaciones.length
    ? calificaciones.reduce((sum, c) => sum + (c.puntaje || 0), 0) / calificaciones.length
    : null;
  const totalArriendos = reservations?.length || 0;

  const identidadMeta =
    user.estado_documentos === "verificado"
      ? "Verificada"
      : user.estado_documentos === "requiere_revision_manual"
        ? "En revisión"
        : "Pendiente";
  const antecedentesActual = estadoAntecedentes ?? user.antecedentes_estado;
  const antecedentesMeta =
    { limpio: "Aprobados", revision: "En revisión", bloqueado: "Contacta a soporte" }[antecedentesActual] || "Pendiente";
  const tarjetaMeta = user.tarjeta_ultimos4
    ? `•• ${user.tarjeta_ultimos4}`
    : user.tarjeta_estado === "validada"
      ? "Listo"
      : "Agregar";

  const handleLogout = () => {
    showAlert("Cerrar sesión", "¿Seguro que quieres salir de tu cuenta?", [
      { text: "Cancelar", style: "cancel" },
      { text: "Cerrar sesión", style: "destructive", onPress: logout },
    ]);
  };

  const solicitarEliminacion = async () => {
    setEliminando(true);
    try {
      const res = await ApiClient.solicitarEliminacionCuenta();
      showAlert("Solicitud enviada", res?.mensaje || "Recibimos tu solicitud.");
    } catch (err) {
      if (err?.status === 409) {
        showAlert("Todavía no puedes eliminar tu cuenta", msjError(err, "Intenta de nuevo en unos segundos."));
      } else {
        showAlert("No se pudo enviar", msjError(err, "Inténtalo de nuevo en unos segundos."));
      }
    } finally {
      setEliminando(false);
    }
  };

  const handleEliminarCuenta = () => {
    showAlert(
      "Eliminar mi cuenta",
      "Si tienes arriendos o pagos en curso, no podremos procesar la baja todavía — te lo diremos de inmediato. Si no, tu solicitud queda registrada y te confirmamos por correo dentro de 48 horas. Esta acción no se puede deshacer.",
      [
        { text: "Cancelar", style: "cancel" },
        { text: "Solicitar eliminación", style: "destructive", onPress: solicitarEliminacion },
      ]
    );
  };

  return (
    <View className="flex-1 bg-background">
      <StatusBar barStyle="dark-content" />
      <ScrollView
        contentContainerClassName="p-4 gap-4"
        contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 16) + 32 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
      >
        <Text className="text-[13px] font-bold text-textMuted tracking-[0.3px] -mb-1">Mi perfil</Text>

        <Card padded={false}>
          <TouchableOpacity
            className="flex-row items-center gap-3 p-4"
            onPress={onOpenEditProfile}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Editar perfil"
          >
            <AvatarFoto size={64} iconSize={26} />
            <View className="flex-1 min-w-0">
              <Text className="text-xl font-bold text-textDark tracking-[-0.2px]" numberOfLines={1}>
                {user.nombre || user.email || "Mi cuenta"}
              </Text>
              {ratingNum ? (
                <Rating value={ratingNum} count={totalArriendos} size="sm" className="mt-1" />
              ) : (
                <Text className="text-[13px] text-textMuted mt-0.5">
                  {totalArriendos > 0
                    ? `${totalArriendos} ${totalArriendos === 1 ? "arriendo" : "arriendos"}`
                    : "Aún sin arriendos"}
                </Text>
              )}
            </View>
            <View className="w-9 h-9 rounded-xl border border-border items-center justify-center bg-white">
              <Icon name="pencil" size={16} color="#B45309" />
            </View>
          </TouchableOpacity>

          <ReadinessBand
            estadoDocumentos={user.estado_documentos}
            tarjetaEstado={user.tarjeta_estado}
            rol="renter"
            onResolver={resolverEstado}
          />
        </Card>

        {/* Destacado arriba de la lista mientras falten: sin ellos no se reserva. */}
        <AntecedentesBanner estado={antecedentesActual} obligatorio={antecedentesObligatorios} onPress={onOpenAntecedentes} />

        <View>
          <Text className="text-[13px] font-bold text-textMuted mb-2 ml-1">Cuenta</Text>
          <MenuList>
            <MenuRow tile tileTone="menta" icon="shield" label="Identidad" meta={identidadMeta} onPress={handleKycPress} />
            <MenuRow tile tileTone="menta" icon="card" label="Medios de pago" meta={tarjetaMeta} onPress={onOpenPaymentMethods} />
            <MenuRow tile tileTone="menta" icon="document" label="Antecedentes y hoja de vida" meta={antecedentesMeta} onPress={onOpenAntecedentes} />
            <MenuRow tile icon="heart" label="Autos guardados" onPress={onOpenFavorites} />
            {esPromotor ? (
              <MenuRow tile tileTone="menta" icon="star" label="Invita y gana" onPress={onOpenPromoterPanel} />
            ) : null}
            {esAdmin ? (
              <MenuRow tile tileTone="menta" icon="users" label="Invitar Promotor (Admin)" onPress={() => setShowAdminPromoterModal(true)} />
            ) : null}
            <MenuRow tile icon="bell" label="Notificaciones" onPress={onOpenNotifications} />
            <MenuRow tile icon="help" label="Centro de ayuda" onPress={onOpenSupport} />
            <MenuRow tile icon="document" label="Términos y condiciones" onPress={() => setShowLegal(true)} />
            <MenuRow tile tileTone="danger" icon="logout" label="Cerrar sesión" danger onPress={handleLogout} />
          </MenuList>
        </View>

        <TouchableOpacity
          onPress={handleEliminarCuenta}
          disabled={eliminando}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel="Eliminar mi cuenta"
          className="self-center py-1.5 px-3"
        >
          <Text className="text-[13px] text-danger font-semibold">{eliminando ? "Enviando solicitud…" : "Eliminar mi cuenta"}</Text>
        </TouchableOpacity>
      </ScrollView>

      <LegalModal visible={showLegal} doc="terminos" onClose={() => setShowLegal(false)} />
      <AdminPromoterInviteModal
        visible={showAdminPromoterModal}
        onClose={() => setShowAdminPromoterModal(false)}
      />
    </View>
  );
}

