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
      <OwnerAuthHero variant="compact" />

      <ScrollView
        className="flex-1"
        contentContainerClassName="flex-grow px-4 pt-6 pb-8 gap-4"
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <Text className="text-2xl font-bold text-primary-700 text-center">Bienvenido de nuevo</Text>
        <Text className="text-sm text-textMuted text-center">Ingresa para revisar tus autos y tus ganancias.</Text>

        {error ? <AlertaInline testID="aviso-login" titulo={error.titulo} mensaje={error.mensaje} /> : null}

        <View className="gap-5 mt-4">
          <OwnerField
            testID="input-email"
            label="Correo"
            iconLeft="mail"
            placeholder="Correo electrónico"
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
            placeholder="Contraseña"
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
            <Text className={`text-[13.5px] font-semibold text-primary-700 ${loading ? "opacity-50" : ""}`}>
              ¿Olvidaste tu contraseña?
            </Text>
          </TouchableOpacity>
        </View>

        <View className="flex-grow min-h-[24px]" />

        <OwnerGradientButton testID="btn-login" label="Iniciar sesión" onPress={handleLogin} loading={loading} />

        <BotonesOAuth preferredMode="owner" compact disabled={loading} />

        <TouchableOpacity className="h-10 items-center justify-center active:opacity-70" onPress={() => onNavigate("register")} activeOpacity={0.7}>
          <Text className="text-[13.5px] text-textMuted">
            ¿No tienes cuenta? <Text className="text-primary-700 font-bold">Crear cuenta</Text>
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
