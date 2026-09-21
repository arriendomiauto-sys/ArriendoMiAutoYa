import React, { useRef, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { theme, useApp, BotonesOAuth, showAlert, traducirErrorAuth } from "@rentacar/mobile-shared";
import { OwnerAuthHero } from "./OwnerAuthHero";
import { OwnerGradientButton } from "./OwnerGradientButton";
import { OwnerField } from "./OwnerField";

// LoginScreen exclusivo de la app de dueño usando NativeWind
export function OwnerLoginScreen({ onNavigate }) {
  const { login } = useApp();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const passwordRef = useRef(null);

  const handleLogin = async () => {
    if (loading) return;
    if (!email.trim() || !password.trim()) {
      showAlert("Campos requeridos", "Ingresa tu correo y tu contraseña.");
      return;
    }
    setLoading(true);
    try {
      await login(email.trim(), password);
    } catch (err) {
      showAlert("No se pudo iniciar sesión", traducirErrorAuth(err));
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
      <OwnerAuthHero variant="compact" onBack={() => onNavigate("welcome")} />

      <ScrollView
        className="flex-1"
        contentContainerClassName="flex-grow px-4 pt-6 pb-8 gap-4"
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <Text className="text-2xl font-bold text-primary-700 text-center">Bienvenido de nuevo</Text>
        <Text className="text-sm text-textMuted text-center">Ingresa para revisar tus autos y tus ganancias.</Text>

        <View className="gap-5 mt-4">
          <OwnerField
            testID="input-email"
            label="Correo"
            iconLeft="mail"
            placeholder="Correo electrónico"
            value={email}
            onChangeText={setEmail}
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
            onChangeText={setPassword}
            secure
            revealIcon
            autoComplete="password"
            returnKeyType="go"
            onSubmitEditing={handleLogin}
          />

          <TouchableOpacity
            className="self-start py-1 active:opacity-70"
            onPress={() => onNavigate("forgot")}
            activeOpacity={0.7}
            hitSlop={theme.control.hitSlop}
          >
            <Text className="text-[13.5px] font-semibold text-primary-700">¿Olvidaste tu contraseña?</Text>
          </TouchableOpacity>
        </View>

        <View className="flex-grow min-h-[24px]" />

        <OwnerGradientButton testID="btn-login" label="Iniciar sesión" onPress={handleLogin} loading={loading} />

        <BotonesOAuth preferredMode="owner" compact />

        <TouchableOpacity className="h-10 items-center justify-center active:opacity-70" onPress={() => onNavigate("register")} activeOpacity={0.7}>
          <Text className="text-[13.5px] text-textMuted">
            ¿No tienes cuenta? <Text className="text-primary-700 font-bold">Crear cuenta</Text>
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
