import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
} from "react-native";
import { colors, useApp, Icon, ApiClient, showAlert } from "@rentacar/mobile-shared";

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
  const { currentUser, reservations, paymentMethods, logout } = useApp();
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
  const viajesFinalizados = (reservations || []).filter((r) => r.estado === "finalizada").length;

  const handleLogout = () => {
    showAlert("Cerrar Sesión", "¿Seguro que deseas salir de tu cuenta?", [
      { text: "Cancelar", style: "cancel" },
      { text: "Cerrar Sesión", style: "destructive", onPress: logout },
    ]);
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <Text style={styles.screenTitle}>Mi Perfil</Text>
          {user.estado_documentos === "verificado" && (
            <View style={styles.badgeKyc}>
              <Text style={styles.badgeKycText}>Identidad Verificada</Text>
            </View>
          )}
        </View>

        {/* User Card */}
        <View style={styles.profileCard}>
          {user.foto_perfil_verificada_url ? (
            <Image source={{ uri: user.foto_perfil_verificada_url }} style={styles.avatarImg} />
          ) : (
            <View style={[styles.avatarImg, styles.avatarPlaceholder]}>
              <Icon name="user" size={26} color={colors.textMuted} />
            </View>
          )}
          <View style={{ flex: 1, gap: 3 }}>
            <Text style={styles.userName}>{user.nombre || user.email || "Mi cuenta"}</Text>
            <View style={styles.ratingRow}>
              <Icon name="star" size={14} color={colors.accent} style={{ marginRight: 5 }} />
              <Text style={styles.ratingText}>
                {promedioRating
                  ? `${promedioRating} · ${calificaciones.length} calificaciones`
                  : "Sin calificaciones aún"}
              </Text>
            </View>
          </View>
        </View>

        {/* Resumen del Arrendatario */}
        <View style={styles.statsCard}>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{reservations?.length || 0}</Text>
            <Text style={styles.statLabel}>Arriendos</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{viajesFinalizados}</Text>
            <Text style={styles.statLabel}>Finalizados</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{paymentMethods?.length || 0}</Text>
            <Text style={styles.statLabel}>Tarjetas</Text>
          </View>
        </View>

        {/* Menú de Opciones del Usuario */}
        <View style={styles.menuCard}>
          <TouchableOpacity style={styles.menuItem} onPress={onOpenRentalHistory}>
            <View style={styles.menuItemLeft}>
              <Icon name="calendar" size={20} color={colors.primary} />
              <Text style={styles.menuItemText}>Mis arriendos y comprobantes</Text>
            </View>
            <Icon name="arrow-right" size={16} color={colors.textMuted} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem} onPress={onOpenEnrolment}>
            <View style={styles.menuItemLeft}>
              <Icon name="document" size={20} color={colors.primary} />
              <Text style={styles.menuItemText}>Verificación de Identidad (KYC)</Text>
            </View>
            <Text style={styles.menuItemMeta}>
              {user.estado_documentos === "verificado" ? "Verificado" : "Pendiente"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem} onPress={onOpenSupport}>
            <View style={styles.menuItemLeft}>
              <Icon name="shield" size={20} color={colors.primary} />
              <Text style={styles.menuItemText}>Centro de ayuda y soporte</Text>
            </View>
            <Icon name="arrow-right" size={16} color={colors.textMuted} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem} onPress={onOpenPaymentMethods}>
            <View style={styles.menuItemLeft}>
              <Icon name="card" size={20} color={colors.primary} />
              <Text style={styles.menuItemText}>Billetera y tarjetas Webpay</Text>
            </View>
            <Icon name="arrow-right" size={16} color={colors.textMuted} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem} onPress={onOpenRoadsideClaim}>
            <View style={styles.menuItemLeft}>
              <Icon name="shield" size={20} color={colors.primary} />
              <Text style={styles.menuItemText}>Asistencia en ruta y siniestros 24/7</Text>
            </View>
            <Icon name="arrow-right" size={16} color={colors.textMuted} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem} onPress={onOpenChat}>
            <View style={styles.menuItemLeft}>
              <Icon name="chat" size={20} color={colors.primary} />
              <Text style={styles.menuItemText}>Mensajería y coordinación</Text>
            </View>
            <Icon name="arrow-right" size={16} color={colors.textMuted} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.menuItem, { borderBottomWidth: 0 }]}
            onPress={onOpenContract}
          >
            <View style={styles.menuItemLeft}>
              <Icon name="document" size={20} color={colors.primary} />
              <Text style={styles.menuItemText}>Términos y contrato digital legal</Text>
            </View>
            <Icon name="arrow-right" size={16} color={colors.textMuted} />
          </TouchableOpacity>
        </View>

        {/* Cerrar Sesión */}
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Text style={styles.logoutBtnText}>Cerrar Sesión</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: 20,
    gap: 18,
    paddingBottom: 40,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  screenTitle: {
    fontSize: 26,
    fontWeight: "600",
    letterSpacing: -0.4,
    color: colors.text,
  },
  badgeKyc: {
    backgroundColor: colors.accent100,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  badgeKycText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.accent800,
  },
  profileCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 18,
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
    backgroundColor: colors.surfaceSecondary,
    alignItems: "center",
    justifyContent: "center",
  },
  userName: {
    fontSize: 18,
    fontWeight: "600",
    color: colors.text,
  },
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  ratingText: {
    fontSize: 14,
    color: colors.textMuted,
  },
  statsCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
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
    fontSize: 20,
    fontWeight: "700",
    color: colors.primary,
  },
  statLabel: {
    fontSize: 12,
    color: colors.textMuted,
  },
  statDivider: {
    width: 1,
    height: 32,
    backgroundColor: colors.border,
  },
  menuCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    overflow: "hidden",
  },
  menuItem: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  menuItemLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  menuItemText: {
    fontSize: 15,
    color: colors.text,
    fontWeight: "500",
  },
  menuItemMeta: {
    fontSize: 14,
    color: colors.textMuted,
  },
  logoutBtn: {
    height: 52,
    borderRadius: 12,
    backgroundColor: colors.dangerBg,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  logoutBtnText: {
    color: colors.dangerText,
    fontSize: 15,
    fontWeight: "600",
  },
});
