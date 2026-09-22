import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  Image,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
  AccessibilityInfo,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Icon } from "../../../components/Icon";
import { colors } from "../../../theme/colors";

// ============================================================================
// Pantalla 2: Confirmación de los datos extraídos por Didit
// No es un "perfil con avatar": reconstruye la cédula chilena como credencial
// verificada (retrato rectangular, RUN en cifras tabulares, sello Didit).
// ============================================================================

// ----------------------------------------------------------------------------
// Campo de la credencial: micro-etiqueta en versalitas (cita del documento
// real) sobre el valor verificado.
// ----------------------------------------------------------------------------
function CredentialField({ label, value, emphasis }) {
  return (
    <View className="mb-3">
      <Text className="text-[10px] font-bold tracking-[1.3px] text-accent-300 mb-[3px]">{label}</Text>
      <Text
        className={
          emphasis
            ? "text-xl font-bold tracking-[0.4px] text-white [font-variant:tabular-nums]"
            : "text-[15.5px] font-bold leading-5 text-white"
        }
      >
        {value}
      </Text>
    </View>
  );
}

// ----------------------------------------------------------------------------
// Fila etiqueta / valor de la tarjeta de licencia.
// ----------------------------------------------------------------------------
function DetailRow({ label, value, tabular }) {
  return (
    <View className="flex-row justify-between items-baseline py-[7px]">
      <Text className="text-[13px] text-text-secondary">{label}</Text>
      <Text className={`text-[13px] font-semibold text-text ${tabular ? "[font-variant:tabular-nums]" : ""}`}>
        {value}
      </Text>
    </View>
  );
}

// ----------------------------------------------------------------------------
// Sello de verificación Didit. Timbra una vez al montar (escala + opacidad);
// si el sistema pide menos movimiento, aparece directamente en su estado final.
// ----------------------------------------------------------------------------
function VerificationSeal() {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((reduceMotion) => {
        if (!mounted) return;
        if (reduceMotion) {
          progress.setValue(1);
          return;
        }
        Animated.spring(progress, {
          toValue: 1,
          friction: 6,
          tension: 80,
          useNativeDriver: true,
        }).start();
      })
      .catch(() => progress.setValue(1));
    return () => {
      mounted = false;
    };
  }, [progress]);

  const animatedStyle = {
    opacity: progress,
    transform: [
      { scale: progress.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) },
      { rotate: progress.interpolate({ inputRange: [0, 1], outputRange: ["-12deg", "0deg"] }) },
    ],
  };

  return (
    <Animated.View
      className="absolute top-4 right-4 w-[54px] items-center"
      style={animatedStyle}
      accessibilityLabel="Verificado por Didit"
    >
      <View className="w-11 h-11 rounded-full bg-accent-700 border-[1.5px] border-accent-300 justify-center items-center mb-[3px]">
        <Icon name="check" size={18} color={colors.textWhite} strokeWidth={2.6} />
      </View>
      <Text className="text-[8.5px] font-bold tracking-[1.2px] text-accent-200">DIDIT</Text>
    </Animated.View>
  );
}

export function StepDiditConfirmation({
  verifiedData,
  onConfirmAndProceed,
  onRetry,
  isSubmitting,
}) {
  const {
    fullName,
    rut,
    photoUrl,
    licenseCategory,
    licenseExpiration,
  } = verifiedData || {};

  const submitDisabled = isSubmitting;

  // El retrato usa un placeholder si Didit no devolvió la foto recortada.
  const [portraitFailed, setPortraitFailed] = useState(false);
  const showPortrait = !!photoUrl && !portraitFailed;

  return (
    // KAV para que el teclado no tape los campos de la tarjeta (convención del
    // proyecto: KAV + ScrollView + keyboardShouldPersistTaps).
    <KeyboardAvoidingView
      className="flex-1 bg-background"
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerClassName="p-5 pb-10"
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        {/* Bloque cabecera: estado verificado + promesa de revisión */}
        <View className="mb-4">
          <View className="flex-row items-center gap-1.5 bg-accent-100 px-3 py-1.5 rounded-full self-start">
            <Icon name="check" size={13} color={colors.accent800} strokeWidth={2.6} />
            <Text className="text-accent-800 text-xs font-bold">Identidad y licencia verificadas</Text>
          </View>
          <Text className="text-[22px] font-extrabold tracking-[-0.3px] text-primary-700 mt-3">
            Tus datos están listos
          </Text>
          <Text className="text-sm leading-[21px] text-text-secondary mt-1.5">
            Didit validó tus documentos. Revisa que la información sea correcta antes
            de continuar.
          </Text>
        </View>

        {/* Bloque credencial: la cédula reconstruida como tarjeta verificada */}
        <View className="relative rounded-2xl bg-primary-800 p-[18px] overflow-hidden shadow-md">
          <View className="absolute top-0 left-0 right-0 h-[5px] bg-accent-500" />

          <View className="flex-row gap-4 pt-2">
            {showPortrait ? (
              <Image
                source={{ uri: photoUrl }}
                className="w-[74px] h-[94px] rounded-[6px] border border-accent-300 bg-primary-700"
                onError={() => setPortraitFailed(true)}
                accessibilityLabel="Retrato verificado"
              />
            ) : (
              <View className="w-[74px] h-[94px] rounded-[6px] border border-accent-300 bg-primary-700 justify-center items-center">
                <Icon name="user" size={26} color={colors.primary300} />
              </View>
            )}

            <View className="flex-1 pr-[54px]">
              <CredentialField label="NOMBRE" value={fullName || "Nombre verificado"} />
              <CredentialField label="RUN" value={rut || "—"} emphasis />
            </View>
          </View>

          <VerificationSeal />

          <View className="h-[1px] bg-darkBorder mt-4 mb-2.5" />
          <View className="flex-row items-center gap-[7px]">
            <Icon name="check" size={14} color={colors.accent200} strokeWidth={2.4} />
            <Text className="text-[12.5px] font-semibold text-accent-200">Identidad y licencia verificadas</Text>
          </View>
        </View>

        {/* Bloque licencia: tarjeta de apoyo con el estado de habilitación */}
        <View className="mt-3.5 bg-surface border border-border rounded-2xl p-4">
          <View className="flex-row items-center gap-2 mb-3">
            <Icon name="card" size={20} color={colors.primary700} strokeWidth={1.6} />
            <Text className="text-[14.5px] font-bold text-primary-700">Licencia de conducir</Text>
            <View className="ml-auto bg-accent-100 px-2.5 py-1 rounded-full">
              <Text className="text-[11px] font-bold text-accent-800">Vigente</Text>
            </View>
          </View>

          <DetailRow label="Categoría" value={licenseCategory || "Clase B"} />
          <DetailRow
            label="Fecha de control"
            value={licenseExpiration || "Al día"}
            tabular={!!licenseExpiration}
          />

          <View className="h-[1px] bg-border mt-2 mb-2.5" />
          <View className="flex-row gap-2 items-start">
            <Icon name="check" size={14} color={colors.accent700} strokeWidth={2.2} />
            <Text className="flex-1 text-[12.5px] leading-[18px] text-text">
              Habilitado para arrendar en la plataforma.
            </Text>
          </View>
        </View>

        {/* Bloque acciones: confirmar o reintentar la verificación */}
        <TouchableOpacity
          className={`rounded-[14px] py-4 items-center justify-center mx-4 my-2 ${
            submitDisabled ? "bg-disabled-bg" : "bg-primary-700"
          }`}
          onPress={onConfirmAndProceed}
          disabled={submitDisabled}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="Confirmar y continuar"
        >
          {isSubmitting ? (
            <ActivityIndicator size="small" color={colors.textWhite} />
          ) : (
            <Text className="text-white text-base font-bold">
              Confirmar y continuar
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          className="bg-transparent rounded-[14px] py-3.5 items-center justify-center mx-4"
          onPress={onRetry}
          disabled={isSubmitting}
          accessibilityRole="button"
          accessibilityLabel="Reintentar"
        >
          <Text className="text-primary-600 text-sm font-semibold">Reintentar</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
