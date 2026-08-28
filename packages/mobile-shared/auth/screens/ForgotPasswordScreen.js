import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  StatusBar,
} from "react-native";
import { colors } from "../../theme/colors";
import { Icon } from "../../components/Icon";
import { useApp } from "../../context/AppContext";
import { showAlert } from "../../utils/alert";
import { traducirErrorAuth } from "../../utils/authErrors";

// Antes esto era un flujo de 4 pantallas totalmente simulado (código SMS
// falso que aceptaba cualquier dígito, "actualizar contraseña" con un
// setTimeout que no llamaba a nada) — terminaba mostrando "Contraseña
// Actualizada" sin haber cambiado la contraseña real en Supabase Auth. Un
// mensaje "coherente" no puede prometer algo que no pasó: esto envía el
// correo de recuperación real de Supabase (el que de verdad permite
// definir una nueva clave) y es honesto sobre que el resto pasa por correo.
export function ForgotPasswordScreen({ onNavigate }) {
  const { resetPassword } = useApp();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [enviado, setEnviado] = useState(false);

  const handleEnviar = async () => {
    if (!email.trim()) {
      showAlert("Campo Requerido", "Ingresa el correo con el que te registraste.");
      return;
    }
    setLoading(true);
    try {
      await resetPassword(email.trim());
      setEnviado(true);
    } catch (err) {
      showAlert("No se pudo enviar el correo", traducirErrorAuth(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <StatusBar barStyle="light-content" />

      <TouchableOpacity style={styles.backBtn} onPress={() => onNavigate("login")}>
        <Text style={styles.backBtnText}>← Volver</Text>
      </TouchableOpacity>

      <View style={styles.headerBox}>
        <Text style={styles.title}>Recuperar Clave</Text>
        <Text style={styles.subtitle}>Restablece el acceso a tu cuenta</Text>
      </View>

      {!enviado ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Ingresa tu correo</Text>
          <Text style={styles.cardDesc}>
            Te enviaremos un enlace para definir una nueva contraseña.
          </Text>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Correo registrado</Text>
            <TextInput
              style={styles.input}
              placeholder="nombre@correo.com"
              placeholderTextColor={colors.textMuted}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
            />
          </View>

          <TouchableOpacity
            style={[styles.primaryBtn, loading && styles.btnDisabled]}
            onPress={handleEnviar}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={colors.dark} />
            ) : (
              <Text style={styles.primaryBtnText}>Enviar Enlace de Recuperación →</Text>
            )}
          </TouchableOpacity>
        </View>
      ) : (
        <View style={[styles.card, styles.successCard]}>
          <View style={styles.successIconCircle}>
            <Icon name="chat" size={24} color={colors.accent} />
          </View>
          <Text style={styles.successTitle}>Revisa tu correo</Text>
          <Text style={styles.successDesc}>
            Si {email.trim()} está registrado, te enviamos un enlace para definir una
            nueva contraseña. Puede tardar unos minutos — revisa también spam.
          </Text>

          <TouchableOpacity style={styles.primaryBtn} onPress={() => onNavigate("login")}>
            <Text style={styles.primaryBtnText}>Ir al Inicio de Sesión →</Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.darkBg,
  },
  content: {
    padding: 20,
    paddingTop: 50,
    paddingBottom: 40,
  },
  backBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: colors.darkCard,
    alignSelf: "flex-start",
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.darkBorder,
  },
  backBtnText: {
    color: colors.textSilver,
    fontSize: 12,
    fontWeight: "700",
  },
  headerBox: {
    marginBottom: 18,
  },
  title: {
    fontSize: 22,
    fontWeight: "900",
    color: colors.textWhite,
  },
  subtitle: {
    fontSize: 12,
    color: colors.textSilver,
    marginTop: 3,
  },
  card: {
    backgroundColor: colors.darkCard,
    borderRadius: 14,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.darkBorder,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: colors.textWhite,
    marginBottom: 4,
  },
  cardDesc: {
    fontSize: 11,
    color: colors.textSilver,
    lineHeight: 15,
    marginBottom: 14,
  },
  inputGroup: {
    marginBottom: 12,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.textSilver,
    marginBottom: 4,
  },
  input: {
    backgroundColor: colors.darkCardHover,
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 44,
    color: colors.textWhite,
    borderWidth: 1,
    borderColor: colors.darkBorder,
    fontSize: 13,
  },
  primaryBtn: {
    backgroundColor: colors.accent,
    paddingVertical: 13,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 4,
  },
  btnDisabled: {
    opacity: 0.5,
  },
  primaryBtnText: {
    color: colors.dark,
    fontSize: 14,
    fontWeight: "800",
  },
  successCard: {
    alignItems: "center",
    paddingVertical: 28,
  },
  successIconCircle: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: colors.accentMuted,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
    borderWidth: 1.5,
    borderColor: colors.accent,
  },
  successTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: colors.textWhite,
    marginBottom: 6,
  },
  successDesc: {
    fontSize: 12,
    color: colors.textSilver,
    textAlign: "center",
    lineHeight: 17,
    marginBottom: 18,
    paddingHorizontal: 10,
  },
});
