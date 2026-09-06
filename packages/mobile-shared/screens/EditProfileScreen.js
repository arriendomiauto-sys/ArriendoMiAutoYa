import React, { useState } from "react";
import { View, Text, StyleSheet, StatusBar, ScrollView, KeyboardAvoidingView, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "../theme/colors";
import { theme } from "../theme/tokens";
import { Button, Field, ScreenHeader, SectionLabel } from "../components/ui";
import { ApiClient } from "../api/client";
import { useApp } from "../context/AppContext";
import { showAlert } from "../utils/alert";

/**
 * Editar los datos de contacto de la cuenta (nombre y teléfono) después del
 * registro. RegisterScreen los guarda con `actualizarPerfilBasico` y deja
 * dicho en un comentario que "el usuario puede completarlos después desde el
 * perfil" — esta es esa pantalla, que antes no existía.
 *
 * NO toca RUT / documento / dirección: esos son datos de identidad y los
 * maneja KycScreen (cambiarlos exige re-verificación).
 */

// El teléfono se guarda como "+56 9 XXXX XXXX". Acá se muestra sin el prefijo
// (el Field ya lo pinta fijo) y se vuelve a anteponer al guardar.
const quitarPrefijoCL = (tel) => (tel || "").replace(/^\s*\+?56\s*9?\s*/, "").trim();
const soloDigitos = (s) => (s || "").replace(/\D/g, "");

export function EditProfileScreen({ onBack, onDone, tone = "light" }) {
  const insets = useSafeAreaInsets();
  const dark = tone === "dark";
  const { currentUser, setCurrentUser, syncProfile } = useApp();

  const [nombre, setNombre] = useState(currentUser?.nombre || "");
  const [telefono, setTelefono] = useState(quitarPrefijoCL(currentUser?.telefono));
  const [intentado, setIntentado] = useState(false);
  const [guardando, setGuardando] = useState(false);

  const errorNombre = intentado && !nombre.trim() ? "Ingresa tu nombre." : undefined;
  const errorTelefono =
    intentado && soloDigitos(telefono).length < 8 ? "Ingresa un móvil de 8 dígitos." : undefined;

  const guardar = async () => {
    setIntentado(true);
    if (!nombre.trim() || soloDigitos(telefono).length < 8) return;

    setGuardando(true);
    try {
      const perfil = await ApiClient.actualizarPerfilBasico({
        nombre: nombre.trim(),
        telefono: `+56 9 ${telefono.trim()}`,
      });
      if (perfil && perfil.id) setCurrentUser(perfil);
      else await syncProfile();
      showAlert("Perfil actualizado", "Tus datos quedaron guardados.", [
        { text: "Listo", onPress: () => (onDone || onBack)?.() },
      ]);
    } catch (err) {
      showAlert("No se pudo guardar", err.message || "Inténtalo de nuevo en unos segundos.");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <View style={[styles.container, dark && { backgroundColor: colors.darkBg }]}>
      <StatusBar barStyle={dark ? "light-content" : "dark-content"} />
      <ScreenHeader tone={tone} title="Editar perfil" onBack={onBack} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom, 16) + 24 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Field
            tone={tone}
            label="Nombre completo"
            value={nombre}
            onChangeText={setNombre}
            placeholder="Ej. Rodrigo Muñoz"
            autoCapitalize="words"
            error={errorNombre}
          />

          <Field
            tone={tone}
            label="Teléfono"
            value={telefono}
            onChangeText={setTelefono}
            placeholder="7734 1208"
            prefix="+56 9"
            keyboardType="phone-pad"
            error={errorTelefono}
            helper="Lo usamos para coordinar entregas y avisarte de tus arriendos."
          />

          <View style={styles.readonly}>
            <SectionLabel tone={tone}>Correo</SectionLabel>
            <Text style={[styles.readonlyValue, dark && { color: colors.textWhite }]}>
              {currentUser?.email || "—"}
            </Text>
            <Text style={[styles.readonlyHint, dark && { color: colors.textSilver }]}>
              El correo y los datos de identidad (RUT, dirección) se cambian desde Verificación de
              identidad.
            </Text>
          </View>
        </ScrollView>

        <View
          style={[
            styles.footer,
            dark && { backgroundColor: colors.darkCard, borderTopColor: colors.darkBorder },
            { paddingBottom: Math.max(insets.bottom, 12) + 8 },
          ]}
        >
          <Button tone={tone} label="Guardar cambios" onPress={guardar} loading={guardando} />
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: theme.spacing.screen, gap: theme.spacing.lg },
  readonly: { gap: 6 },
  readonlyValue: { fontSize: 15, color: colors.text, fontWeight: "500" },
  readonlyHint: { fontSize: 12, color: colors.textMuted, lineHeight: 17 },
  footer: {
    paddingHorizontal: theme.spacing.screen,
    paddingTop: theme.spacing.md,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
});
