import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import {
  theme,
  colors,
  useApp,
  Icon,
  ScreenHeader,
  BotonesOAuth,
  AlertaInline,
  useEnvioLogin,
} from "@rentacar/mobile-shared";
import { OwnerField } from "./OwnerField";

/**
 * LoginScreen minimalista y limpio para la app de Dueño,
 * manteniendo consistencia total con la app de Arrendatario
 * pero orientado a la gestión de vehículos y flota.
 */
export function OwnerLoginScreen({ onNavigate }) {
  const { login } = useApp();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const passwordRef = useRef(null);
  const { loading, error, enviar, limpiarError } = useEnvioLogin(login);

  const handleLogin = () => enviar(email, password);

  // Con credenciales rechazadas el foco vuelve a la contraseña;
  // lo escrito se conserva para corregirlo sin reescribir el correo.
  useEffect(() => {
    if (error?.campo === "password") passwordRef.current?.focus();
  }, [error]);

  const editar = (setter) => (texto) => {
    if (error) limpiarError();
    setter(texto);
  };

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-background"
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <StatusBar barStyle="dark-content" />

      {/* Cabecera minimalista: el login es la raíz del flujo, sin retorno. */}
      <ScreenHeader title="" />

      <ScrollView
        className="flex-1"
        contentContainerClassName="flex-grow px-5 pb-8"
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        {/* Bloque marca + saludo idéntico al diseño del arrendatario */}
        <View className="items-start gap-1.5 mb-2">
          <View className="w-11 h-11 rounded-2xl bg-[#0F3D3E] items-center justify-center shadow-sm">
            <Icon name="car" size={24} color="#2FBF9B" />
          </View>
          <Text
            className="text-[28px] font-bold text-textDark tracking-tight mt-2"
            style={{ letterSpacing: -0.5 }}
          >
            Hola de nuevo
          </Text>
          <Text className="text-[15px] leading-[22px] text-textMuted">
            Ingresa para gestionar tus vehículos y arriendos.
          </Text>
        </View>

        {/* Alerta de error inline limpia */}
        {error ? (
          <AlertaInline
            testID="aviso-login"
            titulo={error.titulo}
            mensaje={error.mensaje}
          />
        ) : null}

        {/* Formulario de credenciales con campos limpios y minimalistas */}
        <View className="gap-4 my-2">
          <OwnerField
            testID="input-email"
            label="Correo"
            iconLeft="mail"
            value={email}
            onChangeText={editar(setEmail)}
            editable={!loading}
            placeholder="nombre@correo.cl"
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            returnKeyType="next"
            blurOnSubmit={false}
            onSubmitEditing={() => passwordRef.current?.focus()}
          />

          <OwnerField
            testID="input-password"
            ref={passwordRef}
            label="Contraseña"
            iconLeft="lock"
            value={password}
            onChangeText={editar(setPassword)}
            editable={!loading}
            invalid={error?.campo === "password"}
            placeholder="••••••••••"
            secure
            revealIcon
            autoComplete="password"
            returnKeyType="go"
            onSubmitEditing={handleLogin}
          />

          <TouchableOpacity
            className="self-start py-1"
            onPress={() => onNavigate?.("forgot")}
            disabled={loading}
            activeOpacity={0.7}
            hitSlop={theme.control.hitSlop}
          >
            <Text
              className={`text-[14px] font-semibold text-accent-700 ${
                loading ? "opacity-50" : ""
              }`}
            >
              ¿Olvidaste tu contraseña?
            </Text>
          </TouchableOpacity>
        </View>

        {/* Espaciador flexible para empujar acciones abajo */}
        <View className="flex-grow min-h-[20px]" />

        {/* Botón principal de entrada simple y minimalista */}
        <TouchableOpacity
          testID="btn-login"
          loading={loading}
          onPress={handleLogin}
          disabled={loading}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel={loading ? "Ingresando..." : "Entrar"}
          accessibilityState={{ disabled: loading, busy: loading }}
          className={`h-[52px] rounded-2xl items-center justify-center flex-row gap-2.5 ${
            loading ? "opacity-90" : ""
          }`}
          style={{ backgroundColor: colors.primary700 || "#0F3D3E" }}
        >
          {loading ? (
            <>
              <ActivityIndicator color="#FFFFFF" size="small" />
              <Text className="text-[16px] font-bold text-white">Ingresando...</Text>
            </>
          ) : (
            <Text className="text-[16px] font-bold text-white">Entrar</Text>
          )}
        </TouchableOpacity>

        {/* Separador y proveedores OAuth */}
        <BotonesOAuth preferredMode="owner" compact disabled={loading} />

        {/* Enlace footer a registro */}
        <View className="flex-row items-center justify-center py-2">
          <Text className="text-[14px] text-textMuted">¿No tienes cuenta? </Text>
          <TouchableOpacity
            testID="btn-crear-cuenta"
            onPress={() => onNavigate?.("register")}
            disabled={loading}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text className="text-[14px] font-bold text-accent-700">Crear cuenta</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
