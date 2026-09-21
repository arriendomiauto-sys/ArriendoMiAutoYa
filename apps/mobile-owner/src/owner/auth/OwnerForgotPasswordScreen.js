import React, { useState } from "react";
import { View, Text, ScrollView, StatusBar, KeyboardAvoidingView, Platform } from "react-native";
import { useApp, EmptyState, showAlert, traducirErrorAuth } from "@rentacar/mobile-shared";
import { OwnerAuthHero } from "./OwnerAuthHero";
import { OwnerGradientButton } from "./OwnerGradientButton";
import { OwnerField } from "./OwnerField";

// ForgotPasswordScreen de la app de dueño usando NativeWind
export function OwnerForgotPasswordScreen({ onNavigate }) {
  const { resetPassword } = useApp();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [enviado, setEnviado] = useState(false);

  const handleEnviar = async () => {
    if (loading) return;
    if (!email.trim()) {
      showAlert("Campo requerido", "Ingresa el correo con el que te registraste.");
      return;
    }
    setLoading(true);
    try {
      await resetPassword(email.trim());
      setEnviado(true);
    } catch (err) {
      showAlert("No se pudo enviar el correo", traducirErrorAuth(err));
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
      <OwnerAuthHero variant="compact" title="Recuperar clave" onBack={() => onNavigate("login")} />

      <ScrollView
        className="flex-1"
        contentContainerClassName="flex-grow px-4 pt-6 pb-8 gap-5"
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {!enviado ? (
          <>
            <Text className="text-xl font-bold text-primary-700 text-center">Ingresa tu correo</Text>
            <Text className="text-sm text-textMuted text-center">Te enviaremos un enlace para definir una nueva contraseña.</Text>

            <View className="gap-5">
              <OwnerField
                placeholder="Correo electrónico"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                returnKeyType="go"
                onSubmitEditing={handleEnviar}
              />
            </View>

            <OwnerGradientButton label="Enviar enlace de recuperación" onPress={handleEnviar} loading={loading} />
          </>
        ) : (
          <>
            <EmptyState
              icon="chat"
              title="Revisa tu correo"
              message={`Si ${email.trim()} está registrado, te enviamos un enlace para definir una nueva contraseña. Puede tardar unos minutos — revisa también spam.`}
            />
            <OwnerGradientButton label="Ir al inicio de sesión" onPress={() => onNavigate("login")} />
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
