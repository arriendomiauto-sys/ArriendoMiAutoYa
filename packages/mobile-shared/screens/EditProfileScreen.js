import React, { useState } from "react";
import {
  View,
  Text,
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
import { msjError } from "../utils/msjError";
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
      showAlert("No se pudo subir la foto", msjError(err, "Inténtalo de nuevo en unos segundos."));
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
      showAlert("No se pudo guardar", msjError(err, "Inténtalo de nuevo en unos segundos."));
    } finally {
      setGuardando(false);
    }
  };

  return (
    <View className="flex-1 bg-background">
      <StatusBar barStyle="dark-content" />
      <ScreenHeader tone={tone} title="Editar perfil" onBack={onBack} />
      {/* En Android el "pan" nativo sube el campo enfocado; el KAV es solo iOS. */}
      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView
          contentContainerStyle={{ padding: 16, gap: 24, paddingBottom: Math.max(insets.bottom, 16) + 24 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Foto — una línea + botón, centrado */}
          <View className="items-center gap-2 pt-1">
            <TouchableOpacity className="relative" onPress={handleFotoPress} activeOpacity={0.8}>
              {tieneFoto ? (
                <Image source={{ uri: fotoActual }} className="w-[84px] h-[84px] rounded-full bg-surfaceSecondary" onError={() => setImgError(true)} />
              ) : (
                <View className="w-[84px] h-[84px] rounded-full bg-surfaceSecondary items-center justify-center border border-border">
                  <Icon name="user" size={34} color={colors.textMuted} />
                </View>
              )}
              <View className={`absolute bottom-0 right-0 w-[25px] h-[25px] rounded-full items-center justify-center border-2 border-surface ${tieneFotoVerificada ? "bg-accent-500" : "bg-amber-500"}`}>
                <Icon
                  name={tieneFotoVerificada ? "check" : tieneFoto ? "camera" : "shield"}
                  size={12}
                  color={colors.white}
                />
              </View>
            </TouchableOpacity>

            <Text className={`text-[12.5px] ${tieneFotoVerificada ? "text-accent-800 font-semibold" : "text-textMuted"}`}>
              {subiendoFoto
                ? "Subiendo foto…"
                : tieneFotoVerificada
                  ? "Foto verificada con tu cédula"
                  : tieneFoto
                    ? "Tu foto de perfil"
                    : "Sin foto de perfil"}
            </Text>

            <TouchableOpacity
              className="flex-row items-center gap-1.5 border border-border rounded-full py-1.5 px-3.5 bg-surface"
              onPress={handleFotoPress}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Cambiar foto de perfil"
            >
              <Icon name="camera" size={13} color={colors.accent700} />
              <Text className="text-[12.5px] font-bold text-accent-700">{tieneFoto ? "Cambiar foto" : "Agregar foto"}</Text>
            </TouchableOpacity>
          </View>

          <View className="gap-3">
            <Text className="text-[13px] font-bold text-textMuted mb-0.5">Tus datos</Text>
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

          <View className="gap-3">
            <Text className="text-[13px] font-bold text-textMuted mb-0.5">De tu verificación de identidad</Text>
            <View className="border border-border rounded-xl bg-surface overflow-hidden">
              <View className="flex-row items-center gap-1.5 py-2.5 px-3 bg-accent-100">
                <Icon name="shield" size={14} color={colors.accent800} />
                <Text className="text-xs font-bold text-accent-800">No editable aquí</Text>
              </View>
              <View className="py-2.5 px-3 border-t border-border">
                <Text className="text-[11px] font-bold tracking-wider text-textMuted">Correo</Text>
                <Text className="text-sm font-medium text-text mt-0.5">{currentUser?.email || "—"}</Text>
              </View>
              {currentUser?.rut ? (
                <View className="py-2.5 px-3 border-t border-border">
                  <Text className="text-[11px] font-bold tracking-wider text-textMuted">RUT</Text>
                  <Text className="text-sm font-medium text-text mt-0.5">{currentUser.rut}</Text>
                </View>
              ) : null}
              <TouchableOpacity
                className="py-2.5 px-3 border-t border-border flex-row items-center justify-between gap-2.5"
                onPress={onOpenKyc}
                disabled={!onOpenKyc}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="Verificación de identidad"
              >
                <View>
                  <Text className="text-[11px] font-bold tracking-wider text-textMuted">Identidad</Text>
                  <View className={`flex-row items-center gap-1 self-start rounded-full py-0.5 px-2 mt-1 ${identidadVerificada ? "bg-accent-100" : "bg-amber-50"}`}>
                    <Icon
                      name={identidadVerificada ? "check" : "clock"}
                      size={11}
                      color={identidadVerificada ? colors.accent800 : colors.warningText}
                    />
                    <Text className={`text-[11.5px] font-bold ${identidadVerificada ? "text-accent-800" : "text-amber-800"}`}>
                      {identidadVerificada ? "Verificada" : "Pendiente"}
                    </Text>
                  </View>
                </View>
                {onOpenKyc ? <Icon name="chevron-right" size={16} color={colors.textMuted} /> : null}
              </TouchableOpacity>
            </View>
            <Text className="text-[11.5px] text-textMuted leading-4 px-0.5">
              Estos datos salen de tu verificación de identidad. Para cambiarlos, vuelve a verificarte.
            </Text>
          </View>
        </ScrollView>

        <View
          className="px-4 pt-3 bg-surface border-t border-border"
          style={{ paddingBottom: Math.max(insets.bottom, 12) + 8 }}
        >
          <Button tone={tone} label="Guardar cambios" onPress={guardar} loading={guardando} />
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}
