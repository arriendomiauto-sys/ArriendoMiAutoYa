import React, { useEffect, useRef, useState } from "react";
import { View, Text, TouchableOpacity, ScrollView, StatusBar, KeyboardAvoidingView, Platform } from "react-native";
import { colors } from "../../theme/colors";
import { theme } from "../../theme/tokens";
import { useApp } from "../../context/AppContext";
import { BrandLogo } from "../../components/BrandLogo";
import { Button, Field, ScreenHeader } from "../../components/ui";
import { BotonesOAuth } from "../../components/BotonesOAuth";
import { AlertaInline } from "../../components/AlertaInline";
import { useEnvioLogin } from "../../hooks/useEnvioLogin";

// El login ya no tiene un selector de rol: AppContext determina quién es el
// usuario a partir de su token de sesión, sin importar en qué app inició.
//
// La cuenta se crea simple, así que un login exitoso no necesita revisar
// si el KYC está completo: el componente padre de la app deja de mostrar
// <AuthFlow /> apenas useApp().isLoggedIn lo refleje, sin importar el
// estado de verificación de identidad — eso se pide recién cuando el
// usuario intenta reservar o publicar un auto de verdad.
export function LoginScreen({ onNavigate }) {
  const { login } = useApp();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const passwordRef = useRef(null);
  // El hook también cubre el doble toque (la tecla "go" del teclado no se
  // deshabilita con `loading` como el botón), la validación y el timeout.
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
    // Un solo ScrollView con TODO adentro (sin barra inferior aparte): con
    // softwareKeyboardLayoutMode "pan" (app.json) Android ya desplaza la ventana
    // para dejar el campo enfocado a la vista; el KAV solo hace falta en iOS.
    // Tener una BottomBar fija + KAV encima duplicaba la compensación y
    // apretaba todo el contenido arriba del teclado.
    <KeyboardAvoidingView
      className="flex-1 bg-surface"
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <StatusBar barStyle="dark-content" />

      <ScreenHeader title="" />

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ flexGrow: 1, padding: 20, paddingBottom: 32, gap: 16 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        {/* Bloque marca + saludo */}
        <View className="items-start gap-2">
          <BrandLogo size={44} />
          <Text className="text-[28px] leading-[34px] font-bold text-gray-900 mt-1">Hola de nuevo</Text>
          <Text className="text-base text-gray-500">Ingresa para retomar tu próximo arriendo.</Text>
        </View>

        {error ? (
          <AlertaInline testID="aviso-login" titulo={error.titulo} mensaje={error.mensaje} />
        ) : null}

        {/* Bloque credenciales: el "Siguiente" del teclado salta al campo que sigue */}
        <View className="gap-4">
          <Field
            testID="input-email"
            label="Correo"
            iconLeft="mail"
            value={email}
            onChangeText={editar(setEmail)}
            editable={!loading}
            placeholder="nombre@correo.com"
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            returnKeyType="next"
            blurOnSubmit={false}
            onSubmitEditing={() => passwordRef.current?.focus()}
          />

          <Field
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
            onPress={() => onNavigate("forgot")}
            disabled={loading}
            activeOpacity={0.7}
            hitSlop={theme.control.hitSlop}
          >
            <Text className={`text-sm font-semibold text-accent-700 ${loading ? "opacity-50" : ""}`}>¿Olvidaste tu contraseña?</Text>
          </TouchableOpacity>
        </View>

        {/* Empuja las acciones hacia abajo cuando sobra alto; colapsa cuando no */}
        <View className="grow min-h-[20px]" />

        {/* Bloque acciones */}
        <Button testID="btn-login" label="Entrar" onPress={handleLogin} loading={loading} />

        <BotonesOAuth compact disabled={loading} />

        <Button
          testID="btn-crear-cuenta"
          variant="outline"
          label="Crear cuenta"
          onPress={() => onNavigate("register")}
          disabled={loading}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
