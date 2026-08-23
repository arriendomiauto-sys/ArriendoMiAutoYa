import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Switch,
  Alert,
} from "react-native";
import { colors } from "../../theme/colors";
import { useApp } from "../../context/AppContext";
import { Icon } from "../components/Icon";

export function AccountSettingsScreen({ onBack }) {
  const { mode, currentUser, logout } = useApp();
  const isDriver = mode === "conductor";

  // State
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(true);
  const [pushNotifs, setPushNotifs] = useState(true);
  const [smsNotifs, setSmsNotifs] = useState(true);
  const [emailReceipts, setEmailReceipts] = useState(true);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const handleChangePassword = () => {
    if (!currentPassword || !newPassword) {
      Alert.alert("Campos requeridos", "Ingresa tu contraseña actual y la nueva.");
      return;
    }
    if (newPassword.length < 6) {
      Alert.alert("Contraseña débil", "La nueva clave debe tener al menos 6 caracteres.");
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert("Error", "Las contraseñas no coinciden.");
      return;
    }
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    Alert.alert("Contraseña Actualizada", "Tu clave de seguridad ha sido modificada correctamente.");
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      "Eliminar Cuenta",
      "Conforme a la Ley 19.628 de Protección de Datos Personales, tus datos y registros serán eliminados de la plataforma de forma permanente.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Confirmar Eliminación",
          style: "destructive",
          onPress: () => {
            Alert.alert("Solicitud Procesada", "Tu cuenta ha sido cerrada.");
            logout();
          },
        },
      ]
    );
  };

  return (
    <ScrollView
      style={[styles.container, isDriver ? styles.bgDriver : styles.bgPassenger]}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Botón Volver */}
      <TouchableOpacity style={styles.backBtn} onPress={onBack}>
        <Icon name="arrow-left" size={14} color={isDriver ? colors.textWhite : colors.textDark} style={{ marginRight: 4 }} />
        <Text style={[styles.backBtnText, isDriver ? styles.textWhite : styles.textDark]}>
          Volver
        </Text>
      </TouchableOpacity>

      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.title, isDriver ? styles.textWhite : styles.textDark]}>
          Configuración y Seguridad
        </Text>
        <Text style={[styles.subtitle, isDriver ? styles.textSilver : styles.textSecondary]}>
          Gestión de accesos, 2FA y privacidad de datos (Ley 19.628)
        </Text>
      </View>

      {/* SECCIÓN 1: SEGURIDAD Y 2FA */}
      <View style={[styles.card, isDriver ? styles.cardDriver : styles.cardPassenger]}>
        <Text style={[styles.cardTitle, isDriver ? styles.textWhite : styles.textDark]}>
          Autenticación en Dos Pasos (2FA)
        </Text>
        <Text style={[styles.cardDesc, isDriver ? styles.textSilver : styles.textSecondary]}>
          Solicitar código SMS de 4 dígitos en cada inicio de sesión desde un dispositivo nuevo.
        </Text>

        <View style={styles.switchRow}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.switchLabel, isDriver ? styles.textWhite : styles.textDark]}>
              Verificación por SMS (+56 9 **** 4321)
            </Text>
          </View>
          <Switch
            value={twoFactorEnabled}
            onValueChange={setTwoFactorEnabled}
            trackColor={{ false: colors.darkBorder, true: colors.accent }}
            thumbColor={twoFactorEnabled ? colors.white : colors.textMuted}
          />
        </View>
      </View>

      {/* SECCIÓN 2: CAMBIAR CONTRASEÑA */}
      <View style={[styles.card, isDriver ? styles.cardDriver : styles.cardPassenger]}>
        <Text style={[styles.cardTitle, isDriver ? styles.textWhite : styles.textDark]}>
          Cambiar Contraseña
        </Text>

        <View style={styles.inputGroup}>
          <Text style={[styles.inputLabel, isDriver ? styles.textSilver : styles.textSecondary]}>
            Contraseña Actual
          </Text>
          <TextInput
            style={[styles.input, isDriver ? styles.inputDriver : styles.inputPassenger]}
            placeholder="Ingresa tu clave actual"
            placeholderTextColor={colors.textMuted}
            secureTextEntry
            value={currentPassword}
            onChangeText={setCurrentPassword}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={[styles.inputLabel, isDriver ? styles.textSilver : styles.textSecondary]}>
            Nueva Contraseña
          </Text>
          <TextInput
            style={[styles.input, isDriver ? styles.inputDriver : styles.inputPassenger]}
            placeholder="Mínimo 6 caracteres"
            placeholderTextColor={colors.textMuted}
            secureTextEntry
            value={newPassword}
            onChangeText={setNewPassword}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={[styles.inputLabel, isDriver ? styles.textSilver : styles.textSecondary]}>
            Confirmar Nueva Contraseña
          </Text>
          <TextInput
            style={[styles.input, isDriver ? styles.inputDriver : styles.inputPassenger]}
            placeholder="Repite la nueva clave"
            placeholderTextColor={colors.textMuted}
            secureTextEntry
            value={confirmPassword}
            onChangeText={setConfirmPassword}
          />
        </View>

        <TouchableOpacity
          style={[styles.saveBtn, isDriver ? styles.saveBtnDriver : styles.saveBtnPassenger]}
          onPress={handleChangePassword}
        >
          <Text style={[styles.saveBtnText, isDriver && { color: colors.dark }]}>
            Actualizar Clave
          </Text>
        </TouchableOpacity>
      </View>

      {/* SECCIÓN 3: PREFERENCIAS DE NOTIFICACIONES */}
      <View style={[styles.card, isDriver ? styles.cardDriver : styles.cardPassenger]}>
        <Text style={[styles.cardTitle, isDriver ? styles.textWhite : styles.textDark]}>
          Preferencias de Notificaciones
        </Text>

        <View style={styles.switchRow}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.switchLabel, isDriver ? styles.textWhite : styles.textDark]}>
              Notificaciones Push en Tiempo Real
            </Text>
            <Text style={styles.switchSub}>Alertas de entrega, QR y mensajes del chat</Text>
          </View>
          <Switch
            value={pushNotifs}
            onValueChange={setPushNotifs}
            trackColor={{ false: colors.darkBorder, true: colors.accent }}
            thumbColor={pushNotifs ? colors.white : colors.textMuted}
          />
        </View>

        <View style={styles.switchRow}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.switchLabel, isDriver ? styles.textWhite : styles.textDark]}>
              Recordatorios por SMS
            </Text>
            <Text style={styles.switchSub}>Avisos de inicio y fin de arriendo</Text>
          </View>
          <Switch
            value={smsNotifs}
            onValueChange={setSmsNotifs}
            trackColor={{ false: colors.darkBorder, true: colors.accent }}
            thumbColor={smsNotifs ? colors.white : colors.textMuted}
          />
        </View>

        <View style={styles.switchRow}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.switchLabel, isDriver ? styles.textWhite : styles.textDark]}>
              Boletas Electrónicas SII por Email
            </Text>
            <Text style={styles.switchSub}>Envío automático del comprobante tributario</Text>
          </View>
          <Switch
            value={emailReceipts}
            onValueChange={setEmailReceipts}
            trackColor={{ false: colors.darkBorder, true: colors.accent }}
            thumbColor={emailReceipts ? colors.white : colors.textMuted}
          />
        </View>
      </View>

      {/* SECCIÓN 4: SESIONES ACTIVAS */}
      <View style={[styles.card, isDriver ? styles.cardDriver : styles.cardPassenger]}>
        <Text style={[styles.cardTitle, isDriver ? styles.textWhite : styles.textDark]}>
          Dispositivos y Sesiones Activas
        </Text>

        <View style={styles.sessionItem}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.sessionDevice, isDriver ? styles.textWhite : styles.textDark]}>
              Este Dispositivo (Móvil)
            </Text>
            <Text style={styles.sessionDetails}>Los Ángeles, Chile • Conectado ahora</Text>
          </View>
          <View style={styles.currentBadge}>
            <Text style={styles.currentBadgeText}>Actual</Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.closeOtherSessionsBtn}
          onPress={() =>
            Alert.alert(
              "Cerrar Sesiones",
              "Se han desconectado todos los demás accesos web y móviles."
            )
          }
        >
          <Text style={styles.closeOtherSessionsText}>Cerrar todas las demás sesiones</Text>
        </TouchableOpacity>
      </View>

      {/* ELIMINAR CUENTA */}
      <TouchableOpacity style={styles.deleteAccountBtn} onPress={handleDeleteAccount}>
        <Text style={styles.deleteAccountText}>Solicitar Eliminación de Cuenta y Datos</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  bgPassenger: {
    backgroundColor: colors.lightBg,
  },
  bgDriver: {
    backgroundColor: colors.darkBg,
  },
  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 5,
    paddingHorizontal: 8,
    alignSelf: "flex-start",
    marginBottom: 8,
  },
  backBtnText: {
    fontSize: 12,
    fontWeight: "700",
  },
  header: {
    marginBottom: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: "900",
  },
  subtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  card: {
    borderRadius: 10,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
  },
  cardPassenger: {
    backgroundColor: colors.lightCard,
    borderColor: colors.lightCardBorder,
  },
  cardDriver: {
    backgroundColor: colors.darkCard,
    borderColor: colors.darkBorder,
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: "800",
    marginBottom: 4,
  },
  cardDesc: {
    fontSize: 11,
    lineHeight: 15,
    marginBottom: 10,
  },
  switchRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: "rgba(15, 23, 42, 0.06)",
  },
  switchLabel: {
    fontSize: 11,
    fontWeight: "700",
  },
  switchSub: {
    fontSize: 10,
    color: colors.textMuted,
    marginTop: 1,
  },
  inputGroup: {
    marginBottom: 10,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: "700",
    marginBottom: 3,
  },
  input: {
    height: 40,
    borderRadius: 6,
    paddingHorizontal: 12,
    fontSize: 12,
    borderWidth: 1,
  },
  inputPassenger: {
    backgroundColor: colors.lightSurface,
    borderColor: colors.lightCardBorder,
    color: colors.textDark,
  },
  inputDriver: {
    backgroundColor: colors.darkCardHover,
    borderColor: colors.darkBorder,
    color: colors.textWhite,
  },
  saveBtn: {
    paddingVertical: 10,
    borderRadius: 6,
    alignItems: "center",
    marginTop: 4,
  },
  saveBtnPassenger: {
    backgroundColor: colors.primary,
  },
  saveBtnDriver: {
    backgroundColor: colors.accent,
  },
  saveBtnText: {
    color: colors.textWhite,
    fontWeight: "800",
    fontSize: 12,
  },
  sessionItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
  },
  sessionDevice: {
    fontSize: 12,
    fontWeight: "700",
  },
  sessionDetails: {
    fontSize: 10,
    color: colors.textMuted,
    marginTop: 1,
  },
  currentBadge: {
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 4,
  },
  currentBadgeText: {
    color: colors.success,
    fontSize: 9,
    fontWeight: "800",
  },
  closeOtherSessionsBtn: {
    marginTop: 8,
    paddingVertical: 8,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.lightCardBorder,
    borderRadius: 6,
  },
  closeOtherSessionsText: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: "600",
  },
  deleteAccountBtn: {
    paddingVertical: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.danger,
    alignItems: "center",
    backgroundColor: "rgba(239, 68, 68, 0.06)",
    marginTop: 4,
    marginBottom: 10,
  },
  deleteAccountText: {
    color: colors.danger,
    fontSize: 11,
    fontWeight: "800",
  },
  textWhite: { color: colors.textWhite },
  textDark: { color: colors.textDark },
  textSilver: { color: colors.textSilver },
  textSecondary: { color: colors.textSecondary },
});
