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
import { Button, Field, ScreenHeader } from "../components/ui";
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
  const identidadVerificada = currentUser?.estado_documentos === "verificado";

  const subirNuevaFoto = async () => {
    setSubiendoFoto(true);
    try {
      const res = await elegirYSubirImagen({
        origen: "camera",
        bucket: "documentos-kyc",
        filename: `perfil_${currentUser?.id || "user"}_${Date.now()}.jpg`,
        calidad: 0.9,
        maxAncho: 1200,
        motivoPermiso: "Por seguridad de la comunidad, necesitamos acceso a la cámara para tomar tu foto de perfil en vivo.",
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
      showAlert("Foto actualizada", "Tu foto de perfil quedó guardada.");
    } catch (err) {
      showAlert("No se pudo subir la foto", err.message || "Inténtalo de nuevo en unos segundos.");
    } finally {
      setSubiendoFoto(false);
    }
  };

  const handleFotoPress = () => {
    const opciones = [{ text: "Tomar foto con cámara", onPress: () => subirNuevaFoto() }];
    if (onOpenKyc) {
      opciones.push({
        text: tieneFotoVerificada ? "Renovar selfie de verificación" : "Verificar identidad",
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
        ? "Tu foto está validada con tu cédula. Puedes tomar una nueva con la cámara o renovar tu verificación."
        : "Por seguridad, tu foto de perfil se toma con la cámara en vivo o durante tu verificación de identidad.",
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
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <ScreenHeader tone={tone} title="Editar perfil" onBack={onBack} />
      {/* En Android el "pan" nativo sube el campo enfocado; el KAV es solo iOS. */}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom, 16) + 24 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Foto — una línea + botón, centrado */}
          <View style={styles.avatarSection}>
            <TouchableOpacity style={styles.avatarWrapper} onPress={handleFotoPress} activeOpacity={0.8}>
              {tieneFoto ? (
                <Image source={{ uri: fotoActual }} style={styles.avatar} onError={() => setImgError(true)} />
              ) : (
                <View style={[styles.avatar, styles.avatarEmpty]}>
                  <Icon name="user" size={34} color={colors.textMuted} />
                </View>
              )}
              <View style={[styles.badge, tieneFotoVerificada ? styles.badgeOk : styles.badgePending]}>
                <Icon
                  name={tieneFotoVerificada ? "check" : tieneFoto ? "camera" : "shield"}
                  size={12}
                  color={colors.white}
                />
              </View>
            </TouchableOpacity>

            <Text style={[styles.photoNote, tieneFotoVerificada && styles.photoNoteVerified]}>
              {subiendoFoto
                ? "Subiendo foto…"
                : tieneFotoVerificada
                  ? "Foto verificada con tu cédula"
                  : tieneFoto
                    ? "Tu foto de perfil"
                    : "Sin foto de perfil"}
            </Text>

            <TouchableOpacity
              style={styles.changePhoto}
              onPress={handleFotoPress}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Cambiar foto de perfil"
            >
              <Icon name="camera" size={13} color={colors.accent700} />
              <Text style={styles.changePhotoText}>{tieneFoto ? "Cambiar foto" : "Agregar foto"}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.group}>
            <Text style={styles.section}>Tus datos</Text>
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
              format={formatearTelefonoInput}
              maxLength={9}
              placeholder="7734 1208"
              prefix="+56 9"
              keyboardType="phone-pad"
              error={errorTelefono}
              helper="Lo usamos para coordinar entregas y avisarte de tus arriendos."
            />
          </View>

          <View style={styles.group}>
            <Text style={styles.section}>De tu verificación de identidad</Text>
            <View style={styles.idCard}>
              <View style={styles.idHead}>
                <Icon name="shield" size={14} color={colors.accent800} />
                <Text style={styles.idHeadText}>No editable aquí</Text>
              </View>
              <View style={styles.idRow}>
                <Text style={styles.idKey}>Correo</Text>
                <Text style={styles.idValue}>{currentUser?.email || "—"}</Text>
              </View>
              {currentUser?.rut ? (
                <View style={styles.idRow}>
                  <Text style={styles.idKey}>RUT</Text>
                  <Text style={styles.idValue}>{currentUser.rut}</Text>
                </View>
              ) : null}
              <TouchableOpacity
                style={[styles.idRow, styles.idRowTap]}
                onPress={onOpenKyc}
                disabled={!onOpenKyc}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="Verificación de identidad"
              >
                <View>
                  <Text style={styles.idKey}>Identidad</Text>
                  <View style={[styles.idBadge, identidadVerificada ? styles.idBadgeOk : styles.idBadgePending]}>
                    <Icon
                      name={identidadVerificada ? "check" : "clock"}
                      size={11}
                      color={identidadVerificada ? colors.accent800 : colors.warningText}
                    />
                    <Text style={[styles.idBadgeText, !identidadVerificada && { color: colors.warningText }]}>
                      {identidadVerificada ? "Verificada" : "Pendiente"}
                    </Text>
                  </View>
                </View>
                {onOpenKyc ? <Icon name="chevron-right" size={16} color={colors.textMuted} /> : null}
              </TouchableOpacity>
            </View>
            <Text style={styles.idCaption}>
              Estos datos salen de tu verificación de identidad. Para cambiarlos, vuelve a verificarte.
            </Text>
          </View>
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) + 8 }]}>
          <Button tone={tone} label="Guardar cambios" onPress={guardar} loading={guardando} />
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: theme.spacing.screen, gap: theme.spacing.xl },

  avatarSection: { alignItems: "center", gap: 9, paddingTop: 4 },
  avatarWrapper: { position: "relative" },
  avatar: { width: 84, height: 84, borderRadius: 42, backgroundColor: colors.surfaceSecondary },
  avatarEmpty: { alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border },
  badge: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 25,
    height: 25,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: colors.surface,
  },
  badgeOk: { backgroundColor: colors.accent500 },
  badgePending: { backgroundColor: colors.warning },
  photoNote: { fontSize: 12.5, color: colors.textMuted },
  photoNoteVerified: { color: colors.accent800, fontWeight: "600" },
  changePhoto: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: theme.radius.pill,
    paddingVertical: 6,
    paddingHorizontal: 13,
    backgroundColor: colors.surface,
  },
  changePhotoText: { fontSize: 12.5, fontWeight: "700", color: colors.accent700 },

  group: { gap: theme.spacing.md },
  section: { fontSize: 13, fontWeight: "700", color: colors.textMuted, marginBottom: 2 },

  idCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: theme.radius.field,
    backgroundColor: colors.surface,
    overflow: "hidden",
  },
  idHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingVertical: 10,
    paddingHorizontal: 13,
    backgroundColor: colors.accent100,
  },
  idHeadText: { fontSize: 12, fontWeight: "700", color: colors.accent800 },
  idRow: {
    paddingVertical: 10,
    paddingHorizontal: 13,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  idRowTap: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  idKey: { fontSize: 11, fontWeight: "700", letterSpacing: 0.3, color: colors.textMuted },
  idValue: { fontSize: 14, fontWeight: "500", color: colors.text, marginTop: 2 },
  idBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    alignSelf: "flex-start",
    borderRadius: theme.radius.pill,
    paddingVertical: 2,
    paddingHorizontal: 8,
    marginTop: 4,
  },
  idBadgeOk: { backgroundColor: colors.accent100 },
  idBadgePending: { backgroundColor: colors.warningBg },
  idBadgeText: { fontSize: 11.5, fontWeight: "700", color: colors.accent800 },
  idCaption: { fontSize: 11.5, color: colors.textMuted, lineHeight: 16, paddingHorizontal: 2 },

  footer: {
    paddingHorizontal: theme.spacing.screen,
    paddingTop: theme.spacing.md,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
});
