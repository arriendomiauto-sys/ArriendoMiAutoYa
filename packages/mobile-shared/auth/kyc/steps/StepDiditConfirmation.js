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
  StyleSheet,
} from "react-native";
import { Icon } from "../../../components/Icon";
import { colors } from "../../../theme/colors";
import { shadow } from "../../../theme/tokens";
import { kycStyles } from "../styles/kycStyles";

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
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={emphasis ? styles.fieldValueRut : styles.fieldValueName}>{value}</Text>
    </View>
  );
}

// ----------------------------------------------------------------------------
// Fila etiqueta / valor de la tarjeta de licencia.
// ----------------------------------------------------------------------------
function DetailRow({ label, value, tabular }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={[styles.detailValue, tabular && styles.tabular]}>{value}</Text>
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
      style={[styles.seal, animatedStyle]}
      accessibilityLabel="Verificado por Didit"
    >
      <View style={styles.sealDisc}>
        <Icon name="check" size={18} color={colors.textWhite} strokeWidth={2.6} />
      </View>
      <Text style={styles.sealCaption}>DIDIT</Text>
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
      style={kycStyles.screenContainer}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
    <ScrollView
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
    >
      {/* Bloque cabecera: estado verificado + promesa de revisión */}
      <View style={styles.header}>
        <View style={kycStyles.badgeVerified}>
          <Icon name="check" size={13} color={colors.accent800} strokeWidth={2.6} />
          <Text style={kycStyles.badgeVerifiedText}>Identidad y licencia verificadas</Text>
        </View>
        <Text style={styles.title}>Tus datos están listos</Text>
        <Text style={styles.subtitle}>
          Didit validó tus documentos. Revisa que la información sea correcta antes
          de continuar.
        </Text>
      </View>

      {/* Bloque credencial: la cédula reconstruida como tarjeta verificada */}
      <View style={styles.credential}>
        <View style={styles.credentialStripe} />

        <View style={styles.credentialRow}>
          {showPortrait ? (
            <Image
              source={{ uri: photoUrl }}
              style={styles.portrait}
              onError={() => setPortraitFailed(true)}
              accessibilityLabel="Retrato verificado"
            />
          ) : (
            <View style={[styles.portrait, styles.portraitPlaceholder]}>
              <Icon name="user" size={26} color={colors.primary300} />
            </View>
          )}

          <View style={styles.credentialFields}>
            <CredentialField label="NOMBRE" value={fullName || "Nombre verificado"} />
            <CredentialField label="RUN" value={rut || "—"} emphasis />
          </View>
        </View>

        <VerificationSeal />

        <View style={styles.credentialDivider} />
        <View style={styles.credentialStatus}>
          <Icon name="check" size={14} color={colors.accent200} strokeWidth={2.4} />
          <Text style={styles.credentialStatusText}>Identidad y licencia verificadas</Text>
        </View>
      </View>

      {/* Bloque licencia: tarjeta de apoyo con el estado de habilitación */}
      <View style={styles.licenseCard}>
        <View style={styles.licenseHeader}>
          <Icon name="card" size={20} color={colors.primary700} strokeWidth={1.6} />
          <Text style={styles.licenseTitle}>Licencia de conducir</Text>
          <View style={styles.badgeLive}>
            <Text style={styles.badgeLiveText}>Vigente</Text>
          </View>
        </View>

        <DetailRow label="Categoría" value={licenseCategory || "Clase B"} />
        <DetailRow
          label="Fecha de control"
          value={licenseExpiration || "Al día"}
          tabular={!!licenseExpiration}
        />

        <View style={styles.licenseDivider} />
        <View style={styles.licenseNote}>
          <Icon name="check" size={14} color={colors.accent700} strokeWidth={2.2} />
          <Text style={styles.licenseNoteText}>
            Habilitado para arrendar en la plataforma.
          </Text>
        </View>
      </View>

      {/* Bloque acciones: confirmar o reintentar la verificación */}
      <TouchableOpacity
        style={[kycStyles.primaryButton, submitDisabled && kycStyles.primaryButtonDisabled]}
        onPress={onConfirmAndProceed}
        disabled={submitDisabled}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel="Confirmar y continuar"
      >
        {isSubmitting ? (
          <ActivityIndicator size="small" color={colors.textWhite} />
        ) : (
          <Text
            style={[
              kycStyles.primaryButtonText,
              submitDisabled && kycStyles.primaryButtonTextDisabled,
            ]}
          >
            Confirmar y continuar
          </Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={kycStyles.secondaryButton}
        onPress={onRetry}
        disabled={isSubmitting}
        accessibilityRole="button"
        accessibilityLabel="Reintentar"
      >
        <Text style={kycStyles.secondaryButtonText}>Reintentar</Text>
      </TouchableOpacity>
    </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },

  // Cabecera
  header: {
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: -0.3,
    color: colors.primary700,
    marginTop: 12,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 21,
    color: colors.textSecondary,
    marginTop: 6,
  },

  // Tarjeta-credencial (pino)
  credential: {
    position: "relative",
    borderRadius: 16,
    backgroundColor: colors.primary800,
    padding: 18,
    overflow: "hidden",
    ...shadow.md,
  },
  // Franja superior tipo guilloché de la cédula.
  credentialStripe: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 5,
    backgroundColor: colors.accent500,
  },
  credentialRow: {
    flexDirection: "row",
    gap: 16,
    paddingTop: 8,
  },
  portrait: {
    width: 74,
    height: 94,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.accent300,
    backgroundColor: colors.primary700,
  },
  portraitPlaceholder: {
    justifyContent: "center",
    alignItems: "center",
  },
  credentialFields: {
    flex: 1,
    paddingRight: 54,
  },
  field: {
    marginBottom: 12,
  },
  fieldLabel: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.3,
    color: colors.accent300,
    marginBottom: 3,
  },
  fieldValueName: {
    fontSize: 15.5,
    fontWeight: "700",
    lineHeight: 20,
    color: colors.textWhite,
  },
  fieldValueRut: {
    fontSize: 20,
    fontWeight: "700",
    letterSpacing: 0.4,
    color: colors.textWhite,
    fontVariant: ["tabular-nums"],
  },

  // Sello Didit
  seal: {
    position: "absolute",
    top: 16,
    right: 16,
    width: 54,
    alignItems: "center",
  },
  sealDisc: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.accent700,
    borderWidth: 1.5,
    borderColor: colors.accent300,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 3,
  },
  sealCaption: {
    fontSize: 8.5,
    fontWeight: "700",
    letterSpacing: 1.2,
    color: colors.accent200,
  },

  credentialDivider: {
    height: 1,
    backgroundColor: colors.darkBorder,
    marginTop: 16,
    marginBottom: 10,
  },
  credentialStatus: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  credentialStatusText: {
    fontSize: 12.5,
    fontWeight: "600",
    color: colors.accent200,
  },

  // Tarjeta de licencia (superficie clara)
  licenseCard: {
    marginTop: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 16,
  },
  licenseHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  licenseTitle: {
    fontSize: 14.5,
    fontWeight: "700",
    color: colors.primary700,
  },
  badgeLive: {
    marginLeft: "auto",
    backgroundColor: colors.accent100,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  badgeLiveText: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.accent800,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    paddingVertical: 7,
  },
  detailLabel: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  detailValue: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.text,
  },
  tabular: {
    fontVariant: ["tabular-nums"],
  },
  licenseDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginTop: 8,
    marginBottom: 10,
  },
  licenseNote: {
    flexDirection: "row",
    gap: 8,
    alignItems: "flex-start",
  },
  licenseNoteText: {
    flex: 1,
    fontSize: 12.5,
    lineHeight: 18,
    color: colors.text,
  },
});
