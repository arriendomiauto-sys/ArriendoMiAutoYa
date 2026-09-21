import React, { useState } from "react";
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
  useApp,
  EmptyState,
  AlertaInline,
  useEnvioRecuperacion,
} from "@rentacar/mobile-shared";
import { OwnerAuthHero } from "./OwnerAuthHero";
import { OwnerGradientButton } from "./OwnerGradientButton";
import { OwnerField } from "./OwnerField";

// ForgotPasswordScreen de la app de dueño usando NativeWind. Misma lógica y
// mismos estados que la del arrendatario (hook compartido): error a la vista
// en la pantalla y espera visible antes de poder reenviar. La confirmación
// dice "si tiene una cuenta" porque es la misma respuesta exista o no el
// correo.
export function OwnerForgotPasswordScreen({ onNavigate }) {
  const { resetPassword } = useApp();
  const [email, setEmail] = useState("");
  const { loading, error, enviado, correo, puedeReenviar, etiquetaEspera, enviar, limpiarError } =
    useEnvioRecuperacion(resetPassword);

  const editar = (texto) => {
    if (error) limpiarError();
    setEmail(texto);
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
            <Text className="text-xl font-bold text-primary-700 text-center">Recupera tu acceso</Text>
            <Text className="text-sm text-textMuted text-center">
              Escribe tu correo y te enviamos un enlace para crear una contraseña nueva.
            </Text>

            {error ? <AlertaInline testID="aviso-recuperar" titulo={error.titulo} mensaje={error.mensaje} /> : null}

            <OwnerField
              testID="input-email"
              label="Correo"
              iconLeft="mail"
              placeholder="Correo electrónico"
              value={email}
              onChangeText={editar}
              editable={!loading}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              returnKeyType="go"
              onSubmitEditing={() => enviar(email)}
            />

            <View className="flex-grow min-h-[24px]" />

            <OwnerGradientButton
              testID="btn-enviar-enlace"
              label="Enviar enlace"
              onPress={() => enviar(email)}
              loading={loading}
            />

            <TouchableOpacity
              className="h-10 items-center justify-center active:opacity-70"
              onPress={() => onNavigate("login")}
              activeOpacity={0.7}
            >
              <Text className="text-[13.5px] text-textMuted">
                ¿Ya la recordaste? <Text className="text-primary-700 font-bold">Volver a entrar</Text>
              </Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <EmptyState
              icon="mail"
              title="Revisa tu correo"
              message={`Si ${correo} tiene una cuenta, te llegará un enlace. Puede tardar un par de minutos; mira también en spam.`}
            />

            {error ? <AlertaInline testID="aviso-recuperar" titulo={error.titulo} mensaje={error.mensaje} /> : null}

            <OwnerGradientButton label="Volver a entrar" onPress={() => onNavigate("login")} />

            <TouchableOpacity
              testID="btn-reenviar-enlace"
              className={`h-10 items-center justify-center active:opacity-70 ${puedeReenviar ? "" : "opacity-50"}`}
              onPress={() => enviar(correo)}
              disabled={!puedeReenviar || loading}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityState={{ disabled: !puedeReenviar || loading, busy: loading }}
            >
              <Text className="text-[13.5px] font-semibold text-primary-700">
                {puedeReenviar ? "Reenviar enlace" : `Reenviar enlace en ${etiquetaEspera}`}
              </Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
