import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  StatusBar,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { colors } from "../../theme/colors";
import { theme } from "../../theme/tokens";
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
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <StatusBar barStyle="dark-content" />

      <ScreenHeader title="" onBack={() => onNavigate("login")} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        {!enviado ? (
          <>
            <View style={styles.hero}>
              <View style={styles.marca}>
                <Icon name="key" size={24} color={colors.accent} />
              </View>
              <Text style={styles.title}>Recupera tu acceso</Text>
              <Text style={styles.subtitle}>
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

            <View style={styles.spacer} />

            <Button testID="btn-enviar-enlace" label="Enviar enlace" onPress={() => enviar(email)} loading={loading} />

            <TouchableOpacity style={styles.volverLink} onPress={() => onNavigate("login")} activeOpacity={0.7}>
              <Text style={styles.volverLinkText}>
                ¿Ya la recordaste? <Text style={styles.volverLinkHighlight}>Volver a entrar</Text>
              </Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <View style={styles.confirmacion}>
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
  marca: {
    width: 44,
    height: 44,
    borderRadius: 13,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
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
  spacer: {
    flexGrow: 1,
    minHeight: theme.spacing.xl,
  },
  confirmacion: {
    flexGrow: 1,
    justifyContent: "center",
  },
  volverLink: {
    height: theme.control.heightSm,
    alignItems: "center",
    justifyContent: "center",
  },
  volverLinkText: {
    ...theme.typography.callout,
    color: colors.textMuted,
  },
  volverLinkHighlight: {
    color: colors.accent700,
    fontWeight: "600",
  },
});
