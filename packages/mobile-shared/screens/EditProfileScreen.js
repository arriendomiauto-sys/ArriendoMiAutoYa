import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Image,
  TouchableOpacity,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "../theme/colors";
import { theme } from "../theme/tokens";
import { Button, Field, ScreenHeader, SectionLabel } from "../components/ui";
import { Icon } from "../components/Icon";
import { ApiClient } from "../api/client";
import { useApp } from "../context/AppContext";
import { showAlert } from "../utils/alert";
import {
  formatearTelefonoInput,
  normalizarTelefonoCompleto,
  extraerMovilSinPrefijo,
} from "../utils/formato";

const soloDigitos = (s) => (s || "").replace(/\D/g, "");

export function EditProfileScreen({ onBack, onDone, onOpenKyc, tone = "light" }) {
  const insets = useSafeAreaInsets();
  const dark = tone === "dark";
  const { currentUser, setCurrentUser, syncProfile } = useApp();

  const [nombre, setNombre] = useState(currentUser?.nombre || "");
  const [telefono, setTelefono] = useState(extraerMovilSinPrefijo(currentUser?.telefono));
  const [intentado, setIntentado] = useState(false);
  const [guardando, setGuardando] = useState(false);

  const errorNombre = intentado && !nombre.trim() ? "Ingresa tu nombre." : undefined;
  const errorTelefono =
    intentado && soloDigitos(telefono).length < 8 ? "Ingresa un móvil de 8 dígitos." : undefined;

  const handleFotoPress = () => {
    showAlert(
      "Foto de verificación de identidad",
      "Por seguridad en el traspaso del auto, tu foto de perfil proviene de tu selfie biométrica validada con tu cédula de identidad.\n\nPara actualizarla, debes realizar una nueva toma de verificación.",
      [
        {
          text: "Actualizar selfie",
          onPress: () => {
            (onDone || onBack)?.();
            onOpenKyc?.();
          },
        },
        { text: "Entendido", style: "cancel" },
      ]
    );
  };

  const guardar = async () => {
    setIntentado(true);
    if (!nombre.trim() || soloDigitos(telefono).length < 8) return;

    setGuardando(true);
    try {
      const perfil = await ApiClient.actualizarPerfilBasico({
        nombre: nombre.trim(),
        telefono: normalizarTelefonoCompleto(telefono),
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

  const tieneFotoVerificada = !!currentUser?.foto_perfil_verificada_url;

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
          {/* AVATAR KYC (FOTO DE IDENTIDAD VERIFICADA) */}
          <View style={styles.avatarSection}>
            <TouchableOpacity
              style={styles.avatarWrapper}
              onPress={handleFotoPress}
              activeOpacity={0.8}
            >
              {tieneFotoVerificada ? (
                <Image
                  source={{ uri: currentUser.foto_perfil_verificada_url }}
                  style={styles.avatar}
                />
              ) : (
                <View style={[styles.avatar, styles.avatarEmpty]}>
                  <Icon name="user" size={34} color={colors.textMuted} />
                </View>
              )}
              <View
                style={[
                  styles.shieldBadge,
                  tieneFotoVerificada ? styles.badgeVerified : styles.badgePending,
                ]}
              >
                <Icon
                  name={tieneFotoVerificada ? "check" : "shield"}
                  size={12}
                  color={colors.white}
                />
              </View>
            </TouchableOpacity>

            <TouchableOpacity onPress={handleFotoPress} style={styles.hintContainer}>
              <Text style={[styles.verifiedBadgeText, dark && { color: colors.mint }]}>
                {tieneFotoVerificada
                  ? "✓ Foto verificada con tu cédula"
                  : "Foto de identidad pendiente"}
              </Text>
              <Text style={[styles.verifiedSubText, dark && { color: colors.textSilver }]}>
                (Toca para renovar mediante selfie biométrica)
              </Text>
            </TouchableOpacity>
          </View>

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
            onChangeText={(t) => setTelefono(formatearTelefonoInput(t))}
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
              El correo y los datos de identidad (RUT, dirección y foto biométrica) se validan mediante Verificación de identidad.
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
  avatarSection: { alignItems: "center", justifyContent: "center", marginVertical: 8, gap: 6 },
  avatarWrapper: { position: "relative" },
  avatar: { width: 88, height: 88, borderRadius: 44, backgroundColor: colors.surfaceMuted },
  avatarEmpty: { alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border },
  shieldBadge: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: colors.surface,
  },
  badgeVerified: { backgroundColor: colors.success },
  badgePending: { backgroundColor: colors.warning },
  hintContainer: { alignItems: "center", gap: 2 },
  verifiedBadgeText: { fontSize: 13, fontWeight: "700", color: colors.primary },
  verifiedSubText: { fontSize: 11, color: colors.textMuted },
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
