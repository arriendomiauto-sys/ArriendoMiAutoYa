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
import { colors } from "../../theme/colors";
import { useApp } from "../../context/AppContext";
import { Icon } from "../../components/Icon";
import { Button, Field, ScreenHeader, EmptyState } from "../../components/ui";
import { AlertaInline } from "../../components/AlertaInline";
import { useEnvioRecuperacion } from "../../hooks/useEnvioRecuperacion";

// Antes esto era un flujo de 4 pantallas totalmente simulado (código SMS
// falso que aceptaba cualquier dígito, "actualizar contraseña" con un
// setTimeout que no llamaba a nada) — terminaba mostrando "Contraseña
// Actualizada" sin haber cambiado la contraseña real en Supabase Auth. Un
// mensaje "coherente" no puede prometer algo que no pasó: esto envía el
// correo de recuperación real de Supabase (el que de verdad permite
// definir una nueva clave) y es honesto sobre que el resto pasa por correo.
//
// Comparte encabezado y estados con el login: un solo campo, el error a la
// vista en la pantalla (no en una ventana emergente) y, una vez enviado, una
// espera visible antes de poder reenviar. La confirmación dice "si tiene una
// cuenta": es la misma respuesta exista o no el correo, así la pantalla no
// sirve para averiguar qué correos están registrados.
export function ForgotPasswordScreen({ onNavigate }) {
  const { resetPassword } = useApp();
  const [email, setEmail] = useState("");
  const { loading, error, enviado, correo, puedeReenviar, etiquetaEspera, enviar, limpiarError } =
    useEnvioRecuperacion(resetPassword);

  const editar = (texto) => {
    if (error) limpiarError();
    setEmail(texto);
  };

  return (
    // En Android el "pan" nativo (app.json) desplaza la ventana al campo
    // enfocado; el KAV es solo para iOS. Detalle completo en LoginScreen.js.
    <KeyboardAvoidingView
      className="flex-1 bg-surface"
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <StatusBar barStyle="dark-content" />

      <ScreenHeader title="" onBack={() => onNavigate("login")} />

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ flexGrow: 1, padding: 20, paddingBottom: 32, gap: 16 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        {!enviado ? (
          <>
            <View className="items-start gap-2">
              <View className="w-11 h-11 rounded-[13px] bg-primary-700 items-center justify-center">
                <Icon name="key" size={24} color={colors.accent} />
              </View>
              <Text className="text-[28px] leading-[34px] font-bold text-gray-900 mt-1">Recupera tu acceso</Text>
              <Text className="text-base text-gray-500">
                Escribe tu correo y te enviamos un enlace para crear una contraseña nueva.
              </Text>
            </View>

            {error ? <AlertaInline testID="aviso-recuperar" titulo={error.titulo} mensaje={error.mensaje} /> : null}

            <Field
              testID="input-email"
              label="Correo"
              iconLeft="mail"
              value={email}
              onChangeText={editar}
              editable={!loading}
              placeholder="nombre@correo.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              returnKeyType="go"
              onSubmitEditing={() => enviar(email)}
            />

            <View className="grow min-h-[20px]" />

            <Button testID="btn-enviar-enlace" label="Enviar enlace" onPress={() => enviar(email)} loading={loading} />

            <TouchableOpacity className="h-10 items-center justify-center" onPress={() => onNavigate("login")} activeOpacity={0.7}>
              <Text className="text-sm text-gray-500">
                ¿Ya la recordaste? <Text className="text-accent-700 font-semibold">Volver a entrar</Text>
              </Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <View className="grow justify-center">
              <EmptyState
                icon="mail"
                title="Revisa tu correo"
                message={`Si ${correo} tiene una cuenta, te llegará un enlace. Puede tardar un par de minutos; mira también en spam.`}
              />
            </View>

            {error ? <AlertaInline testID="aviso-recuperar" titulo={error.titulo} mensaje={error.mensaje} /> : null}

            <Button label="Volver a entrar" onPress={() => onNavigate("login")} />
            <Button
              testID="btn-reenviar-enlace"
              variant="ghost"
              label={puedeReenviar ? "Reenviar enlace" : `Reenviar enlace en ${etiquetaEspera}`}
              onPress={() => enviar(correo)}
              disabled={!puedeReenviar}
              loading={loading}
            />
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
