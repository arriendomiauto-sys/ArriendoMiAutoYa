import React from "react";
import {
  View,
  Text,
  Image,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { Icon } from "../../../components/Icon";
import { colors } from "../../../theme/colors";
import { kycStyles } from "../styles/kycStyles";

// ============================================================================
// Pantalla 3: Captura manual (respaldo cuando Didit no está disponible)
// Reemplaza las 3 pantallas oscuras en fila (cédula -> licencia -> selfie) por
// una sola lista: se ven los 3 documentos a la vez, se capturan en cualquier
// orden y se repiten sin retroceder. Cada fila abre su cámara guiada.
// ============================================================================

// ----------------------------------------------------------------------------
// Fila de captura: miniatura, nombre del documento, estado y acción. Toda la
// fila es táctil y abre la cámara correspondiente (o la repite si ya está).
//   busy      = la foto de ESTA fila se está subiendo (spinner + no táctil)
//   locked    = hay otra subida en curso (la fila se atenúa y no responde)
// ----------------------------------------------------------------------------
function CaptureTile({ thumbnailUri, icon, title, hint, done, busy, locked, onPress }) {
  const disabled = busy || locked;
  return (
    <TouchableOpacity
      style={[styles.tile, done && styles.tileDone, locked && !busy && styles.tileLocked]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityState={{ disabled, busy }}
      accessibilityLabel={`${title}. ${
        busy ? "Subiendo foto" : done ? "Listo, toca para repetir" : "Pendiente"
      }`}
    >
      <View style={[styles.thumb, thumbnailUri ? styles.thumbFilled : styles.thumbEmpty]}>
        {thumbnailUri ? (
          <Image source={{ uri: thumbnailUri }} style={styles.thumbImage} />
        ) : (
          <Icon name={icon} size={20} color={colors.primary300} strokeWidth={1.6} />
        )}
      </View>

      <View style={styles.tileBody}>
        <Text style={styles.tileTitle}>{title}</Text>
        <Text style={styles.tileHint}>{busy ? "Subiendo foto…" : hint}</Text>
      </View>

      <View style={styles.tileStatus}>
        {busy ? (
          <ActivityIndicator size="small" color={colors.accent700} />
        ) : done ? (
          <View style={styles.pillOk}>
            <Text style={styles.pillOkText}>Listo</Text>
          </View>
        ) : (
          <>
            <View style={styles.pillWait}>
              <Text style={styles.pillWaitText}>Pendiente</Text>
            </View>
            <Icon name="chevron-right" size={16} color={colors.textPlaceholder} />
          </>
        )}
      </View>
    </TouchableOpacity>
  );
}

// Arma el texto de "qué falta" a partir de los documentos aún pendientes.
function buildMissingHelp({ idFront, idBack, license, selfie }) {
  const missing = [];
  if (!idFront) missing.push("el frente de tu cédula");
  else if (!idBack) missing.push("el reverso de tu cédula");
  if (!license) missing.push("tu licencia");
  if (!selfie) missing.push("tu selfie");

  if (missing.length === 0) return null;
  if (missing.length === 1) return `Falta ${missing[0]}.`;
  const last = missing.pop();
  return `Faltan ${missing.join(", ")} y ${last}.`;
}

export function StepManualCapture({
  docs,
  uploadingSlot = null,
  onCapture,
  onSubmit,
  onBackToDidit,
  isSubmitting,
}) {
  const {
    idCardFrontUrl,
    idCardBackUrl,
    licenseUrl,
    selfieUrl,
  } = docs || {};

  // Estado por documento. La cédula necesita ambos lados para contar como lista.
  const idCardDone = !!idCardFrontUrl && !!idCardBackUrl;
  const licenseDone = !!licenseUrl;
  const selfieDone = !!selfieUrl;

  // Subida en curso: la fila afectada muestra spinner, el resto se bloquea.
  const anyUploading = !!uploadingSlot;
  const idCardBusy = uploadingSlot === "id_front" || uploadingSlot === "id_back";
  const licenseBusy = uploadingSlot === "license";
  const selfieBusy = uploadingSlot === "selfie";

  const readyCount = [idCardDone, licenseDone, selfieDone].filter(Boolean).length;
  const docsReady = readyCount === 3;
  const allReady = docsReady;

  // La fila de la cédula avanza sola: frente -> reverso -> (repetir frente).
  const onPressIdCard = () => {
    if (!idCardFrontUrl) onCapture("id_front");
    else if (!idCardBackUrl) onCapture("id_back");
    else onCapture("id_front");
  };

  const idCardHint = idCardDone
    ? "Frente y reverso listos · toca para repetir"
    : idCardFrontUrl
      ? "Frente listo · falta el reverso"
      : "Toca para fotografiar el frente y el reverso";

  const helpText = buildMissingHelp({
    idFront: !!idCardFrontUrl,
    idBack: !!idCardBackUrl,
    license: licenseDone,
    selfie: selfieDone,
  });

  return (
    <View style={kycStyles.screenContainer}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Bloque cabecera: qué se pide y en qué términos */}
        <Text style={styles.title}>Verificación manual</Text>
        <Text style={styles.subtitle}>
          Toma 3 fotos. Puedes hacerlas en cualquier orden y repetir cualquiera
          antes de enviar.
        </Text>

        {/* Bloque progreso: reemplaza el "Paso X de 3" repetido en cada pantalla */}
        <View style={styles.progress}>
          <View style={styles.progressBars}>
            {[0, 1, 2].map((i) => (
              <View key={i} style={[styles.progressSeg, i < readyCount && styles.progressSegOn]} />
            ))}
          </View>
          <Text style={styles.progressCount}>{readyCount} / 3</Text>
        </View>

        {/* Bloque lista: una fila por documento, cada una abre su cámara */}
        <View style={styles.tiles}>
          <CaptureTile
            thumbnailUri={idCardFrontUrl}
            icon="card"
            title="Cédula de identidad"
            hint={idCardHint}
            done={idCardDone}
            busy={idCardBusy}
            locked={anyUploading}
            onPress={onPressIdCard}
          />
          <CaptureTile
            thumbnailUri={licenseUrl}
            icon="card"
            title="Licencia de conducir"
            hint={licenseDone ? "Clase B · toca para repetir" : "Clase B y vigente · toca para fotografiar"}
            done={licenseDone}
            busy={licenseBusy}
            locked={anyUploading}
            onPress={() => onCapture("license")}
          />
          <CaptureTile
            thumbnailUri={selfieUrl}
            icon="user"
            title="Selfie con prueba de vida"
            hint={selfieDone ? "Prueba de vida lista · toca para repetir" : "Dos fotos guiadas, se toman solas"}
            done={selfieDone}
            busy={selfieBusy}
            locked={anyUploading}
            onPress={() => onCapture("selfie")}
          />
        </View>

        {/* Bloque privacidad: destino de las fotos */}
        <View style={styles.privacy}>
          <Icon name="lock" size={16} color={colors.accent800} strokeWidth={1.7} />
          <Text style={styles.privacyText}>
            Tus fotos viajan cifradas y solo las revisa el equipo de verificación.
          </Text>
        </View>
      </ScrollView>

      {/* Bloque acciones: enviar (solo con 3/3) o volver a la ruta rápida */}
      <View style={[kycStyles.footerBar, styles.footer]}>
        {!allReady && helpText ? <Text style={kycStyles.ctaHelp}>{helpText}</Text> : null}

        <TouchableOpacity
          style={[kycStyles.primaryButton, (!allReady || isSubmitting) && kycStyles.primaryButtonDisabled]}
          onPress={onSubmit}
          disabled={!allReady || isSubmitting}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="Enviar para verificación"
        >
          {isSubmitting ? (
            <ActivityIndicator size="small" color={colors.textWhite} />
          ) : (
            <Text
              style={[kycStyles.primaryButtonText, !allReady && kycStyles.primaryButtonTextDisabled]}
            >
              Enviar para verificación
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={kycStyles.secondaryButton}
          onPress={onBackToDidit}
          disabled={isSubmitting}
          accessibilityRole="button"
          accessibilityLabel="Volver a la verificación rápida con Didit"
        >
          <Text style={kycStyles.secondaryButtonText}>
            Volver a la verificación rápida con Didit
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    padding: 20,
  },

  // Cabecera
  title: {
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: -0.3,
    color: colors.primary700,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 21,
    color: colors.textSecondary,
    marginBottom: 20,
  },

  // Progreso agregado
  progress: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 18,
  },
  progressBars: {
    flexDirection: "row",
    gap: 5,
    flex: 1,
  },
  progressSeg: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.surfaceSecondary,
  },
  progressSegOn: {
    backgroundColor: colors.accent500,
  },
  progressCount: {
    fontSize: 11.5,
    fontWeight: "700",
    color: colors.accent700,
    fontVariant: ["tabular-nums"],
  },

  // Lista de captura
  tiles: {
    gap: 10,
  },
  tile: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  tileDone: {
    borderColor: colors.accent200,
    backgroundColor: colors.surfaceSubtle,
  },
  tileLocked: {
    opacity: 0.5,
  },
  thumb: {
    width: 46,
    height: 46,
    borderRadius: 9,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  thumbFilled: {
    borderWidth: 1,
    borderColor: colors.accent300,
  },
  thumbEmpty: {
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderStyle: "dashed",
    backgroundColor: colors.surfaceSubtle,
  },
  thumbImage: {
    width: "100%",
    height: "100%",
  },
  tileBody: {
    flex: 1,
  },
  tileTitle: {
    fontSize: 13.5,
    fontWeight: "700",
    color: colors.text,
  },
  tileHint: {
    fontSize: 11.5,
    color: colors.textSecondary,
    marginTop: 2,
  },
  tileStatus: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  pillOk: {
    backgroundColor: colors.accent100,
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 999,
  },
  pillOkText: {
    fontSize: 10.5,
    fontWeight: "700",
    color: colors.accent800,
  },
  pillWait: {
    backgroundColor: colors.surfaceSecondary,
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 999,
  },
  pillWaitText: {
    fontSize: 10.5,
    fontWeight: "700",
    color: colors.textSecondary,
  },

  // Nota de privacidad
  privacy: {
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
    marginTop: 22,
    padding: 14,
    borderRadius: 12,
    backgroundColor: colors.surfaceSubtle,
  },
  privacyText: {
    flex: 1,
    fontSize: 12.5,
    lineHeight: 18,
    color: colors.accent800,
  },

  // Pie de acciones
  footer: {
    paddingBottom: 16,
  },
});
