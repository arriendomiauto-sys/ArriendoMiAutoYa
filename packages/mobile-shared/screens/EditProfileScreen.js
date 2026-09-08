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
import { elegirYSubirImagen } from "../utils/imagenes";
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

  const [subiendoFoto, setSubiendoFoto] = useState(false);
  const [imgError, setImgError] = useState(false);

  const fotoActual = currentUser?.foto_perfil_verificada_url || currentUser?.foto_perfil_url;
  const tieneFotoVerificada = !!currentUser?.foto_perfil_verificada_url;
  const tieneFoto = !!fotoActual && !imgError;

  const subirNuevaFoto = async (origen) => {
    setSubiendoFoto(true);
    try {
      const res = await elegirYSubirImagen({
        origen,
        bucket: "general",
        filename: `perfil_${currentUser?.id || "user"}_${Date.now()}.jpg`,
        calidad: 0.8,
        maxAncho: 800,
        motivoPermiso:
          origen === "camera"
            ? "Necesitamos acceso a la cámara para tomar tu foto de perfil."
            : "Necesitamos acceso a tu galería para elegir tu foto de perfil.",
      });
      if (res.cancelado || !res.url) return;

      const perfil = await ApiClient.actualizarPerfilBasico({
        nombre: nombre.trim() || currentUser?.nombre || "",
        telefono: normalizarTelefonoCompleto(telefono || currentUser?.telefono || ""),
        foto_perfil_url: res.url,
      });
      if (perfil && perfil.id) setCurrentUser(perfil);
      else await syncProfile();
      setImgError(false);
      showAlert("Foto actualizada", "Tu foto de perfil quedó guardada exitosamente.");
    } catch (err) {
      showAlert("Error al subir foto", err.message || "No se pudo actualizar la foto de perfil.");
    } finally {
      setSubiendoFoto(false);
    }
  };

  const handleFotoPress = () => {
    const opciones = [
      {
        text: "Elegir de la galería",
        onPress: () => subirNuevaFoto("library"),
      },
      {
        text: "Tomar foto con cámara",
        onPress: () => subirNuevaFoto("camera"),
      },
    ];

    if (onOpenKyc) {
      opciones.push({
        text: tieneFotoVerificada ? "Renovar selfie KYC" : "Verificar identidad con selfie (KYC)",
        onPress: () => {
          (onDone || onBack)?.();
          onOpenKyc?.();
        },
      });
    }

    opciones.push({ text: "Cancelar", style: "cancel" });

    showAlert(
      "Foto de perfil",
      tieneFotoVerificada
        ? "Tu foto está validada mediante tu cédula. Puedes cambiar tu foto de perfil o renovar tu verificación KYC."
        : "Elige una foto para tu perfil o completa tu verificación KYC con selfie.",
      opciones
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
          {/* AVATAR KYC / PERFIL */}
          <View style={styles.avatarSection}>
            <TouchableOpacity
              style={styles.avatarWrapper}
              onPress={handleFotoPress}
              activeOpacity={0.8}
            >
              {tieneFoto ? (
                <Image
                  source={{ uri: fotoActual }}
                  style={styles.avatar}
                  onError={() => setImgError(true)}
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
                  name={tieneFotoVerificada ? "check" : tieneFoto ? "camera" : "shield"}
                  size={12}
                  color={colors.white}
                />
              </View>
            </TouchableOpacity>

            <TouchableOpacity onPress={handleFotoPress} style={styles.hintContainer}>
              <Text style={[styles.verifiedBadgeText, dark && { color: colors.mint }]}>
                {subiendoFoto
                  ? "Subiendo foto..."
                  : tieneFotoVerificada
                  ? "✓ Foto verificada con tu cédula"
                  : tieneFoto
                  ? "Foto de perfil (Toca para cambiar)"
                  : "Agregar foto de perfil"}
              </Text>
              <Text style={[styles.verifiedSubText, dark && { color: colors.textSilver }]}>
                {tieneFotoVerificada
                  ? "(Toca para cambiar foto o renovar KYC)"
                  : "(Toca para subir foto de galería o cámara)"}
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
