import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  ScrollView,
  TouchableOpacity,
  StatusBar,
} from "react-native";
import { colors, useApp, Icon, ApiClient, showAlert } from "@rentacar/mobile-shared";

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
  const { currentUser, bankAccount, logout, setMode } = useApp();
  const [calificaciones, setCalificaciones] = useState([]);

  useEffect(() => {
    if (!currentUser?.id) return;
    ApiClient.getCalificaciones(currentUser.id).then(setCalificaciones);
  }, [currentUser?.id]);

  const user = currentUser || {};
  const promedioRating =
    calificaciones.length > 0
      ? (calificaciones.reduce((sum, c) => sum + c.puntaje, 0) / calificaciones.length).toFixed(1)
      : null;

  const handleLogout = () => {
    showAlert("Cerrar Sesión", "¿Seguro que deseas salir de tu cuenta de dueño?", [
      { text: "Cancelar", style: "cancel" },
      { text: "Cerrar Sesión", style: "destructive", onPress: logout },
    ]);
  };

  const MENU = [
    { icon: "car", label: "Mis vehículos y tarifas", meta: `${cars?.length || 0} autos`, onPress: onOpenMyCars },
    {
      icon: "document",
      label: "Verificación de Identidad (KYC)",
      meta: user.estado_documentos === "verificado" ? "Verificado" : "Pendiente",
      onPress: onOpenEnrolment,
    },
    { icon: "shield", label: "Soporte para Anfitriones 24/7", onPress: onOpenSupport },
    {
      icon: "card",
      label: "Datos de transferencia bancaria",
      meta: bankAccount?.banco || "Sin configurar",
      onPress: onOpenEarnings,
    },
    { icon: "document", label: "Registro de mantenciones", onPress: onOpenMaintenance },
    { icon: "shield", label: "Centro de garantías y reclamos", onPress: onOpenDisputes },
    { icon: "chat", label: "Mensajes con arrendatarios", onPress: onOpenChat },
    { icon: "document", label: "Contratos de mis reservas", onPress: onOpenContract },
  ];

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <Text style={styles.screenTitle}>Perfil de Dueño</Text>
          {user.estado_documentos === "verificado" && (
            <View style={styles.badgeAnfitrion}>
              <Text style={styles.badgeAnfitrionText} numberOfLines={1}>
                Anfitrión Verificado
              </Text>
            </View>
          )}
        </View>

        {/* User Card */}
        <View style={styles.profileCard}>
          {user.foto_perfil_verificada_url ? (
            <Image source={{ uri: user.foto_perfil_verificada_url }} style={styles.avatarImg} />
          ) : (
            <View style={[styles.avatarImg, styles.avatarPlaceholder]}>
              <Icon name="user" size={26} color={colors.textSilver} />
            </View>
          )}
          <View style={{ flex: 1, gap: 3 }}>
            <Text style={styles.userName} numberOfLines={1}>
              {user.nombre || user.email || "Mi cuenta"}
            </Text>
            <View style={styles.ratingRow}>
              <Icon name="star" size={14} color={colors.accent} style={{ marginRight: 5 }} />
              <Text style={styles.ratingText}>
                {promedioRating
                  ? `${promedioRating} · ${calificaciones.length} calificaciones`
                  : "Sin calificaciones aún"} · {cars?.length || 0} autos publicados
              </Text>
            </View>
          </View>
        </View>

        {/* Resumen de Flota y Cuenta */}
        <View style={styles.statsCard}>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{cars?.length || 0}</Text>
            <Text style={styles.statLabel}>Autos activos</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{calificaciones.length}</Text>
            <Text style={styles.statLabel}>Calificaciones</Text>
          </View>
        </View>

        {/* Menú de Gestión del Dueño */}
        <View style={styles.menuCard}>
          {MENU.map((item, i) => (
            <TouchableOpacity
              key={item.label}
              style={[styles.menuItem, i === MENU.length - 1 && styles.menuItemLast]}
              onPress={item.onPress}
              activeOpacity={0.7}
            >
              <View style={styles.menuItemLeft}>
                <Icon name={item.icon} size={20} color={colors.accent} />
                <Text style={styles.menuItemText}>{item.label}</Text>
              </View>
              {item.meta ? (
                <Text style={styles.menuItemMeta}>{item.meta}</Text>
              ) : (
                <Icon name="arrow-right" size={16} color={colors.textSilver} />
              )}
            </TouchableOpacity>
          ))}
        </View>

        {/* Cambiar a Modo Arrendatario (misma cuenta, otra experiencia) */}
        <TouchableOpacity
          style={styles.switchModeBtn}
          onPress={() => setMode("renter")}
          activeOpacity={0.85}
        >
          <Icon name="key" size={20} color={colors.accent} />
          <View style={{ flex: 1 }}>
            <Text style={styles.switchModeTitle}>Cambiar a Modo Arrendatario</Text>
            <Text style={styles.switchModeDesc}>
              Busca y reserva autos para arrendar.
            </Text>
          </View>
          <Icon name="arrow-right" size={16} color={colors.textSilver} />
        </TouchableOpacity>

        {/* Cerrar Sesión */}
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.8}>
          <Text style={styles.logoutBtnText}>Cerrar Sesión</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.darkBg,
  },
  content: {
    padding: 20,
    gap: 16,
    paddingBottom: 40,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  screenTitle: {
    flexShrink: 1,
    fontSize: 24,
    fontWeight: "800",
    letterSpacing: -0.4,
    color: colors.textWhite,
  },
  badgeAnfitrion: {
    flexShrink: 0,
    backgroundColor: "rgba(47, 191, 155, 0.16)",
    borderWidth: 1,
    borderColor: "rgba(47, 191, 155, 0.35)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  badgeAnfitrionText: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.accent,
  },
  profileCard: {
    backgroundColor: colors.darkCard,
    borderWidth: 1,
    borderColor: colors.darkBorder,
    borderRadius: 16,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  avatarImg: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  avatarPlaceholder: {
    backgroundColor: colors.darkCardHover,
    alignItems: "center",
    justifyContent: "center",
  },
  userName: {
    fontSize: 17,
    fontWeight: "700",
    color: colors.textWhite,
  },
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  ratingText: {
    flex: 1,
    fontSize: 12,
    color: colors.textSilver,
  },
  statsCard: {
    backgroundColor: colors.darkCard,
    borderWidth: 1,
    borderColor: colors.darkBorder,
    borderRadius: 16,
    padding: 16,
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
  },
  statItem: {
    alignItems: "center",
    gap: 4,
  },
  statNumber: {
    fontSize: 22,
    fontWeight: "900",
    color: colors.accent,
  },
  statLabel: {
    fontSize: 12,
    color: colors.textSilver,
  },
  statDivider: {
    width: 1,
    height: 32,
    backgroundColor: colors.darkBorder,
  },
  menuCard: {
    backgroundColor: colors.darkCard,
    borderWidth: 1,
    borderColor: colors.darkBorder,
    borderRadius: 16,
    overflow: "hidden",
  },
  menuItem: {
    paddingVertical: 15,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.darkBorder,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
  },
  menuItemLast: {
    borderBottomWidth: 0,
  },
  menuItemLeft: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  menuItemText: {
    flexShrink: 1,
    fontSize: 14,
    color: colors.textWhite,
    fontWeight: "500",
  },
  menuItemMeta: {
    flexShrink: 0,
    fontSize: 13,
    color: colors.textSilver,
  },
  switchModeBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 16,
    borderRadius: 12,
    backgroundColor: colors.darkCard,
    borderWidth: 1,
    borderColor: colors.darkBorder,
  },
  switchModeTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.textWhite,
  },
  switchModeDesc: {
    fontSize: 13,
    color: colors.textSilver,
    marginTop: 2,
  },
  logoutBtn: {
    height: 52,
    borderRadius: 12,
    backgroundColor: "rgba(220, 38, 38, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(220, 38, 38, 0.32)",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  logoutBtnText: {
    color: "#F98080",
    fontSize: 15,
    fontWeight: "700",
  },
});
