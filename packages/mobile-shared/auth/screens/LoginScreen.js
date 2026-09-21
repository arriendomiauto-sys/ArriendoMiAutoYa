import React, { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, StatusBar, KeyboardAvoidingView, Platform } from "react-native";
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
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <StatusBar barStyle="dark-content" />

      <ScreenHeader title="" />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        {/* Bloque marca + saludo */}
        <View style={styles.hero}>
          <BrandLogo size={44} />
          <Text style={styles.title}>Hola de nuevo</Text>
          <Text style={styles.subtitle}>Ingresa para retomar tu próximo arriendo.</Text>
        </View>

        {error ? (
          <AlertaInline testID="aviso-login" titulo={error.titulo} mensaje={error.mensaje} />
        ) : null}

        {/* Bloque credenciales: el "Siguiente" del teclado salta al campo que sigue */}
        <View style={styles.form}>
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
            style={styles.forgotLink}
            onPress={() => onNavigate("forgot")}
            disabled={loading}
            activeOpacity={0.7}
            hitSlop={theme.control.hitSlop}
          >
            <Text style={[styles.forgotLinkText, loading && styles.bloqueado]}>¿Olvidaste tu contraseña?</Text>
          </TouchableOpacity>
        </View>

        {/* Empuja las acciones hacia abajo cuando sobra alto; colapsa cuando no */}
        <View style={styles.spacer} />

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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    padding: theme.spacing.screen,
    paddingBottom: 32,
    gap: theme.spacing.lg,
  },
  hero: {
    alignItems: "flex-start",
    gap: theme.spacing.sm,
  },
  title: {
    ...theme.typography.display,
    color: colors.text,
    marginTop: theme.spacing.xs,
  },
  subtitle: {
    ...theme.typography.body,
    color: colors.textMuted,
  },
  form: {
    gap: theme.spacing.lg,
  },
  spacer: {
    flexGrow: 1,
    minHeight: theme.spacing.xl,
  },
  forgotLink: {
    alignSelf: "flex-start",
    paddingVertical: theme.spacing.xs,
  },
  forgotLinkText: {
    ...theme.typography.bodyStrong,
    color: colors.accent700,
  },
  bloqueado: {
    opacity: 0.5,
  },
});
