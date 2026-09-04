import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, Image, ScrollView, TouchableOpacity, StatusBar } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  colors,
  theme,
  useApp,
  Icon,
  Card,
  Button,
  StatRow,
  MenuList,
  MenuRow,
  ApiClient,
  showAlert,
  useBloqueoBiometrico,
  hayHardwareBiometrico,
  ReferralCodeCard,
} from "@rentacar/mobile-shared";

export function RenterProfileScreen({
  onOpenEnrolment,
  onOpenPaymentMethods,
  onOpenRentalHistory,
  onOpenRoadsideClaim,
  onOpenNotifications,
  onOpenSupport,
  onOpenContract,
  onOpenChat,
}) {
  const insets = useSafeAreaInsets();
  const { currentUser, reservations, paymentMethods, logout, setMode, isLoggedIn } = useApp();
  const [calificaciones, setCalificaciones] = useState([]);
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
  const estadoDocs = user.estado_documentos;
  const verificado = estadoDocs === "verificado";
  const enRevision = estadoDocs === "requiere_revision_manual";

  const handleKycPress = () => {
    if (verificado) {
      showAlert(
        "Identidad verificada",
        "Tus documentos de identidad ya están aprobados. Tu cuenta está 100% habilitada para reservar vehículos."
      );
      return;
    }
    if (enRevision) {
      showAlert(
        "Documentos en revisión",
        "Tus documentos están siendo revisados por nuestro equipo. Te notificaremos cuando tu cuenta quede lista."
      );
      return;
    }
    onOpenEnrolment();
  };

  const promedioRating =
    calificaciones.length > 0
      ? (calificaciones.reduce((sum, c) => sum + c.puntaje, 0) / calificaciones.length).toFixed(1)
      : null;
  const finalizados = (reservations || []).filter((r) => r.estado === "finalizada").length;

  const handleLogout = () => {
    showAlert("Cerrar sesión", "¿Seguro que quieres salir de tu cuenta?", [
      { text: "Cancelar", style: "cancel" },
      { text: "Cerrar sesión", style: "destructive", onPress: logout },
    ]);
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom, 16) + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>Mi perfil</Text>

        <Card style={styles.profileCard} padded>
          {user.foto_perfil_verificada_url ? (
            <Image source={{ uri: user.foto_perfil_verificada_url }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarEmpty]}>
              <Icon name="user" size={26} color={colors.textMuted} />
            </View>
          )}
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={styles.name} numberOfLines={1}>
              {user.nombre || user.email || "Mi cuenta"}
            </Text>
            <View style={styles.ratingRow}>
              <Icon name="star" size={13} color={colors.accent} />
              <Text style={styles.ratingText}>
                {promedioRating
                  ? `${promedioRating} · ${calificaciones.length} calificaciones`
                  : "Sin calificaciones aún"}
              </Text>
            </View>
            <View style={[styles.kycPill, verificado ? styles.kycOk : styles.kycPending]}>
              <Icon
                name={verificado ? "shield" : "warning"}
                size={12}
                color={verificado ? colors.accent800 : colors.warningText}
              />
              <Text style={[styles.kycText, { color: verificado ? colors.accent800 : colors.warningText }]}>
                {verificado ? "Identidad verificada" : enRevision ? "En revisión manual" : "Identidad pendiente"}
              </Text>
            </View>
          </View>
        </Card>

        <StatRow
          items={[
            { value: reservations?.length || 0, label: "Arriendos" },
            { value: finalizados, label: "Finalizados" },
            { value: paymentMethods?.length || 0, label: "Tarjetas" },
          ]}
        />

        <ReferralCodeCard />

        <MenuList>
          <MenuRow icon="calendar" label="Mis arriendos y comprobantes" onPress={onOpenRentalHistory} />
          <MenuRow
            icon="document"
            label="Verificación de identidad"
            meta={verificado ? "Verificado" : enRevision ? "En revisión" : "Pendiente"}
            onPress={handleKycPress}
          />
          <MenuRow
            icon="card"
            label="Tarjeta de crédito"
            meta={
              user.tarjeta_ultimos4
                ? `•••• ${user.tarjeta_ultimos4}`
                : user.tarjeta_estado === "requiere_revision_manual"
                  ? "En revisión"
                  : "Sin registrar"
            }
            onPress={onOpenPaymentMethods}
          />
          {hardwareBiometrico ? (
            <MenuRow
              icon="shield"
              label="Bloqueo con Face ID / huella"
              meta={bio.activado ? "Activado" : "Desactivado"}
              onPress={toggleBloqueoBiometrico}
            />
          ) : null}
          <MenuRow icon="chat" label="Mensajería y coordinación" onPress={onOpenChat} />
          <MenuRow icon="bell" label="Notificaciones" onPress={onOpenNotifications} />
          <MenuRow icon="shield" label="Asistencia en ruta 24/7" onPress={onOpenRoadsideClaim} />
          <MenuRow icon="help" label="Centro de ayuda y soporte" onPress={onOpenSupport} />
          <MenuRow icon="document" label="Términos y contrato digital" onPress={onOpenContract} />
        </MenuList>

        <TouchableOpacity style={styles.switchBtn} onPress={() => setMode("owner")} activeOpacity={0.85}>
          <View style={styles.switchIcon}>
            <Icon name="car" size={18} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.switchTitle}>Cambiar a modo dueño</Text>
            <Text style={styles.switchDesc}>Publica tu auto y recibe pagos por arriendo.</Text>
          </View>
          <Icon name="arrow-right" size={16} color={colors.textMuted} />
        </TouchableOpacity>

        <Button label="Cerrar sesión" variant="danger" onPress={handleLogout} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: theme.spacing.screen, gap: theme.spacing.lg },
  title: { ...theme.typography.title, color: colors.text },
  profileCard: { flexDirection: "row", alignItems: "center", gap: theme.spacing.md },
  avatar: { width: 60, height: 60, borderRadius: 30 },
  avatarEmpty: { backgroundColor: colors.surfaceSecondary, alignItems: "center", justifyContent: "center" },
  name: { fontSize: 18, fontWeight: "700", color: colors.text },
  ratingRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  ratingText: { fontSize: 13, color: colors.textMuted },
  kycPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    alignSelf: "flex-start",
    paddingVertical: 4,
    paddingHorizontal: 9,
    borderRadius: theme.radius.pill,
    marginTop: 2,
  },
  kycOk: { backgroundColor: colors.accent100 },
  kycPending: { backgroundColor: colors.warningBg },
  kycText: { fontSize: 11, fontWeight: "700" },
  switchBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.md,
    padding: theme.spacing.lg,
    borderRadius: theme.radius.card,
    backgroundColor: colors.primary100,
    borderWidth: 1,
    borderColor: colors.primary200,
  },
  switchIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  switchTitle: { fontSize: 15, fontWeight: "700", color: colors.primary },
  switchDesc: { fontSize: 13, color: colors.textMuted, marginTop: 1 },
});
