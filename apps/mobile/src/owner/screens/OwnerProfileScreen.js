import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, Image, ScrollView, TouchableOpacity } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  colors,
  theme,
  useApp,
  Icon,
  Button,
  MenuList,
  MenuRow,
  ApiClient,
  showAlert,
  ReferralCodeCard,
  LegalModal,
  AccountStatusCard,
  ModeSwitchRow,
} from "@rentacar/mobile-shared";
import { CabeceraOwner, FranjaResumen, oc } from "../comun";

/**
 * Perfil del dueño. Mismo enfoque que el del arrendatario: primero "¿puedo
 * publicar?" (identidad + tarjeta), después los ajustes. Lo que ya tiene su
 * propia pestaña — la flota, las ganancias y los datos de transferencia, las
 * solicitudes — o vive en el header (Mensajes) no se repite aquí.
 */
export function OwnerProfileScreen({
  cars,
  noLeidos,
  onOpenChat,
  onOpenEditProfile,
  onOpenDisputes,
  onOpenNotifications,
  onOpenSupport,
  onOpenEnrolment,
  onOpenTarjeta,
}) {
  const insets = useSafeAreaInsets();
  const { currentUser, logout, setMode } = useApp();
  const [calificaciones, setCalificaciones] = useState([]);
  const [showLegal, setShowLegal] = useState(false);
  const [eliminando, setEliminando] = useState(false);

  useEffect(() => {
    if (!currentUser?.id) return;
    // Sin catch, un backend caído al abrir la app dejaba un rechazo sin
    // manejar. Las calificaciones son secundarias: si no llegan, la
    // pantalla se muestra igual.
    ApiClient.getCalificaciones(currentUser.id)
      .then(setCalificaciones)
      .catch(() => {});
  }, [currentUser?.id]);

  const user = currentUser || {};
  const nombre = user.nombre || user.email || "Mi cuenta";
  const sub = user.nombre && user.email ? user.email : "Cuenta de dueño";

  const handleKycPress = () => {
    if (user.estado_documentos === "verificado") {
      showAlert(
        "Identidad verificada",
        "Tus documentos de identidad ya están aprobados. Tu cuenta de dueño está 100% habilitada para publicar vehículos."
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

  const promedioRating =
    calificaciones.length > 0
      ? (calificaciones.reduce((sum, c) => sum + c.puntaje, 0) / calificaciones.length).toFixed(1)
      : null;
  const totalAutos = cars?.length || 0;

  const handleLogout = () => {
    showAlert("Cerrar sesión", "¿Seguro que quieres salir de tu cuenta de dueño?", [
      { text: "Cancelar", style: "cancel" },
      { text: "Cerrar sesión", style: "destructive", onPress: logout },
    ]);
  };

  const solicitarEliminacion = async () => {
    setEliminando(true);
    try {
      await ApiClient.crearTicketSoporte(
        "Solicitud de eliminación de cuenta",
        `El usuario ${user.email || user.id || "(sin correo)"} solicita eliminar de forma definitiva su cuenta de dueño y sus datos personales.`
      );
      showAlert(
        "Solicitud enviada",
        "Recibimos tu solicitud. Te escribiremos por correo para confirmar la eliminación una vez que no queden arriendos ni pagos en curso."
      );
    } catch (err) {
      showAlert("No se pudo enviar", err.message || "Inténtalo de nuevo en unos segundos.");
    } finally {
      setEliminando(false);
    }
  };

  const handleEliminarCuenta = () => {
    showAlert(
      "Eliminar mi cuenta",
      "Enviaremos tu solicitud al equipo. Antes de borrar la cuenta verificamos que no tengas arriendos en curso ni pagos pendientes; te confirmamos por correo dentro de 48 horas. Esta acción no se puede deshacer.",
      [
        { text: "Cancelar", style: "cancel" },
        { text: "Solicitar eliminación", style: "destructive", onPress: solicitarEliminacion },
      ]
    );
  };

  return (
    <View style={[oc.screen, { paddingTop: Math.max(insets.top, 12) }]}>
      <CabeceraOwner titulo="Mi perfil" noLeidos={noLeidos} onMensajes={onOpenChat} />

      <ScrollView
        contentContainerStyle={[oc.content, { paddingBottom: Math.max(insets.bottom, 16) + 32 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
      >
        <View style={oc.card}>
          <TouchableOpacity
            style={styles.heroHead}
            onPress={onOpenEditProfile}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Editar perfil"
          >
            {user.foto_perfil_verificada_url ? (
              <Image source={{ uri: user.foto_perfil_verificada_url }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarEmpty]}>
                <Icon name="user" size={24} color={colors.textMuted} />
              </View>
            )}
            <View style={{ flex: 1, gap: 3 }}>
              <Text style={styles.name} numberOfLines={1}>
                {nombre}
              </Text>
              <Text style={styles.sub} numberOfLines={1}>
                {sub}
              </Text>
            </View>
            <View style={styles.editHint}>
              <Icon name="pencil" size={13} color={colors.textMuted} />
              <Text style={styles.editHintText}>Editar</Text>
            </View>
          </TouchableOpacity>

          <AccountStatusCard
            tone="light"
            rol="owner"
            estadoDocumentos={user.estado_documentos}
            tarjetaUltimos4={user.tarjeta_ultimos4}
            tarjetaEstado={user.tarjeta_estado}
            onPressIdentidad={handleKycPress}
            onPressTarjeta={onOpenTarjeta}
          />
        </View>

        <FranjaResumen
          items={[
            { value: totalAutos, label: totalAutos === 1 ? "Auto publicado" : "Autos publicados" },
            { value: calificaciones.length, label: "Calificaciones" },
            { value: promedioRating ? `★ ${promedioRating}` : "—", label: "Rating" },
          ]}
        />

        <ReferralCodeCard />

        <MenuList>
          <MenuRow icon="shield" label="Garantías y reclamos" onPress={onOpenDisputes} />
          <MenuRow icon="bell" label="Notificaciones" onPress={onOpenNotifications} />
          <MenuRow icon="help" label="Soporte para anfitriones 24/7" onPress={onOpenSupport} />
          <MenuRow icon="document" label="Términos y condiciones" onPress={() => setShowLegal(true)} />
        </MenuList>

        <ModeSwitchRow
          tone="light"
          target="renter"
          title="Cambiar a modo arrendatario"
          desc="Busca y reserva autos para arrendar."
          onPress={() => setMode("renter")}
        />

        <View style={styles.footerActions}>
          <Button label="Cerrar sesión" variant="danger" onPress={handleLogout} />
          <TouchableOpacity
            onPress={handleEliminarCuenta}
            disabled={eliminando}
            hitSlop={theme.control.hitSlop}
            accessibilityRole="button"
            accessibilityLabel="Eliminar mi cuenta"
            style={styles.deleteBtn}
          >
            <Text style={styles.deleteText}>{eliminando ? "Enviando solicitud…" : "Eliminar mi cuenta"}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <LegalModal visible={showLegal} doc="terminos" onClose={() => setShowLegal(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  heroHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.md,
    padding: theme.spacing.lg,
  },
  avatar: { width: 56, height: 56, borderRadius: 28 },
  avatarEmpty: { backgroundColor: colors.surfaceSecondary, alignItems: "center", justifyContent: "center" },
  name: { fontSize: 18, fontWeight: "700", color: colors.text },
  sub: { fontSize: 13, color: colors.textMuted },
  editHint: { flexDirection: "row", alignItems: "center", gap: 4 },
  editHintText: { fontSize: 13, color: colors.textMuted, fontWeight: "600" },

  footerActions: { gap: theme.spacing.md, alignItems: "center" },
  deleteBtn: { paddingVertical: 6, paddingHorizontal: theme.spacing.md },
  deleteText: { fontSize: 13, color: colors.danger, fontWeight: "600" },
});
