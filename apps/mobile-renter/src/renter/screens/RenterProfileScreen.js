import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, ScrollView, StatusBar, TouchableOpacity } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  colors,
  theme,
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
  ReferralCodeCard,
  LegalModal,
  ReadinessBand,
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
  onOpenEditProfile,
  onOpenFavorites,
  onOpenNotifications,
  onOpenSupport,
}) {
  const insets = useSafeAreaInsets();
  const { currentUser, reservations, logout } = useApp();
  const [calificaciones, setCalificaciones] = useState([]);
  const [showLegal, setShowLegal] = useState(false);
  const [eliminando, setEliminando] = useState(false);

  useEffect(() => {
    if (!currentUser?.id) return;
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
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom, 16) + 32 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
      >
        <Text style={styles.eyebrow}>Mi perfil</Text>

        <Card padded={false}>
          <TouchableOpacity
            style={styles.heroHead}
            onPress={onOpenEditProfile}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Editar perfil"
          >
            <AvatarFoto size={64} iconSize={26} />
            <View style={styles.heroId}>
              <Text style={styles.name} numberOfLines={1}>
                {user.nombre || user.email || "Mi cuenta"}
              </Text>
              {ratingNum ? (
                <Rating value={ratingNum} count={totalArriendos} size="sm" style={{ marginTop: 3 }} />
              ) : (
                <Text style={styles.actividad}>
                  {totalArriendos > 0
                    ? `${totalArriendos} ${totalArriendos === 1 ? "arriendo" : "arriendos"}`
                    : "Aún sin arriendos"}
                </Text>
              )}
            </View>
            <View style={styles.editBtn}>
              <Icon name="pencil" size={16} color={colors.accent700} />
            </View>
          </TouchableOpacity>

          <ReadinessBand
            estadoDocumentos={user.estado_documentos}
            tarjetaEstado={user.tarjeta_estado}
            rol="renter"
            onResolver={resolverEstado}
          />
        </Card>

        <View>
          <Text style={styles.section}>Cuenta</Text>
          <MenuList>
            <MenuRow tile tileTone="menta" icon="shield" label="Identidad" meta={identidadMeta} onPress={handleKycPress} />
            <MenuRow tile tileTone="menta" icon="card" label="Medios de pago" meta={tarjetaMeta} onPress={onOpenPaymentMethods} />
            <MenuRow tile icon="heart" label="Autos guardados" onPress={onOpenFavorites} />
            <MenuRow tile icon="bell" label="Notificaciones" onPress={onOpenNotifications} />
            <MenuRow tile icon="help" label="Centro de ayuda" onPress={onOpenSupport} />
            <MenuRow tile icon="document" label="Términos y condiciones" onPress={() => setShowLegal(true)} />
            <MenuRow tile tileTone="danger" icon="logout" label="Cerrar sesión" danger onPress={handleLogout} />
          </MenuList>
        </View>

        <ReferralCodeCard />

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
      </ScrollView>

      <LegalModal visible={showLegal} doc="terminos" onClose={() => setShowLegal(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: theme.spacing.screen, gap: theme.spacing.lg },
  eyebrow: { fontSize: 13, fontWeight: "700", color: colors.textMuted, letterSpacing: 0.3, marginBottom: -4 },

  heroHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.md,
    padding: theme.spacing.lg,
  },
  heroId: { flex: 1, minWidth: 0 },
  name: { fontSize: 20, fontWeight: "700", color: colors.text, letterSpacing: -0.2 },
  actividad: { fontSize: 13, color: colors.textMuted, marginTop: 3 },
  editBtn: {
    width: 36,
    height: 36,
    borderRadius: theme.radius.field,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
  },

  section: { fontSize: 13, fontWeight: "700", color: colors.textMuted, marginBottom: theme.spacing.sm, marginLeft: 4 },

  deleteBtn: { alignSelf: "center", paddingVertical: 6, paddingHorizontal: theme.spacing.md },
  deleteText: { fontSize: 13, color: colors.danger, fontWeight: "600" },
});
