import React, { useRef, useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
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
  formatearRutEnVivo,
  supabase,
} from "@rentacar/mobile-shared";
import { OwnerAuthHero } from "./OwnerAuthHero";
import { OwnerGradientButton } from "./OwnerGradientButton";
import { OwnerField } from "./OwnerField";

/**
 * Valida un RUT chileno con algoritmo oficial de Módulo 11.
 */
function validarRutChileno(rut) {
  if (!rut || typeof rut !== "string") return false;
  const limpio = rut.replace(/[^0-9kK]/g, "").toUpperCase();
  if (limpio.length < 8 || limpio.length > 9) return false;
  const cuerpo = limpio.slice(0, -1);
  const dv = limpio.slice(-1);
  let suma = 0;
  let multiplo = 2;
  for (let i = cuerpo.length - 1; i >= 0; i--) {
    suma += parseInt(cuerpo[i], 10) * multiplo;
    multiplo = multiplo === 7 ? 2 : multiplo + 1;
  }
  const esperado = 11 - (suma % 11);
  const dvEsperado = esperado === 11 ? "0" : esperado === 10 ? "K" : String(esperado);
  return dv === dvEsperado;
}

/**
 * Formatea fecha de nacimiento en DD/MM/AAAA en vivo.
 */
function formatearFechaNacimiento(texto) {
  const digitos = (texto || "").replace(/\D/g, "").slice(0, 8);
  if (digitos.length <= 2) return digitos;
  if (digitos.length <= 4) return `${digitos.slice(0, 2)}/${digitos.slice(2)}`;
  return `${digitos.slice(0, 2)}/${digitos.slice(2, 4)}/${digitos.slice(4)}`;
}

/**
 * Barra superior de progreso de 2 pasos.
 */
function StepProgress({ pasoActual, totalPasos = 2, onBack }) {
  return (
    <View className="flex-row items-center justify-between px-4 pt-3 pb-2 bg-background">
      <TouchableOpacity
        onPress={onBack}
        className="w-8 h-8 rounded-full bg-gray-100 items-center justify-center active:opacity-70"
        hitSlop={theme.control.hitSlop}
      >
        <Icon name="chevron-left" size={18} color={colors.primary700} strokeWidth={2} />
      </TouchableOpacity>
      <View className="flex-row flex-1 mx-4 gap-2">
        <View
          className={`h-1 flex-1 rounded-full ${pasoActual >= 1 ? "bg-[#2DD4BF]" : "bg-gray-200"}`}
        />
        <View
          className={`h-1 flex-1 rounded-full ${pasoActual >= 2 ? "bg-[#2DD4BF]" : "bg-gray-200"}`}
        />
      </View>
      <Text className="text-xs font-semibold text-textMuted">
        Paso {pasoActual} de {totalPasos}
      </Text>
    </View>
  );
}

/**
 * Registro de Dueño en 2 pasos:
 * - Paso 1: Todos los datos (nombre, apellido, correo, contraseña, RUT, celular, fecha, términos).
 * - Paso 2: Verificación por código OTP de 6 dígitos enviado al correo.
 * - Éxito: "Cuenta de dueño creada" con tarjeta resumen y acceso al panel.
 */
export function OwnerRegisterScreen({ onNavigate }) {
  const { register } = useApp();

  // "datos" (Paso 1), "codigo" (Paso 2), "exito"
  const [paso, setPaso] = useState("datos");
  const [loading, setLoading] = useState(false);
  const [avisoCorreoExistente, setAvisoCorreoExistente] = useState(false);
  const [documentoLegal, setDocumentoLegal] = useState(null);
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  // Formulario Paso 1
  const [form, setForm] = useState({
    nombre: "",
    apellido: "",
    email: "",
    password: "",
    rut: "",
    telefono: "",
    fechaNacimiento: "",
  });

  // OTP Paso 2
  const [codigoOtp, setCodigoOtp] = useState(["", "", "", "", "", ""]);
  const otpInputsRef = useRef([]);
  const [tiempoReenvio, setTiempoReenvio] = useState(45);

  // Refs de navegación de teclado
  const apellidoRef = useRef(null);
  const emailRef = useRef(null);
  const passwordRef = useRef(null);
  const rutRef = useRef(null);
  const telefonoRef = useRef(null);
  const fechaRef = useRef(null);

  const set = (campo) => (text) => {
    if (avisoCorreoExistente && campo === "email") setAvisoCorreoExistente(false);
    setForm((f) => ({ ...f, [campo]: text }));
  };

  // Cuenta regresiva del OTP
  useEffect(() => {
    if (paso !== "codigo" || tiempoReenvio <= 0) return;
    const timer = setInterval(() => {
      setTiempoReenvio((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [paso, tiempoReenvio]);

  // Validaciones en vivo
  const rutValido = form.rut.length >= 8 && validarRutChileno(form.rut);
  const passwordLargo = form.password.length >= 8;
  const passwordLetra = /[a-zA-Z]/.test(form.password);
  const passwordNumero = /[0-9]/.test(form.password);
  const passwordCompleta = passwordLargo && passwordLetra && passwordNumero;

  // Manejo de OTP
  const handleOtpChange = (index, value) => {
    const digitos = value.replace(/\D/g, "");
    if (digitos.length >= 6) {
      const nuevo = digitos.slice(0, 6).split("");
      setCodigoOtp(nuevo);
      otpInputsRef.current[5]?.focus();
      return;
    }
    const nuevo = [...codigoOtp];
    nuevo[index] = digitos.slice(-1);
    setCodigoOtp(nuevo);
    if (digitos && index < 5) {
      otpInputsRef.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyPress = (index, e) => {
    if (e.nativeEvent.key === "Backspace" && !codigoOtp[index] && index > 0) {
      const nuevo = [...codigoOtp];
      nuevo[index - 1] = "";
      setCodigoOtp(nuevo);
      otpInputsRef.current[index - 1]?.focus();
    }
  };

  // Acción Paso 1: Enviar datos y pasar a Paso 2 (Código)
  const handleEnviarDatos = async () => {
    if (loading) return;
    if (!form.nombre.trim() || !form.apellido.trim()) {
      showAlert("Campos requeridos", "Por favor ingresa tu nombre y apellido como aparecen en tu cédula.");
      return;
    }
    if (!form.email.trim() || !form.email.includes("@")) {
      showAlert("Correo requerido", "Por favor ingresa un correo electrónico válido.");
      return;
    }
    if (!passwordCompleta) {
      showAlert("Contraseña débil", "La contraseña debe tener al menos 8 caracteres, una letra y un número.");
      return;
    }
    if (!rutValido) {
      showAlert("RUT inválido", "Por favor ingresa un RUT chileno válido con su dígito verificador.");
      return;
    }
    const digitosTel = form.telefono.replace(/\D/g, "");
    if (!digitosTel || digitosTel.length < 8) {
      showAlert("Celular requerido", "Por favor ingresa un número de celular de 9 dígitos.");
      return;
    }
    if (!acceptedTerms) {
      showAlert(
        "Términos requeridos",
        `Debes aceptar los términos y condiciones y la política de privacidad, y declarar tener ${EDAD_MINIMA_ARRENDATARIO} años o más.`
      );
      return;
    }

    setLoading(true);
    try {
      await register(form.email.trim(), form.password, "owner");
      setPaso("codigo");
      setTiempoReenvio(45);
    } catch (err) {
      if (err.code === "already_registered") {
        setAvisoCorreoExistente(true);
      } else {
        showAlert("No se pudo crear la cuenta", traducirErrorAuth(err));
      }
    } finally {
      setLoading(false);
    }
  };

  // Acción Paso 2: Verificar código OTP
  const handleVerificarCodigo = async () => {
    const codigoCompleto = codigoOtp.join("");
    if (codigoCompleto.length < 6) {
      showAlert("Código incompleto", "Por favor ingresa los 6 dígitos enviados a tu correo.");
      return;
    }

    setLoading(true);
    try {
      let verif = await supabase.auth.verifyOtp({
        email: form.email.trim(),
        token: codigoCompleto,
        type: "signup",
      });
      if (verif.error) {
        verif = await supabase.auth.verifyOtp({
          email: form.email.trim(),
          token: codigoCompleto,
          type: "email",
        });
      }
      if (verif.error) throw verif.error;

      // Sincronizar perfil con los datos completados
      try {
        await ApiClient.actualizarPerfilBasico({
          nombre: `${form.nombre.trim()} ${form.apellido.trim()}`,
          rut: form.rut.trim(),
          telefono: normalizarTelefonoCompleto(form.telefono),
          fecha_nacimiento: form.fechaNacimiento.trim(),
        });
      } catch (err) {
        console.warn("[OwnerRegister] Error al actualizar perfil:", err.message);
      }

      setPaso("exito");
    } catch (err) {
      showAlert("Código inválido", "El código es incorrecto o ha expirado. Verifica tu correo o solicita uno nuevo.");
    } finally {
      setLoading(false);
    }
  };

  // Reenviar código OTP
  const handleReenviarCodigo = async () => {
    if (tiempoReenvio > 0 || loading) return;
    setLoading(true);
    try {
      await supabase.auth.resend({
        type: "signup",
        email: form.email.trim(),
      });
      setTiempoReenvio(45);
      showAlert("Código reenviado", `Hemos enviado un nuevo código a ${form.email.trim()}`);
    } catch (err) {
      showAlert("No se pudo reenviar", "Hubo un problema enviando el código. Inténtalo nuevamente.");
    } finally {
      setLoading(false);
    }
  };

  // PANTALLA ÉXITO: Cuenta de dueño creada
  if (paso === "exito") {
    return (
      <View className="flex-1 bg-background justify-between px-6 pt-16 pb-10">
        <StatusBar barStyle="dark-content" />
        <View className="items-center mt-6">
          <View className="w-20 h-20 rounded-full bg-[#E4F8F2] items-center justify-center mb-6">
            <Icon name="check" size={38} color="#10B981" strokeWidth={2.8} />
          </View>
          <Text className="text-2xl font-bold text-primary-700 text-center mb-2">
            Cuenta de dueño creada
          </Text>
          <Text className="text-sm text-textMuted text-center px-4 leading-5 mb-8">
            Hola, {form.nombre.trim()}. Desde tu panel verás tus autos y tus ganancias.
          </Text>

          <View className="w-full bg-white rounded-2xl border border-gray-100 p-5 shadow-sm gap-3.5">
            <View className="flex-row justify-between items-center py-1 border-b border-gray-50">
              <Text className="text-xs text-textMuted font-medium">Correo</Text>
              <Text className="text-sm font-semibold text-primary-800">{form.email.trim()}</Text>
            </View>
            <View className="flex-row justify-between items-center py-1 border-b border-gray-50">
              <Text className="text-xs text-textMuted font-medium">Celular</Text>
              <Text className="text-sm font-semibold text-primary-800">+56 9 {form.telefono.trim()}</Text>
            </View>
            <View className="flex-row justify-between items-center py-1">
              <Text className="text-xs text-textMuted font-medium">RUT</Text>
              <Text className="text-sm font-semibold text-primary-800">{form.rut.trim()}</Text>
            </View>
          </View>
        </View>

        <OwnerGradientButton
          label="Ir a mi panel"
          onPress={() => onNavigate("login")}
          className="w-full"
        />
      </View>
    );
  }

  // PANTALLA PASO 2: Confirmación por código de correo
  if (paso === "codigo") {
    return (
      <KeyboardAvoidingView
        className="flex-1 bg-background"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <StatusBar barStyle="dark-content" />
        <StepProgress pasoActual={2} totalPasos={2} onBack={() => setPaso("datos")} />

        <ScrollView
          className="flex-1"
          contentContainerClassName="flex-grow px-6 pt-8 pb-10 justify-between"
          keyboardShouldPersistTaps="handled"
        >
          <View className="items-center">
            {/* Ícono circular de correo */}
            <View className="w-20 h-20 rounded-full bg-[#E4F8F2] items-center justify-center mb-6">
              <Icon name="mail" size={36} color="#0F3D3E" strokeWidth={1.8} />
            </View>

            <Text className="text-2xl font-bold text-primary-700 text-center mb-2">
              Revisa tu correo
            </Text>
            <Text className="text-sm text-textMuted text-center leading-5 px-4 mb-8">
              Enviamos un código de 6 dígitos a{"\n"}
              <Text className="font-semibold text-primary-800">{form.email.trim()}</Text>
            </Text>

            {/* 6 Casillas de código OTP */}
            <View className="flex-row justify-between w-full max-w-[320px] mb-8 gap-2">
              {codigoOtp.map((digito, idx) => (
                <TextInput
                  key={idx}
                  ref={(el) => (otpInputsRef.current[idx] = el)}
                  className={`w-12 h-14 rounded-xl text-center text-xl font-bold border ${
                    digito
                      ? "border-[#2DD4BF] bg-white text-primary-800"
                      : "border-gray-200 bg-gray-50 text-primary-800"
                  }`}
                  value={digito}
                  onChangeText={(val) => handleOtpChange(idx, val)}
                  onKeyPress={(e) => handleOtpKeyPress(idx, e)}
                  keyboardType="number-pad"
                  maxLength={6}
                  selectTextOnFocus
                />
              ))}
            </View>

            <OwnerGradientButton
              label="Verificar"
              onPress={handleVerificarCodigo}
              loading={loading}
              className="w-full mb-6"
            />

            {tiempoReenvio > 0 ? (
              <Text className="text-sm text-textMuted text-center">
                Reenviar código en 0:{tiempoReenvio < 10 ? `0${tiempoReenvio}` : tiempoReenvio}
              </Text>
            ) : (
              <TouchableOpacity onPress={handleReenviarCodigo} disabled={loading}>
                <Text className="text-sm font-semibold text-primary-700 text-center">
                  Reenviar código
                </Text>
              </TouchableOpacity>
            )}
          </View>

          <TouchableOpacity
            className="items-center py-2"
            onPress={() => setPaso("datos")}
          >
            <Text className="text-sm text-textMuted">
              ¿Correo equivocado?{" "}
              <Text className="font-bold text-primary-700">Cambiarlo</Text>
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // PANTALLA PASO 1: Todos los datos
  return (
    <KeyboardAvoidingView
      className="flex-1 bg-background"
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <StatusBar barStyle="light-content" />
      <OwnerAuthHero variant="compact" caption="PARA DUEÑOS" onBack={() => onNavigate("login")} />
      <StepProgress pasoActual={1} totalPasos={2} onBack={() => onNavigate("login")} />

      <ScrollView
        className="flex-1"
        contentContainerClassName="flex-grow px-4 pt-4 pb-8 gap-4"
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Text className="text-2xl font-bold text-primary-700">Crea tu cuenta de dueño</Text>
        <Text className="text-sm text-textMuted -mt-2">
          Escribe tus datos como aparecen en tu cédula.
        </Text>

        {/* Alerta de correo existente */}
        {avisoCorreoExistente ? (
          <View className="rounded-xl border border-red-200 bg-red-50 p-3.5 gap-1.5">
            <Text className="text-sm font-bold text-red-700">Ese correo ya tiene una cuenta</Text>
            <Text className="text-xs text-red-600 leading-4">
              ¿Eres tú? Inicia sesión o cambia tu contraseña.
            </Text>
            <TouchableOpacity
              className="mt-1 self-start py-1"
              onPress={() => onNavigate("login")}
            >
              <Text className="text-xs font-bold text-red-800 underline">Ir a iniciar sesión</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {/* Fila Nombre y Apellido */}
        <View className="flex-row gap-3">
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

        {/* Correo */}
        <OwnerField
          ref={emailRef}
          placeholder="Correo electrónico"
          iconLeft="mail"
          value={form.email}
          onChangeText={set("email")}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          returnKeyType="next"
          blurOnSubmit={false}
          onSubmitEditing={() => passwordRef.current?.focus()}
        />

        {/* Contraseña */}
        <OwnerField
          ref={passwordRef}
          placeholder="Contraseña"
          iconLeft="lock"
          value={form.password}
          onChangeText={set("password")}
          secure
          revealIcon
          returnKeyType="next"
          blurOnSubmit={false}
          onSubmitEditing={() => rutRef.current?.focus()}
        />

        {/* Chips de validación de contraseña */}
        <View className="flex-row flex-wrap gap-2 -mt-1">
          <View
            className={`flex-row items-center px-2.5 py-1 rounded-full border ${
              passwordLargo ? "bg-[#E4F8F2] border-[#A7F3D0]" : "bg-gray-100 border-gray-200"
            }`}
          >
            <Text className={`text-xs font-semibold ${passwordLargo ? "text-teal-800" : "text-gray-500"}`}>
              {passwordLargo ? "✓ " : ""}8 o más caracteres
            </Text>
          </View>
          <View
            className={`flex-row items-center px-2.5 py-1 rounded-full border ${
              passwordLetra ? "bg-[#E4F8F2] border-[#A7F3D0]" : "bg-gray-100 border-gray-200"
            }`}
          >
            <Text className={`text-xs font-semibold ${passwordLetra ? "text-teal-800" : "text-gray-500"}`}>
              {passwordLetra ? "✓ " : ""}Una letra
            </Text>
          </View>
          <View
            className={`flex-row items-center px-2.5 py-1 rounded-full border ${
              passwordNumero ? "bg-[#E4F8F2] border-[#A7F3D0]" : "bg-gray-100 border-gray-200"
            }`}
          >
            <Text className={`text-xs font-semibold ${passwordNumero ? "text-teal-800" : "text-gray-500"}`}>
              {passwordNumero ? "✓ " : ""}Un número
            </Text>
          </View>
        </View>

        {/* RUT */}
        <View>
          <OwnerField
            ref={rutRef}
            placeholder="12.345.678-5"
            iconLeft="user"
            value={form.rut}
            onChangeText={(txt) => set("rut")(formatearRutEnVivo(txt))}
            autoCapitalize="characters"
            maxLength={12}
            returnKeyType="next"
            blurOnSubmit={false}
            onSubmitEditing={() => telefonoRef.current?.focus()}
          />
          {rutValido ? (
            <Text className="text-xs text-teal-700 font-semibold mt-1 px-1">
              ✓ RUT válido
            </Text>
          ) : form.rut.length >= 8 ? (
            <Text className="text-xs text-red-600 mt-1 px-1">
              El RUT no es válido. Revisa el número y el dígito después del guión.
            </Text>
          ) : null}
        </View>

        {/* Celular con prefijo +56 */}
        <OwnerField
          ref={telefonoRef}
          placeholder="9 1234 5678"
          prefix="+56"
          value={form.telefono}
          onChangeText={set("telefono")}
          format={formatearTelefonoInput}
          maxLength={11}
          keyboardType="phone-pad"
          returnKeyType="next"
          blurOnSubmit={false}
          onSubmitEditing={() => fechaRef.current?.focus()}
        />

        {/* Fecha de nacimiento */}
        <OwnerField
          ref={fechaRef}
          placeholder="DD/MM/AAAA"
          iconLeft="calendar"
          value={form.fechaNacimiento}
          onChangeText={(txt) => set("fechaNacimiento")(formatearFechaNacimiento(txt))}
          maxLength={10}
          keyboardType="numeric"
          returnKeyType="done"
        />

        {/* Términos y privacidad */}
        <View className="flex-row items-start gap-2.5 pt-1">
          <Checkbox
            checked={acceptedTerms}
            onToggle={() => setAcceptedTerms((v) => !v)}
          />
          <Text className="text-xs text-textMuted leading-4 flex-1">
            Acepto los{" "}
            <Text
              className="text-primary-700 font-bold underline"
              onPress={() => setDocumentoLegal("terminos")}
            >
              Términos de uso
            </Text>{" "}
            y la{" "}
            <Text
              className="text-primary-700 font-bold underline"
              onPress={() => setDocumentoLegal("privacidad")}
            >
              Política de privacidad
            </Text>
            .
          </Text>
        </View>

        <OwnerGradientButton
          label="Crear cuenta"
          onPress={handleEnviarDatos}
          loading={loading}
          className="mt-2"
        />

        <View className="items-center my-1">
          <Text className="text-xs text-textMuted font-medium">o regístrate con</Text>
        </View>

        <BotonesOAuth preferredMode="owner" compact />

        <TouchableOpacity
          className="h-10 items-center justify-center active:opacity-70 mt-1"
          onPress={() => onNavigate("login")}
        >
          <Text className="text-[13.5px] text-textMuted">
            ¿Ya tienes cuenta? <Text className="text-primary-700 font-bold">Entrar</Text>
          </Text>
        </TouchableOpacity>
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

