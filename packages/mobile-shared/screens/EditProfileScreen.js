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
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
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

export function EditProfileScreen({ onBack, onDone, tone = "light" }) {
  const insets = useSafeAreaInsets();
  const dark = tone === "dark";
  const { currentUser, setCurrentUser, syncProfile } = useApp();

  const [nombre, setNombre] = useState(currentUser?.nombre || "");
  const [telefono, setTelefono] = useState(extraerMovilSinPrefijo(currentUser?.telefono));
  const [fotoUrl, setFotoUrl] = useState(currentUser?.foto_perfil_verificada_url || null);
  const [subiendoFoto, setSubiendoFoto] = useState(false);
  const [intentado, setIntentado] = useState(false);
  const [guardando, setGuardando] = useState(false);

  const errorNombre = intentado && !nombre.trim() ? "Ingresa tu nombre." : undefined;
  const errorTelefono =
    intentado && soloDigitos(telefono).length < 8 ? "Ingresa un móvil de 8 dígitos." : undefined;

  const cambiarFoto = async () => {
    try {
      const permiso = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permiso.granted) {
        showAlert("Permiso requerido", "Necesitamos acceso a tus fotos para cambiar tu avatar.");
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (result.canceled || !result.assets?.[0]?.uri) return;

      setSubiendoFoto(true);
      const uri = result.assets[0].uri;
      const subida = await ApiClient.subirArchivoStorage(
        uri,
        `avatar_${currentUser?.id || "user"}_${Date.now()}.jpg`,
        "general"
      );

      const urlFinal = subida?.url || uri;
      setFotoUrl(urlFinal);
      
      // Actualizar de inmediato en el perfil
      const perfilActualizado = await ApiClient.actualizarPerfilBasico({
        nombre: (nombre || currentUser?.nombre || "Usuario").trim(),
        telefono: normalizarTelefonoCompleto(telefono || currentUser?.telefono || ""),
        foto_perfil_verificada_url: urlFinal,
      });

      if (perfilActualizado && perfilActualizado.id) {
        setCurrentUser(perfilActualizado);
      }
      await syncProfile();
      showAlert("Foto actualizada", "Tu foto de perfil ha sido actualizada.");
    } catch (err) {
      showAlert("Error al subir foto", err.message || "No se pudo subir la foto.");
    } finally {
      setSubiendoFoto(false);
    }
  };

  const guardar = async () => {
    setIntentado(true);
    if (!nombre.trim() || soloDigitos(telefono).length < 8) return;

    setGuardando(true);
    try {
      const perfil = await ApiClient.actualizarPerfilBasico({
        nombre: nombre.trim(),
        telefono: normalizarTelefonoCompleto(telefono),
        foto_perfil_verificada_url: fotoUrl || currentUser?.foto_perfil_verificada_url || undefined,
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
          {/* AVATAR SELECTOR */}
          <View style={styles.avatarSection}>
            <TouchableOpacity
              style={styles.avatarWrapper}
              onPress={cambiarFoto}
              activeOpacity={0.8}
              disabled={subiendoFoto}
            >
              {subiendoFoto ? (
                <View style={[styles.avatar, styles.avatarLoading]}>
                  <ActivityIndicator color={colors.primary} size="small" />
                </View>
              ) : fotoUrl ? (
                <Image source={{ uri: fotoUrl }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, styles.avatarEmpty]}>
                  <Icon name="user" size={32} color={colors.textMuted} />
                </View>
              )}
              <View style={styles.cameraBadge}>
                <Icon name="camera" size={14} color={colors.white} />
              </View>
            </TouchableOpacity>
            <TouchableOpacity onPress={cambiarFoto} disabled={subiendoFoto}>
              <Text style={[styles.changePhotoText, dark && { color: colors.mint }]}>
                {subiendoFoto ? "Subiendo foto..." : "Cambiar foto de perfil"}
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
  avatarSection: { alignItems: "center", justifyContent: "center", marginVertical: 8, gap: 8 },
  avatarWrapper: { position: "relative" },
  avatar: { width: 84, height: 84, borderRadius: 42, backgroundColor: colors.surfaceMuted },
  avatarEmpty: { alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border },
  avatarLoading: { alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.primary },
  cameraBadge: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: colors.surface,
  },
  changePhotoText: { fontSize: 13, fontWeight: "600", color: colors.primary },
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
