import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, Image, ScrollView, StatusBar, TouchableOpacity } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  colors,
  theme,
  useApp,
  Icon,
  Card,
  Button,
  MenuList,
  MenuRow,
  ApiClient,
  showAlert,
  useBloqueoBiometrico,
  hayHardwareBiometrico,
  ReferralCodeCard,
  LegalModal,
  AccountStatusCard,
  ModeSwitchRow,
} from "@rentacar/mobile-shared";

/**
 * Perfil del arrendatario. Es el centro de la cuenta, no un menú de atajos:
 * responde primero "¿puedo reservar?" (identidad + tarjeta) y después da
 * acceso a los ajustes. Lo que ya vive en una pestaña (arriendos, mensajes)
 * o en el arriendo activo (asistencia en ruta, contrato de una reserva) no
 * se repite aquí.
 */
export function RenterProfileScreen({
  onOpenEnrolment,
  onOpenPaymentMethods,
  onOpenEditProfile,
  onOpenFavorites,
  onOpenNotifications,
  onOpenSupport,
}) {
  const insets = useSafeAreaInsets();
  const { currentUser, reservations, logout, setMode, isLoggedIn } = useApp();
  const [calificaciones, setCalificaciones] = useState([]);
  const [showLegal, setShowLegal] = useState(false);
  const [eliminando, setEliminando] = useState(false);
  const bio = useBloqueoBiometrico(isLoggedIn);
  const [hardwareBiometrico, setHardwareBiometrico] = useState(false);

  useEffect(() => {
    hayHardwareBiometrico().then(setHardwareBiometrico);
  }, []);

  const toggleBloqueoBiometrico = async () => {
    if (bio.activado) {
      await bio.setActivado(false);
      return;
    }
    // Antes de activarlo, se confirma que la huella/Face ID funciona en este
    // teléfono — si no, quedaría activado un candado que nadie puede abrir.
    const ok = await bio.intentarDesbloquear();
    if (ok) await bio.setActivado(true);
    else showAlert("No se pudo verificar", "Inténtalo de nuevo para activar el bloqueo biométrico.");
  };

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

  const promedioRating =
    calificaciones.length > 0
      ? (calificaciones.reduce((sum, c) => sum + c.puntaje, 0) / calificaciones.length).toFixed(1)
      : null;
  const totalArriendos = reservations?.length || 0;
  const actividad = promedioRating
    ? `★ ${promedioRating} · ${totalArriendos} ${totalArriendos === 1 ? "arriendo" : "arriendos"}`
    : totalArriendos > 0
      ? `${totalArriendos} ${totalArriendos === 1 ? "arriendo" : "arriendos"}`
      : "Aún sin arriendos";

  const handleLogout = () => {
    showAlert("Cerrar sesión", "¿Seguro que quieres salir de tu cuenta?", [
      { text: "Cancelar", style: "cancel" },
      { text: "Cerrar sesión", style: "destructive", onPress: logout },
    ]);
  };

  const solicitarEliminacion = async () => {
    setEliminando(true);
    try {
      await ApiClient.crearTicketSoporte(
        "Solicitud de eliminación de cuenta",
        `El usuario ${user.email || user.id || "(sin correo)"} solicita eliminar de forma definitiva su cuenta y sus datos personales.`
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
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom, 16) + 32 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
      >
        <Text style={styles.title}>Mi perfil</Text>

        <Card padded={false}>
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
                {user.nombre || user.email || "Mi cuenta"}
              </Text>
              <Text style={styles.actividad}>{actividad}</Text>
            </View>
            <View style={styles.editHint}>
              <Icon name="pencil" size={13} color={colors.textMuted} />
              <Text style={styles.editHintText}>Editar</Text>
            </View>
          </TouchableOpacity>

          <AccountStatusCard
            estadoDocumentos={user.estado_documentos}
            tarjetaUltimos4={user.tarjeta_ultimos4}
            tarjetaEstado={user.tarjeta_estado}
            rol="renter"
            onPressIdentidad={handleKycPress}
            onPressTarjeta={onOpenPaymentMethods}
          />
        </Card>

        <ReferralCodeCard />

        <MenuList>
          <MenuRow icon="heart" label="Autos guardados" onPress={onOpenFavorites} />
          <MenuRow icon="bell" label="Notificaciones" onPress={onOpenNotifications} />
          {hardwareBiometrico ? (
            <MenuRow
              icon="shield"
              label="Bloqueo con Face ID / huella"
              meta={bio.activado ? "Activado" : "Desactivado"}
              onPress={toggleBloqueoBiometrico}
            />
          ) : null}
          <MenuRow icon="help" label="Centro de ayuda y soporte" onPress={onOpenSupport} />
          <MenuRow icon="document" label="Términos y condiciones" onPress={() => setShowLegal(true)} />
        </MenuList>

        <ModeSwitchRow
          target="owner"
          title="Cambiar a modo dueño"
          desc="Publica tu auto y recibe pagos por arriendo."
          onPress={() => setMode("owner")}
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
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: theme.spacing.screen, gap: theme.spacing.lg },
  title: { ...theme.typography.title, color: colors.text },

  heroHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.md,
    padding: theme.spacing.lg,
  },
  avatar: { width: 56, height: 56, borderRadius: 28 },
  avatarEmpty: { backgroundColor: colors.surfaceSecondary, alignItems: "center", justifyContent: "center" },
  name: { fontSize: 18, fontWeight: "700", color: colors.text },
  actividad: { fontSize: 13, color: colors.textMuted },
  editHint: { flexDirection: "row", alignItems: "center", gap: 4 },
  editHintText: { fontSize: 13, color: colors.textMuted, fontWeight: "600" },

  footerActions: { gap: theme.spacing.md, alignItems: "center" },
  deleteBtn: { paddingVertical: 6, paddingHorizontal: theme.spacing.md },
  deleteText: { fontSize: 13, color: colors.danger, fontWeight: "600" },
});
