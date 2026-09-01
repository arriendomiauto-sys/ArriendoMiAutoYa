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
} from "@rentacar/mobile-shared";

export function OwnerProfileScreen({
  cars,
  onOpenMyCars,
  onOpenEarnings,
  onOpenMaintenance,
  onOpenDisputes,
  onOpenNotifications,
  onOpenSupport,
  onOpenContract,
  onOpenChat,
  onOpenEnrolment,
}) {
  const insets = useSafeAreaInsets();
  const { currentUser, bankAccount, logout, setMode } = useApp();
  const [calificaciones, setCalificaciones] = useState([]);

  useEffect(() => {
    if (!currentUser?.id) return;
    ApiClient.getCalificaciones(currentUser.id).then(setCalificaciones);
  }, [currentUser?.id]);

  const user = currentUser || {};
  const estadoDocs = user.estado_documentos;
  const verificado = estadoDocs === "verificado";
  const enRevision = estadoDocs === "requiere_revision_manual";

  const handleKycPress = () => {
    if (verificado) {
      showAlert(
        "Identidad verificada",
        "Tus documentos de identidad ya están aprobados. Tu cuenta de dueño está 100% habilitada para publicar vehículos."
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
      : "—";

  const handleLogout = () => {
    showAlert("Cerrar sesión", "¿Seguro que quieres salir de tu cuenta de dueño?", [
      { text: "Cancelar", style: "cancel" },
      { text: "Cerrar sesión", style: "destructive", onPress: logout },
    ]);
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom, 16) + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>Perfil de dueño</Text>

        <Card tone="dark" style={styles.profileCard} padded>
          {user.foto_perfil_verificada_url ? (
            <Image source={{ uri: user.foto_perfil_verificada_url }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarEmpty]}>
              <Icon name="user" size={26} color={colors.textSilver} />
            </View>
          )}
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={styles.name} numberOfLines={1}>
              {user.nombre || user.email || "Mi cuenta"}
            </Text>
            <Text style={styles.sub}>
              {promedioRating !== "—" ? `★ ${promedioRating} · ` : ""}
              {cars?.length || 0} {cars?.length === 1 ? "auto publicado" : "autos publicados"}
            </Text>
            <View style={[styles.kycPill, verificado ? styles.kycOk : styles.kycPending]}>
              <Icon name={verificado ? "shield" : "warning"} size={12} color={verificado ? colors.accent : "#F2C879"} />
              <Text style={[styles.kycText, { color: verificado ? colors.accent : "#F2C879" }]}>
                {verificado ? "Anfitrión verificado" : enRevision ? "En revisión manual" : "Verificación pendiente"}
              </Text>
            </View>
          </View>
        </Card>

        <StatRow
          tone="dark"
          items={[
            { value: cars?.length || 0, label: "Autos activos" },
            { value: calificaciones.length, label: "Calificaciones" },
            { value: promedioRating, label: "Rating" },
          ]}
        />

        <MenuList tone="dark">
          <MenuRow tone="dark" icon="car" label="Mis vehículos y tarifas" meta={`${cars?.length || 0} autos`} onPress={onOpenMyCars} />
          <MenuRow
            tone="dark"
            icon="document"
            label="Verificación de identidad"
            meta={verificado ? "Verificado" : enRevision ? "En revisión" : "Pendiente"}
            onPress={handleKycPress}
          />
          <MenuRow tone="dark" icon="card" label="Datos de transferencia" meta={bankAccount?.banco || "Sin configurar"} onPress={onOpenEarnings} />
          <MenuRow tone="dark" icon="document" label="Registro de mantenciones" onPress={onOpenMaintenance} />
          <MenuRow tone="dark" icon="shield" label="Garantías y reclamos" onPress={onOpenDisputes} />
          <MenuRow tone="dark" icon="chat" label="Mensajes con arrendatarios" onPress={onOpenChat} />
          <MenuRow tone="dark" icon="bell" label="Notificaciones" onPress={onOpenNotifications} />
          <MenuRow tone="dark" icon="document" label="Contratos de mis reservas" onPress={onOpenContract} />
          <MenuRow tone="dark" icon="help" label="Soporte para anfitriones 24/7" onPress={onOpenSupport} />
        </MenuList>

        <TouchableOpacity style={styles.switchBtn} onPress={() => setMode("renter")} activeOpacity={0.85}>
          <View style={styles.switchIcon}>
            <Icon name="key" size={18} color={colors.accent} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.switchTitle}>Cambiar a modo arrendatario</Text>
            <Text style={styles.switchDesc}>Busca y reserva autos para arrendar.</Text>
          </View>
          <Icon name="arrow-right" size={16} color={colors.textSilver} />
        </TouchableOpacity>

        <Button tone="dark" label="Cerrar sesión" variant="danger" onPress={handleLogout} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.darkBg },
  content: { padding: theme.spacing.screen, gap: theme.spacing.lg },
  title: { ...theme.typography.title, color: colors.textWhite },
  profileCard: { flexDirection: "row", alignItems: "center", gap: theme.spacing.md },
  avatar: { width: 60, height: 60, borderRadius: 30 },
  avatarEmpty: { backgroundColor: colors.darkCardHover, alignItems: "center", justifyContent: "center" },
  name: { fontSize: 18, fontWeight: "700", color: colors.textWhite },
  sub: { fontSize: 13, color: colors.textSilver },
  kycPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    alignSelf: "flex-start",
    paddingVertical: 4,
    paddingHorizontal: 9,
    borderRadius: theme.radius.pill,
    marginTop: 2,
    borderWidth: 1,
  },
  kycOk: { backgroundColor: "rgba(47,191,155,0.14)", borderColor: "rgba(47,191,155,0.35)" },
  kycPending: { backgroundColor: "rgba(242,200,121,0.12)", borderColor: "rgba(242,200,121,0.3)" },
  kycText: { fontSize: 11, fontWeight: "700" },
  switchBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.md,
    padding: theme.spacing.lg,
    borderRadius: theme.radius.card,
    backgroundColor: colors.darkCard,
    borderWidth: 1,
    borderColor: colors.darkBorder,
  },
  switchIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.darkCardSubtle,
    alignItems: "center",
    justifyContent: "center",
  },
  switchTitle: { fontSize: 15, fontWeight: "700", color: colors.textWhite },
  switchDesc: { fontSize: 13, color: colors.textSilver, marginTop: 1 },
});
