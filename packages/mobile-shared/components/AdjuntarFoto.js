import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from "react-native";
import { colors } from "../theme/colors";
import { theme } from "../theme/tokens";
import { Icon } from "./Icon";
import { elegirYSubirImagen } from "../utils/imagenes";
import { showAlert } from "../utils/alert";

/**
 * Adjuntar una foto desde la cámara o la galería.
 *
 * Antes acá había un campo de texto pidiendo pegar una URL: nadie escribe una
 * URL en el teléfono, así que la evidencia y la boleta quedaban sin adjuntar y
 * el cargo se aplicaba sin respaldo. Extraído de ReportFineModal para que
 * CobroPosteriorModal (peajes/fotomultas) lo reutilice igual.
 */
export function AdjuntarFoto({ etiqueta, ayuda, url, onUrl, bucket, ajustes, obligatorio }) {
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
      showAlert("No se pudo adjuntar", err.message || "Inténtalo de nuevo.");
    } finally {
      setSubiendo(false);
    }
  };

  return (
    <View style={styles.inputGroup}>
      <Text style={styles.inputLabel}>
        {etiqueta}
        {obligatorio ? "" : " (opcional)"}
      </Text>
      {ayuda ? <Text style={styles.adjuntoAyuda}>{ayuda}</Text> : null}

      {url ? (
        <View style={styles.adjuntoListo}>
          <Icon name="check" size={16} color={colors.accent700} />
          <Text style={styles.adjuntoListoTexto} numberOfLines={1}>
            Adjuntado
          </Text>
          <TouchableOpacity onPress={() => onUrl("")} hitSlop={theme.control.hitSlop}>
            <Text style={styles.adjuntoQuitar}>Quitar</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.adjuntoBotones}>
          <TouchableOpacity
            style={styles.adjuntoBoton}
            onPress={() => adjuntar("camera")}
            disabled={subiendo}
            activeOpacity={0.8}
          >
            {subiendo ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <>
                <Icon name="camera" size={16} color={colors.primary} />
                <Text style={styles.adjuntoBotonTexto}>Tomar foto</Text>
              </>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.adjuntoBoton}
            onPress={() => adjuntar("library")}
            disabled={subiendo}
            activeOpacity={0.8}
          >
            <Icon name="document" size={16} color={colors.primary} />
            <Text style={styles.adjuntoBotonTexto}>Desde galería</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  inputGroup: { gap: 6 },
  inputLabel: { fontSize: 13, fontWeight: "600", color: colors.text },
  adjuntoAyuda: {
    fontSize: 12,
    lineHeight: 17,
    color: colors.textMuted,
    marginTop: -2,
  },
  adjuntoBotones: { flexDirection: "row", gap: theme.spacing.sm },
  adjuntoBoton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    height: 44,
    borderRadius: theme.radius.field,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  adjuntoBotonTexto: { fontSize: 13, fontWeight: "700", color: colors.primary },
  adjuntoListo: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
    height: 44,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.radius.field,
    borderWidth: 1.5,
    borderColor: colors.accent700,
    backgroundColor: colors.surfaceSubtle,
  },
  adjuntoListoTexto: { flex: 1, fontSize: 13, fontWeight: "700", color: colors.text },
  adjuntoQuitar: { fontSize: 13, fontWeight: "700", color: colors.textMuted },
});
