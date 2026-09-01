import React, { useState } from "react";
import { View, Text, StyleSheet, ScrollView, StatusBar } from "react-native";
import { colors } from "../../theme/colors";
import { theme } from "../../theme/tokens";
import { useApp } from "../../context/AppContext";
import { Button, Card, Field, ScreenHeader, EmptyState } from "../../components/ui";
import { showAlert } from "../../utils/alert";
import { traducirErrorAuth } from "../../utils/authErrors";

// Antes esto era un flujo de 4 pantallas totalmente simulado (código SMS
// falso que aceptaba cualquier dígito, "actualizar contraseña" con un
// setTimeout que no llamaba a nada) — terminaba mostrando "Contraseña
// Actualizada" sin haber cambiado la contraseña real en Supabase Auth. Un
// mensaje "coherente" no puede prometer algo que no pasó: esto envía el
// correo de recuperación real de Supabase (el que de verdad permite
// definir una nueva clave) y es honesto sobre que el resto pasa por correo.
//
// La pantalla venía además con fondo oscuro mientras login/registro son
// claros: se veía como si perteneciera a otra app. Ahora usa la misma
// superficie crema y las mismas primitivas que el resto del flujo.
export function ForgotPasswordScreen({ onNavigate }) {
  const { resetPassword } = useApp();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [enviado, setEnviado] = useState(false);

  const handleEnviar = async () => {
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
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />

      <ScreenHeader
        title="Recuperar clave"
        subtitle="Restablece el acceso a tu cuenta"
        onBack={() => onNavigate("login")}
      />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {!enviado ? (
          <Card style={styles.card}>
            <View style={styles.cardIntro}>
              <Text style={styles.cardTitle}>Ingresa tu correo</Text>
              <Text style={styles.cardDesc}>
                Te enviaremos un enlace para definir una nueva contraseña.
              </Text>
            </View>

            <Field
              label="Correo registrado"
              value={email}
              onChangeText={setEmail}
              placeholder="nombre@correo.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
            />

            <Button
              label="Enviar enlace de recuperación"
              onPress={handleEnviar}
              loading={loading}
              iconRight="arrow-right"
            />
          </Card>
        ) : (
          <Card style={styles.card}>
            <EmptyState
              icon="chat"
              title="Revisa tu correo"
              message={`Si ${email.trim()} está registrado, te enviamos un enlace para definir una nueva contraseña. Puede tardar unos minutos — revisa también spam.`}
            />
            <Button label="Ir al inicio de sesión" onPress={() => onNavigate("login")} />
          </Card>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: theme.spacing.screen,
  },
  card: {
    gap: theme.spacing.lg,
  },
  cardIntro: {
    gap: theme.spacing.xs,
  },
  cardTitle: {
    ...theme.typography.heading,
    color: colors.text,
  },
  cardDesc: {
    ...theme.typography.body,
    color: colors.textMuted,
  },
});
