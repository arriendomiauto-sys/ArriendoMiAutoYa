import React, { useState } from "react";
import { View, Text, TouchableOpacity, ActivityIndicator } from "react-native";
import { colors } from "../theme/colors";
import { theme } from "../theme/tokens";
import { Icon } from "./Icon";
import { elegirYSubirImagen } from "../utils/imagenes";
import { showAlert } from "../utils/alert";
import { msjError } from "../utils/msjError";

/**
 * Adjuntar una foto desde la cámara o la galería.
 *
 * Antes acá había un campo de texto pidiendo pegar una URL: nadie escribe una
 * URL en el teléfono, así que la evidencia y la boleta quedaban sin adjuntar y
 * el cargo se aplicaba sin respaldo. Extraído de ReportFineModal para que
 * CobroPosteriorModal (peajes/fotomultas) lo reutilice igual.
 */
export function AdjuntarFoto({ etiqueta, ayuda, url, onUrl, bucket, ajustes, obligatorio, className = "", style }) {
  const [subiendo, setSubiendo] = useState(false);

  const adjuntar = async (origen) => {
    setSubiendo(true);
    try {
      const { url: subida, cancelado } = await elegirYSubirImagen({
        origen,
        bucket,
        filename: `${bucket}-${Date.now()}.jpg`,
        ...(ajustes || {}),
      });
      if (!cancelado && subida) onUrl(subida);
    } catch (err) {
      showAlert("No se pudo adjuntar", msjError(err, "Inténtalo de nuevo."));
    } finally {
      setSubiendo(false);
    }
  };

  return (
    <View className={`gap-1.5 ${className}`} style={style}>
      <Text className="text-[13px] font-semibold text-text">
        {etiqueta}
        {obligatorio ? "" : " (opcional)"}
      </Text>
      {ayuda ? <Text className="text-xs leading-[17px] text-textMuted -mt-0.5">{ayuda}</Text> : null}

      {url ? (
        <View className="flex-row items-center gap-2 h-11 px-3.5 rounded-xl border-[1.5px] border-accent-700 bg-surfaceSubtle">
          <Icon name="check" size={16} color={colors.accent700} />
          <Text className="flex-1 text-[13px] font-bold text-text" numberOfLines={1}>
            Adjuntado
          </Text>
          <TouchableOpacity onPress={() => onUrl("")} hitSlop={theme.control.hitSlop}>
            <Text className="text-[13px] font-bold text-textMuted">Quitar</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View className="flex-row gap-2">
          <TouchableOpacity
            className="flex-1 flex-row items-center justify-center gap-1.5 h-11 rounded-xl border-[1.5px] border-border bg-surface"
            onPress={() => adjuntar("camera")}
            disabled={subiendo}
            activeOpacity={0.8}
          >
            {subiendo ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <>
                <Icon name="camera" size={16} color={colors.primary} />
                <Text className="text-[13px] font-bold text-primary">Tomar foto</Text>
              </>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            className="flex-1 flex-row items-center justify-center gap-1.5 h-11 rounded-xl border-[1.5px] border-border bg-surface"
            onPress={() => adjuntar("library")}
            disabled={subiendo}
            activeOpacity={0.8}
          >
            <Icon name="document" size={16} color={colors.primary} />
            <Text className="text-[13px] font-bold text-primary">Desde galería</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}
