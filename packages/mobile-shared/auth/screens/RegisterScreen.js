import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
} from "react-native";
import { colors } from "../../theme/colors";
import { useApp } from "../../context/AppContext";
import { ApiClient } from "../../api/client";
import { Icon } from "../../components/Icon";
import { showAlert } from "../../utils/alert";
import { traducirErrorAuth } from "../../utils/authErrors";

// El rol ya no se elige aquí con un toggle "TIPO DE CUENTA": cada app
// (mobile-owner / mobile-renter) es un binario dedicado a un solo rol, que
// AuthFlow pasa como prop fija.
//
// La cuenta se crea "simple": solo nombre, correo, teléfono y contraseña.
// El RUT (y, para dueños, la cuenta bancaria) son datos de identidad/pago
// que se piden recién cuando el usuario intenta reservar o publicar un
// auto de verdad — no hace falta completarlos para poder entrar a mirar
// la app.
export function RegisterScreen({ onNavigate, role = "renter" }) {
  const { register } = useApp();
  const isDriver = role === "owner";

  const [form, setForm] = useState({
    nombre: "",
    email: "",
    telefono: "",
    password: "",
    confirmPassword: "",
  });

  const [focusedField, setFocusedField] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    if (!form.nombre.trim()) {
      showAlert("Campo requerido", "Por favor ingresa tu nombre completo.");
      return;
    }
    if (!form.email.trim()) {
      showAlert("Campo requerido", "Por favor ingresa tu correo electrónico.");
      return;
    }
    if (!form.telefono.trim()) {
      showAlert("Campo requerido", "Por favor ingresa tu número de teléfono móvil.");
      return;
    }
    if (!form.password || form.password.length < 6) {
      showAlert("Contraseña débil", "La clave debe tener al menos 6 caracteres.");
      return;
    }
    if (form.password !== form.confirmPassword) {
      showAlert("Error", "Las contraseñas no coinciden.");
      return;
    }
    if (!acceptedTerms) {
      showAlert(
        "Términos requeridos",
        "Debes aceptar los términos y condiciones y declarar tener 22 años o más."
      );
      return;
    }

    setLoading(true);
    try {
      const data = await register(form.email, form.password);

      if (data?.session) {
        // El proyecto Supabase no exige confirmación de correo: la sesión
        // ya quedó activa. Guardamos nombre/teléfono (no son datos de
        // identidad, no requieren KYC) y dejamos que el componente padre
        // deje de mostrar <AuthFlow /> apenas useApp() refleje la sesión —
        // no hace falta forzar ningún paso más acá.
        try {
          await ApiClient.actualizarPerfilBasico({
            nombre: form.nombre,
            telefono: `+56 9 ${form.telefono}`,
          });
        } catch (err) {
          // No bloquea la creación de cuenta: el usuario puede completar
          // su nombre/teléfono después desde el perfil si esto falla.
          console.warn("[RegisterScreen] No se pudo guardar el perfil básico:", err.message);
        }
      } else {
        // Supabase exige confirmar el correo antes de iniciar sesión.
        onNavigate("confirm_email");
      }
    } catch (err) {
      showAlert("No se pudo crear la cuenta", traducirErrorAuth(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />

      {/* Header (Pantalla 04) */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => onNavigate("welcome")}
          activeOpacity={0.7}
        >
          <Icon name="arrow-left" size={20} color={colors.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Crear mi cuenta</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Info Banner del rol fijo de esta app */}
        <View
          style={[
            styles.roleBanner,
            isDriver ? styles.roleBannerTeal : styles.roleBannerMint,
          ]}
        >
          <Icon
            name={isDriver ? "car" : "key"}
            size={18}
            color={isDriver ? colors.primary : colors.accent700}
            style={{ marginRight: 10 }}
          />
          <Text
            style={[
              styles.roleBannerText,
              isDriver ? styles.roleBannerTextTeal : styles.roleBannerTextMint,
            ]}
          >
            {isDriver
              ? "Cuenta de Dueño: para publicar vehículos y recibir pagos por arriendo en tu cuenta bancaria."
              : "Cuenta de Arrendatario: para reservar vehículos por días o semanas con garantía protegida."}
          </Text>
        </View>

        {/* Field: Nombre completo */}
        <View style={styles.formGroup}>
          <Text style={styles.fieldLabel}>NOMBRE COMPLETO</Text>
          <View
            style={[
              styles.inputBox,
              focusedField === "nombre" && styles.inputBoxFocused,
            ]}
          >
            <TextInput
              style={styles.textInput}
              value={form.nombre}
              onChangeText={(text) => setForm({ ...form, nombre: text })}
              onFocus={() => setFocusedField("nombre")}
              placeholder="Ej. Rodrigo Muñoz"
              placeholderTextColor={colors.textPlaceholder}
              autoCapitalize="words"
            />
          </View>
        </View>

        {/* Field: Correo */}
        <View style={styles.formGroup}>
          <Text style={styles.fieldLabel}>CORREO</Text>
          <View
            style={[
              styles.inputBox,
              focusedField === "email" && styles.inputBoxFocused,
            ]}
          >
            <TextInput
              style={styles.textInput}
              value={form.email}
              onChangeText={(text) => setForm({ ...form, email: text })}
              onFocus={() => setFocusedField("email")}
              placeholder="nombre@correo.com"
              placeholderTextColor={colors.textPlaceholder}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>
        </View>

        {/* Field: Teléfono */}
        <View style={styles.formGroup}>
          <Text style={styles.fieldLabel}>TELÉFONO</Text>
          <View
            style={[
              styles.phoneInputBox,
              focusedField === "telefono" && styles.inputBoxFocused,
            ]}
          >
            <Text style={styles.phonePrefix}>+56 9</Text>
            <TextInput
              style={styles.phoneInput}
              value={form.telefono}
              onChangeText={(text) => setForm({ ...form, telefono: text })}
              onFocus={() => setFocusedField("telefono")}
              placeholder="7734 1208"
              placeholderTextColor={colors.textPlaceholder}
              keyboardType="phone-pad"
            />
          </View>
          <Text style={styles.helperText}>Le enviaremos un código de seis dígitos.</Text>
        </View>

        {/* Field: Contraseña */}
        <View style={styles.formGroup}>
          <Text style={styles.fieldLabel}>CONTRASEÑA</Text>
          <View
            style={[
              styles.passwordInputBox,
              focusedField === "password" && styles.inputBoxFocused,
            ]}
          >
            <TextInput
              style={styles.passwordInput}
              value={form.password}
              onChangeText={(text) => setForm({ ...form, password: text })}
              onFocus={() => setFocusedField("password")}
              placeholder="••••••••••"
              placeholderTextColor={colors.textPlaceholder}
              secureTextEntry={!showPassword}
            />
            <TouchableOpacity
              onPress={() => setShowPassword(!showPassword)}
              activeOpacity={0.7}
            >
              <Text style={styles.showPassText}>
                {showPassword ? "Ocultar" : "Ver"}
              </Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.helperText}>Mínimo 6 caracteres.</Text>
        </View>

        {/* Field: Confirmar contraseña */}
        <View style={styles.formGroup}>
          <Text style={styles.fieldLabel}>CONFIRMAR CONTRASEÑA</Text>
          <View
            style={[
              styles.passwordInputBox,
              focusedField === "confirmPassword" && styles.inputBoxFocused,
            ]}
          >
            <TextInput
              style={styles.passwordInput}
              value={form.confirmPassword}
              onChangeText={(text) => setForm({ ...form, confirmPassword: text })}
              onFocus={() => setFocusedField("confirmPassword")}
              placeholder="••••••••••"
              placeholderTextColor={colors.textPlaceholder}
              secureTextEntry={!showConfirmPassword}
            />
            <TouchableOpacity
              onPress={() => setShowConfirmPassword(!showConfirmPassword)}
              activeOpacity={0.7}
            >
              <Text style={styles.showPassText}>
                {showConfirmPassword ? "Ocultar" : "Ver"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Terms Checkbox */}
        <TouchableOpacity
          style={styles.checkboxRow}
          onPress={() => setAcceptedTerms(!acceptedTerms)}
          activeOpacity={0.8}
        >
          <View
            style={[
              styles.checkbox,
              acceptedTerms && styles.checkboxActive,
            ]}
          >
            {acceptedTerms && <Icon name="check" size={14} color="#FFFFFF" />}
          </View>
          <Text style={styles.checkboxLabel}>
            Acepto los términos y la política de privacidad. Declaro tener 22 años o más.
          </Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Bottom CTA */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={[styles.primaryBtn, loading && styles.btnDisabled]}
          onPress={handleRegister}
          activeOpacity={0.85}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.primaryBtnText}>
              {isDriver ? "Crear cuenta de Dueño" : "Crear cuenta de Arrendatario"}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: "space-between",
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: colors.text,
  },
  content: {
    padding: 20,
    gap: 18,
    paddingBottom: 32,
  },
  roleBanner: {
    borderRadius: 12,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
  },
  roleBannerTeal: {
    backgroundColor: colors.primary100,
  },
  roleBannerMint: {
    backgroundColor: colors.accent100,
  },
  roleBannerText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  roleBannerTextTeal: {
    color: colors.primary,
  },
  roleBannerTextMint: {
    color: colors.accent700,
  },
  formGroup: {
    gap: 6,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.8,
    color: colors.textMuted,
    textTransform: "uppercase",
  },
  inputBox: {
    height: 52,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: colors.surface,
    paddingHorizontal: 16,
    justifyContent: "center",
  },
  inputBoxFocused: {
    borderColor: colors.primary,
    boxShadow: "0 0 0 4px #E4F8F2",
  },
  textInput: {
    fontSize: 16,
    color: colors.text,
  },
  phoneInputBox: {
    height: 52,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: colors.surface,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    gap: 10,
  },
  phonePrefix: {
    fontSize: 16,
    color: colors.textMuted,
  },
  phoneInput: {
    flex: 1,
    fontSize: 16,
    color: colors.text,
  },
  passwordInputBox: {
    height: 52,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: colors.surface,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
  },
  passwordInput: {
    flex: 1,
    fontSize: 16,
    color: colors.text,
  },
  showPassText: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.accent700,
  },
  helperText: {
    fontSize: 14,
    color: colors.textMuted,
  },
  checkboxRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    marginTop: 4,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  checkboxActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  checkboxLabel: {
    flex: 1,
    fontSize: 14,
    color: colors.textMuted,
    lineHeight: 20,
  },
  bottomBar: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 34,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  primaryBtn: {
    height: 56,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  btnDisabled: {
    opacity: 0.6,
  },
  primaryBtnText: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "600",
  },
});
