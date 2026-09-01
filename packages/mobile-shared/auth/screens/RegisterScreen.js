import React, { useState } from "react";
import { View, Text, StyleSheet, ScrollView, StatusBar, TouchableOpacity, KeyboardAvoidingView, Platform } from "react-native";
import { colors } from "../../theme/colors";
import { theme } from "../../theme/tokens";
import { useApp } from "../../context/AppContext";
import { ApiClient } from "../../api/client";
import { Icon } from "../../components/Icon";
import { Button, Field, Checkbox, ScreenHeader, BottomBar } from "../../components/ui";
import { LegalModal } from "../../screens/LegalModal";
import { EDAD_MINIMA_ARRENDATARIO } from "../../legal/documentos";
import { showAlert } from "../../utils/alert";
import { traducirErrorAuth } from "../../utils/authErrors";

// El rol ("renter" | "owner") viene elegido desde la bienvenida y solo
// define el copy y el modo con el que arranca la app — no crea cuentas
// distintas. El usuario alterna de modo después desde su perfil.
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

  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  // Documento legal abierto en el visor (null = cerrado). El registro exige
  // aceptar términos y privacidad, así que tienen que poder leerse acá mismo
  // antes de marcar la casilla.
  const [documentoLegal, setDocumentoLegal] = useState(null);

  const set = (campo) => (text) => setForm((f) => ({ ...f, [campo]: text }));

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
        `Debes leer y aceptar los términos y condiciones y la política de privacidad, y declarar tener ${EDAD_MINIMA_ARRENDATARIO} años o más.`,
        [
          { text: "Ahora no", style: "cancel" },
          { text: "Leer términos", onPress: () => setDocumentoLegal("terminos") },
        ]
      );
      return;
    }

    setLoading(true);
    try {
      const data = await register(form.email.trim(), form.password, role);

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
      if (err.code === "already_registered") {
        showAlert(
          "Ya tienes una cuenta",
          "Ya existe una cuenta con este correo. Inicia sesión en vez de crear una nueva.",
          [
            { text: "Cancelar", style: "cancel" },
            { text: "Iniciar sesión", onPress: () => onNavigate("login") },
          ]
        );
      } else {
        showAlert("No se pudo crear la cuenta", traducirErrorAuth(err));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 10 : 0}
    >
      <StatusBar barStyle="dark-content" />

      <ScreenHeader title="Crear mi cuenta" onBack={() => onNavigate("welcome")} />

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        {/* Banner del rol elegido en la bienvenida */}
        <View
          style={[
            styles.roleBanner,
            { backgroundColor: isDriver ? colors.primary100 : colors.accent100 },
          ]}
        >
          <Icon
            name={isDriver ? "car" : "key"}
            size={18}
            color={isDriver ? colors.primary : colors.accent700}
          />
          <Text
            style={[
              styles.roleBannerText,
              { color: isDriver ? colors.primary : colors.accent700 },
            ]}
          >
            {isDriver
              ? "Cuenta de Dueño: para publicar vehículos y recibir pagos por arriendo en tu cuenta bancaria."
              : "Cuenta de Arrendatario: para reservar vehículos por días o semanas con garantía protegida."}
          </Text>
        </View>

        <Field
          label="Nombre completo"
          value={form.nombre}
          onChangeText={set("nombre")}
          placeholder="Ej. Rodrigo Muñoz"
          autoCapitalize="words"
        />

        <Field
          label="Correo"
          value={form.email}
          onChangeText={set("email")}
          placeholder="nombre@correo.com"
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
        />

        <Field
          label="Teléfono"
          value={form.telefono}
          onChangeText={set("telefono")}
          placeholder="7734 1208"
          prefix="+56 9"
          keyboardType="phone-pad"
          helper="Le enviaremos un código de seis dígitos."
        />

        <Field
          label="Contraseña"
          value={form.password}
          onChangeText={set("password")}
          placeholder="••••••••••"
          secure
          helper="Mínimo 6 caracteres."
        />

        <Field
          label="Confirmar contraseña"
          value={form.confirmPassword}
          onChangeText={set("confirmPassword")}
          placeholder="••••••••••"
          secure
          error={
            form.confirmPassword && form.password !== form.confirmPassword
              ? "Las contraseñas no coinciden."
              : undefined
          }
        />

        <View style={styles.legalBox}>
          <Text style={styles.legalTitle}>Antes de aceptar, léelos</Text>
          <View style={styles.legalLinks}>
            <TouchableOpacity
              style={styles.legalLink}
              onPress={() => setDocumentoLegal("terminos")}
              hitSlop={theme.control.hitSlop}
            >
              <Icon name="document" size={16} color={colors.accentDark} />
              <Text style={styles.legalLinkText}>Términos y condiciones</Text>
              <Icon name="arrow-right" size={14} color={colors.accentDark} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.legalLink}
              onPress={() => setDocumentoLegal("privacidad")}
              hitSlop={theme.control.hitSlop}
            >
              <Icon name="shield" size={16} color={colors.accentDark} />
              <Text style={styles.legalLinkText}>Política de privacidad</Text>
              <Icon name="arrow-right" size={14} color={colors.accentDark} />
            </TouchableOpacity>
          </View>
        </View>

        <Checkbox
          label={`He leído y acepto los términos y la política de privacidad, y tengo ${EDAD_MINIMA_ARRENDATARIO} años o más.`}
          checked={acceptedTerms}
          onChange={setAcceptedTerms}
        />
      </ScrollView>

      <LegalModal
        visible={!!documentoLegal}
        doc={documentoLegal || "terminos"}
        onClose={() => setDocumentoLegal(null)}
        onAccept={() => setAcceptedTerms(true)}
      />

      <BottomBar>
        <Button
          label={isDriver ? "Crear cuenta de Dueño" : "Crear cuenta de Arrendatario"}
          onPress={handleRegister}
          loading={loading}
        />
      </BottomBar>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: "space-between",
  },
  content: {
    padding: theme.spacing.screen,
    paddingBottom: theme.spacing.xxxl,
    gap: theme.spacing.lg,
  },
  roleBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.md,
    borderRadius: theme.radius.field,
    padding: theme.spacing.lg,
  },
  roleBannerText: {
    flex: 1,
    ...theme.typography.body,
  },
  legalBox: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: theme.radius.field,
    backgroundColor: colors.surfaceSubtle,
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  legalTitle: { ...theme.typography.label, color: colors.textMuted },
  legalLinks: { gap: theme.spacing.xs },
  legalLink: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 6 },
  legalLinkText: { flex: 1, fontSize: 14, fontWeight: "600", color: colors.accentDark },
});
