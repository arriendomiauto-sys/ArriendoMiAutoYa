import React from "react";
import {
  View,
  Text,
  Image,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { Icon } from "../../../components/Icon";
import { colors } from "../../../theme/colors";

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
  const tileClasses = [
    "flex-row items-center gap-3 p-3 rounded-[14px] border",
    done ? "border-accent-200 bg-surface-subtle" : "border-border bg-surface",
    locked && !busy ? "opacity-50" : "",
  ].filter(Boolean).join(" ");

  const thumbClasses = [
    "w-[46px] h-[46px] rounded-[9px] justify-center items-center overflow-hidden border",
    thumbnailUri
      ? "border-accent-300"
      : "border-borderLight border-dashed bg-surface-subtle",
  ].filter(Boolean).join(" ");

  return (
    <TouchableOpacity
      className={tileClasses}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityState={{ disabled, busy }}
      accessibilityLabel={`${title}. ${
        busy ? "Subiendo foto" : done ? "Listo, toca para repetir" : "Pendiente"
      }`}
    >
      <View className={thumbClasses}>
        {thumbnailUri ? (
          <Image source={{ uri: thumbnailUri }} className="w-full h-full" />
        ) : (
          <Icon name={icon} size={20} color={colors.primary300} strokeWidth={1.6} />
        )}
      </View>

      <View className="flex-1">
        <Text className="text-[13.5px] font-bold text-text">{title}</Text>
        <Text className="text-[11.5px] text-text-secondary mt-0.5">{busy ? "Subiendo foto…" : hint}</Text>
      </View>

      <View className="flex-row items-center gap-1.5">
        {busy ? (
          <ActivityIndicator size="small" color={colors.accent700} />
        ) : done ? (
          <View className="bg-accent-100 px-[9px] py-[3px] rounded-full">
            <Text className="text-[10.5px] font-bold text-accent-800">Listo</Text>
          </View>
        ) : (
          <>
            <View className="bg-surface-secondary px-[9px] py-[3px] rounded-full">
              <Text className="text-[10.5px] font-bold text-text-secondary">Pendiente</Text>
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
    <View className="flex-1 bg-background">
      <ScrollView
        contentContainerClassName="p-5"
        showsVerticalScrollIndicator={false}
      >
        {/* Bloque cabecera: qué se pide y en qué términos */}
        <Text className="text-[22px] font-extrabold tracking-[-0.3px] text-primary-700 mb-2">Verificación manual</Text>
        <Text className="text-sm leading-[21px] text-text-secondary mb-5">
          Toma 3 fotos. Puedes hacerlas en cualquier orden y repetir cualquiera
          antes de enviar.
        </Text>

        {/* Bloque progreso: reemplaza el "Paso X de 3" repetido en cada pantalla */}
        <View className="flex-row items-center gap-2.5 mb-[18px]">
          <View className="flex-row gap-[5px] flex-1">
            {[0, 1, 2].map((i) => (
              <View
                key={i}
                className={`flex-1 h-1 rounded ${i < readyCount ? "bg-accent-500" : "bg-surface-secondary"}`}
              />
            ))}
          </View>
          <Text className="text-[11.5px] font-bold text-accent-700 [font-variant:tabular-nums]">{readyCount} / 3</Text>
        </View>

        {/* Bloque lista: una fila por documento, cada una abre su cámara */}
        <View className="gap-2.5">
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
        <View className="flex-row gap-2.5 items-start mt-[22px] p-3.5 rounded-xl bg-surface-subtle">
          <Icon name="lock" size={16} color={colors.accent800} strokeWidth={1.7} />
          <Text className="flex-1 text-[12.5px] leading-[18px] text-accent-800">
            Tus fotos viajan cifradas y solo las revisa el equipo de verificación.
          </Text>
        </View>
      </ScrollView>

      {/* Bloque acciones: enviar (solo con 3/3) o volver a la ruta rápida */}
      <View className="border-t border-border bg-surface pt-3 pb-4">
        {!allReady && helpText ? <Text className="text-center text-xs text-text-secondary mb-1">{helpText}</Text> : null}

        <TouchableOpacity
          className={`rounded-[14px] py-4 items-center justify-center mx-4 my-2 ${
            (!allReady || isSubmitting) ? "bg-disabled-bg" : "bg-primary-700"
          }`}
          onPress={onSubmit}
          disabled={!allReady || isSubmitting}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="Enviar para verificación"
        >
          {isSubmitting ? (
            <ActivityIndicator size="small" color={colors.textWhite} />
          ) : (
            <Text className="text-white text-base font-bold">
              Enviar para verificación
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          className="bg-transparent rounded-[14px] py-3.5 items-center justify-center mx-4"
          onPress={onBackToDidit}
          disabled={isSubmitting}
          accessibilityRole="button"
          accessibilityLabel="Volver a la verificación rápida con Didit"
        >
          <Text className="text-primary-600 text-sm font-semibold">
            Volver a la verificación rápida con Didit
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
