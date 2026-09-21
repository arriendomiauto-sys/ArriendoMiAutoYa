import React, { useRef, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StatusBar,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import {
  colors,
  theme,
  useApp,
  ApiClient,
  Icon,
  Checkbox,
  LegalModal,
  BotonesOAuth,
  EDAD_MINIMA_ARRENDATARIO,
  showAlert,
  traducirErrorAuth,
  formatearTelefonoInput,
  normalizarTelefonoCompleto,
} from "@rentacar/mobile-shared";
import { OwnerAuthHero } from "./OwnerAuthHero";
import { OwnerGradientButton } from "./OwnerGradientButton";
import { OwnerField } from "./OwnerField";

// RegisterScreen exclusivo de la app de dueño usando NativeWind
export function OwnerRegisterScreen({ onNavigate }) {
  const { register } = useApp();

  const [form, setForm] = useState({
    nombre: "",
    apellido: "",
    email: "",
    telefono: "",
    password: "",
    confirmPassword: "",
  });
  const nombreCompleto = `${form.nombre.trim()} ${form.apellido.trim()}`.trim();

  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [loading, setLoading] = useState(false);

  const apellidoRef = useRef(null);
  const emailRef = useRef(null);
  const telefonoRef = useRef(null);
  const passwordRef = useRef(null);
  const confirmRef = useRef(null);
  const [documentoLegal, setDocumentoLegal] = useState(null);

  const set = (campo) => (text) => setForm((f) => ({ ...f, [campo]: text }));

  const handleRegister = async () => {
    if (loading) return;
    if (!form.nombre.trim()) {
      showAlert("Campo requerido", "Por favor ingresa tu nombre.");
      return;
    }
    if (!form.apellido.trim()) {
      showAlert("Campo requerido", "Por favor ingresa tu apellido.");
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
      const data = await register(form.email.trim(), form.password, "owner");

      if (data?.session) {
        try {
          await ApiClient.actualizarPerfilBasico({
            nombre: nombreCompleto,
            telefono: normalizarTelefonoCompleto(form.telefono),
          });
        } catch (err) {
          console.warn("[OwnerRegisterScreen] No se pudo guardar el perfil básico:", err.message);
        }
      } else {
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
      className="flex-1 bg-background"
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <StatusBar barStyle="light-content" />
      <OwnerAuthHero variant="compact" title="Crea tu cuenta de dueño" onBack={() => onNavigate("welcome")} />

      <ScrollView
        className="flex-1"
        contentContainerClassName="flex-grow px-4 pt-6 pb-8 gap-4"
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View className="flex-row items-center gap-3.5 rounded-2xl bg-primary-700 p-4 mb-1">
          <Icon name="star" size={19} color={colors.accent} strokeWidth={1.5} />
          <Text className="flex-1 text-[13px] leading-[19px] text-white/90">
            Publicar no tiene costo. Recibes tus pagos directo en tu cuenta bancaria.
          </Text>
        </View>

        <View className="flex-row gap-3.5">
          <OwnerField
            className="flex-1"
            placeholder="Nombre"
            value={form.nombre}
            onChangeText={set("nombre")}
            autoCapitalize="words"
            returnKeyType="next"
            blurOnSubmit={false}
            onSubmitEditing={() => apellidoRef.current?.focus()}
          />
          <OwnerField
            className="flex-1"
            ref={apellidoRef}
            placeholder="Apellido"
            value={form.apellido}
            onChangeText={set("apellido")}
            autoCapitalize="words"
            returnKeyType="next"
            blurOnSubmit={false}
            onSubmitEditing={() => emailRef.current?.focus()}
          />
        </View>

        <OwnerField
          ref={emailRef}
          placeholder="Correo electrónico"
          value={form.email}
          onChangeText={set("email")}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          returnKeyType="next"
          blurOnSubmit={false}
          onSubmitEditing={() => telefonoRef.current?.focus()}
        />

        <OwnerField
          ref={telefonoRef}
          placeholder="7734 1208"
          prefix="+56 9"
          value={form.telefono}
          onChangeText={set("telefono")}
          format={formatearTelefonoInput}
          maxLength={9}
          keyboardType="phone-pad"
          returnKeyType="next"
          blurOnSubmit={false}
          onSubmitEditing={() => passwordRef.current?.focus()}
        />

        <OwnerField
          ref={passwordRef}
          placeholder="Contraseña"
          value={form.password}
          onChangeText={set("password")}
          secure
          returnKeyType="next"
          blurOnSubmit={false}
          onSubmitEditing={() => confirmRef.current?.focus()}
        />

        <OwnerField
          ref={confirmRef}
          placeholder="Confirmar contraseña"
          value={form.confirmPassword}
          onChangeText={set("confirmPassword")}
          secure
          returnKeyType="go"
          onSubmitEditing={handleRegister}
        />
        {form.confirmPassword && form.password !== form.confirmPassword ? (
          <Text className="text-[13px] text-red-600 -mt-2">Las contraseñas no coinciden.</Text>
        ) : null}

        <View className="border border-gray-200 rounded-xl p-3.5 gap-1">
          <Text className="text-xs font-semibold text-textMuted uppercase tracking-wider">Antes de aceptar, léelos</Text>
          <TouchableOpacity
            className="py-1.5 active:opacity-75"
            onPress={() => setDocumentoLegal("terminos")}
            hitSlop={theme.control.hitSlop}
          >
            <Text className="text-[13.5px] font-semibold text-primary-700">Términos y condiciones</Text>
          </TouchableOpacity>
          <TouchableOpacity
            className="py-1.5 active:opacity-75"
            onPress={() => setDocumentoLegal("privacidad")}
            hitSlop={theme.control.hitSlop}
          >
            <Text className="text-[13.5px] font-semibold text-primary-700">Política de privacidad</Text>
          </TouchableOpacity>
        </View>

        <Checkbox
          label={`He leído y acepto los términos y la política de privacidad, y tengo ${EDAD_MINIMA_ARRENDATARIO} años o más.`}
          checked={acceptedTerms}
          onToggle={() => setAcceptedTerms((v) => !v)}
        />

        <OwnerGradientButton
          label="Crear cuenta de dueño"
          onPress={handleRegister}
          loading={loading}
          className="mt-2"
        />

        <BotonesOAuth preferredMode="owner" />
      </ScrollView>

      <LegalModal
        visible={!!documentoLegal}
        doc={documentoLegal || "terminos"}
        onClose={() => setDocumentoLegal(null)}
        onAccept={() => setAcceptedTerms(true)}
      />
    </KeyboardAvoidingView>
  );
}
