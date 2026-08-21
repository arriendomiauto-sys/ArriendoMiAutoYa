import React from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  ScrollView,
  TouchableOpacity,
  Alert,
  SafeAreaView,
  StatusBar,
} from "react-native";
import { colors } from "../../theme/colors";
import { useApp } from "../../context/AppContext";
import { Icon } from "../../components/Icon";

export function ProfileScreen({
  onOpenEnrolment,
  onOpenPaymentMethods,
  onOpenRentalHistory,
  onOpenMyCars,
  onOpenEarnings,
  onOpenNotifications,
  onOpenSupport,
  onOpenContract,
  onOpenChat,
}) {
  const { mode, toggleMode, currentUser, logout } = useApp();
  const isDriver = mode === "conductor";

  const user = currentUser || {
    nombre: "Rodrigo Muñoz",
    email: "rodrigo.munoz@gmail.com",
    rating: 4.8,
    viajes_completados: 31,
  };

  const handleLogout = () => {
    Alert.alert("Cerrar Sesión", "¿Seguro que deseas salir de tu cuenta?", [
      { text: "Cancelar", style: "cancel" },
      { text: "Cerrar Sesión", style: "destructive", onPress: logout },
    ]);
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.screenTitle}>Mi perfil</Text>

        {/* User Card (Pantalla 1a) */}
        <View style={styles.profileCard}>
          <Image
            source={{
              uri:
                user.foto_perfil_url ||
                "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400",
            }}
            style={styles.avatarImg}
          />
          <View style={{ flex: 1, gap: 3 }}>
            <Text style={styles.userName}>{user.nombre}</Text>
            <View style={styles.ratingRow}>
              <Icon name="star" size={14} color="#2FBF9B" style={{ marginRight: 5 }} />
              <Text style={styles.ratingText}>4,8 · identidad verificada</Text>
            </View>
          </View>
        </View>

        {/* Mode Switch Card (Pantalla 1a) */}
        <View style={styles.modeCard}>
          <Text style={styles.modeCardHeader}>ESTOY USANDO LA APP COMO</Text>
          <View style={styles.toggleContainer}>
            <TouchableOpacity
              style={[
                styles.toggleOption,
                isDriver && styles.toggleOptionActive,
              ]}
              onPress={() => isDriver || toggleMode()}
              activeOpacity={0.85}
            >
              <Text
                style={[
                  styles.toggleOptionText,
                  isDriver && styles.toggleOptionTextActive,
                ]}
              >
                Dueño
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.toggleOption,
                !isDriver && styles.toggleOptionActive,
              ]}
              onPress={() => isDriver && toggleMode()}
              activeOpacity={0.85}
            >
              <Text
                style={[
                  styles.toggleOptionText,
                  !isDriver && styles.toggleOptionTextActive,
                ]}
              >
                Arrendatario
              </Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.modeCardHelp}>
            {isDriver
              ? "Como dueño ve sus autos, solicitudes y ganancias. Cambiar de modo no cierra su sesión."
              : "Como arrendatario busca autos y reserva al instante. Cambiar de modo no cierra su sesión."}
          </Text>
        </View>

        {/* Menu Options */}
        <View style={styles.menuCard}>
          {isDriver ? (
            <>
              <TouchableOpacity style={styles.menuItem} onPress={onOpenMyCars}>
                <Text style={styles.menuItemText}>Mis autos</Text>
                <Text style={styles.menuItemMeta}>2</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.menuItem} onPress={onOpenEarnings}>
                <Text style={styles.menuItemText}>Datos de pago</Text>
                <Text style={styles.menuItemMeta}>Banco Estado</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.menuItem}>
                <Text style={styles.menuItemText}>Calificaciones recibidas</Text>
                <Text style={styles.menuItemMeta}>31</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <TouchableOpacity style={styles.menuItem} onPress={onOpenRentalHistory}>
                <Text style={styles.menuItemText}>Mis arriendos y boletas</Text>
                <Icon name="arrow-right" size={16} color={colors.textMuted} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.menuItem} onPress={onOpenPaymentMethods}>
                <Text style={styles.menuItemText}>Billetera y tarjetas Webpay</Text>
                <Icon name="arrow-right" size={16} color={colors.textMuted} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.menuItem} onPress={onOpenEnrolment}>
                <Text style={styles.menuItemText}>Validación de Identidad (KYC)</Text>
                <Icon name="arrow-right" size={16} color={colors.textMuted} />
              </TouchableOpacity>
            </>
          )}

          <TouchableOpacity style={styles.menuItem} onPress={onOpenChat}>
            <Text style={styles.menuItemText}>Mensajería y coordinación</Text>
            <Icon name="arrow-right" size={16} color={colors.textMuted} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem} onPress={onOpenContract}>
            <Text style={styles.menuItemText}>Contrato digital legal</Text>
            <Icon name="arrow-right" size={16} color={colors.textMuted} />
          </TouchableOpacity>

          <TouchableOpacity style={[styles.menuItem, { borderBottomWidth: 0 }]} onPress={onOpenSupport}>
            <Text style={styles.menuItemText}>Centro de ayuda y soporte</Text>
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
    gap: 20,
    paddingBottom: 40,
  },
  screenTitle: {
    fontSize: 28,
    fontWeight: "600",
    letterSpacing: -0.4,
    color: colors.text,
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
  modeCard: {
    backgroundColor: colors.primary,
    borderRadius: 16,
    padding: 20,
    gap: 16,
  },
  modeCardHeader: {
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.8,
    color: "#92E3CB",
    textTransform: "uppercase",
  },
  toggleContainer: {
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    borderRadius: 12,
    padding: 4,
    flexDirection: "row",
    gap: 4,
  },
  toggleOption: {
    flex: 1,
    height: 48,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  toggleOptionActive: {
    backgroundColor: colors.surface,
  },
  toggleOptionText: {
    fontSize: 15,
    color: "#FFFFFF",
  },
  toggleOptionTextActive: {
    color: colors.primary,
    fontWeight: "600",
  },
  modeCardHelp: {
    fontSize: 14,
    color: "#DCEFEC",
    lineHeight: 20,
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
  menuItemText: {
    fontSize: 16,
    color: colors.text,
  },
  menuItemMeta: {
    fontSize: 16,
    color: colors.textMuted,
  },
  logoutBtn: {
    height: 52,
    borderRadius: 12,
    backgroundColor: "#FBE9E9",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  logoutBtnText: {
    color: "#DC2626",
    fontSize: 15,
    fontWeight: "600",
  },
});
