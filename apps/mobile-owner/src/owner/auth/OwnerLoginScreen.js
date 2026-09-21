import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { theme, useApp, BotonesOAuth, AlertaInline, useEnvioLogin } from "@rentacar/mobile-shared";
import { OwnerAuthHero } from "./OwnerAuthHero";
import { OwnerGradientButton } from "./OwnerGradientButton";
import { OwnerField } from "./OwnerField";

// LoginScreen exclusivo de la app de dueño usando NativeWind
export function OwnerLoginScreen({ onNavigate }) {
  const { login } = useApp();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const passwordRef = useRef(null);
  const { loading, error, enviar, limpiarError } = useEnvioLogin(login);

  const handleLogin = () => enviar(email, password);

  // Con las credenciales rechazadas el foco vuelve a la contraseña; lo escrito
  // se conserva para corregirlo sin volver a tipear el correo.
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
      <StatusBar barStyle="light-content" />

      <ScrollView
        className="flex-1"
        contentContainerClassName="flex-grow pb-6"
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <OwnerAuthHero variant="compact" />

        <View className="flex-grow px-5 pt-4 gap-4">
          <View className="items-center gap-1.5">
            <Text className="text-[22px] font-bold text-textDark text-center" style={{ letterSpacing: -0.5 }}>
              Bienvenido de nuevo
            </Text>
            <Text className="text-[13px] leading-[18px] text-textMuted text-center">
              Revisa tus autos y tus ganancias.
            </Text>
          </View>

          {error ? <AlertaInline testID="aviso-login" titulo={error.titulo} mensaje={error.mensaje} /> : null}

          <OwnerField
            testID="input-email"
            label="Correo"
            iconLeft="mail"
            placeholder="nombre@correo.cl"
            value={email}
            onChangeText={editar(setEmail)}
            editable={!loading}
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
            placeholder="••••••••••"
            value={password}
            onChangeText={editar(setPassword)}
            editable={!loading}
            invalid={error?.campo === "password"}
            secure
            revealIcon
            autoComplete="password"
            returnKeyType="go"
            onSubmitEditing={handleLogin}
          />

          <TouchableOpacity
            className="self-start py-1 active:opacity-70"
            onPress={() => onNavigate("forgot")}
            disabled={loading}
            activeOpacity={0.7}
            hitSlop={theme.control.hitSlop}
          >
            <Text className={`text-[13px] font-semibold text-accent-700 ${loading ? "opacity-50" : ""}`}>
              ¿Olvidaste tu contraseña?
            </Text>
          </TouchableOpacity>

          <View className="flex-grow min-h-[16px]" />

          <OwnerGradientButton testID="btn-login" label="Iniciar sesión" onPress={handleLogin} loading={loading} />

          <BotonesOAuth preferredMode="owner" compact redondeado disabled={loading} />

          <TouchableOpacity
            testID="btn-crear-cuenta"
            onPress={() => onNavigate("register")}
            disabled={loading}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Crear cuenta"
            accessibilityState={{ disabled: loading }}
            className={`h-[52px] rounded-full border-[1.5px] border-primary-700 bg-surface items-center justify-center ${
              loading ? "opacity-50" : ""
            }`}
          >
            <Text className="text-[15.5px] font-semibold text-primary-700">Crear cuenta</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
