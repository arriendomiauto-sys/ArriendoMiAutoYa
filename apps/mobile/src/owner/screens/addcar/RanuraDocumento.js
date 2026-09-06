import React from "react";
import { View, Text, StyleSheet, Image, TouchableOpacity, ActivityIndicator } from "react-native";
import { colors, theme, Icon } from "@rentacar/mobile-shared";

// Veredicto del motor de documentos del backend → tono visual.
const TONO = {
  vigente: "ok",
  sin_vencimiento: "ok",
  por_vencer: "aviso",
  vencido: "error",
  patente_no_coincide: "error",
  tipo_incorrecto: "error",
};

export function RanuraDocumento({ doc, uri, uploading, validando, validacion, onCamera, onFile, onClear }) {
  const tono = validacion ? TONO[validacion.estado] || "aviso" : null;
  const texto = (() => {
    if (validando) return "Leyendo el documento…";
    if (!validacion) return null;
    if (validacion.motivo) return validacion.motivo;
    if (validacion.vencimiento) {
      const [a, m, d] = validacion.vencimiento.split("-");
      return `Vigente hasta el ${d}-${m}-${a}`;
    }
    return "Documento verificado";
  })();

  const colorTono =
    tono === "error" ? colors.danger : tono === "ok" ? colors.accentDark : colors.warning;

  return (
    <View
      style={[
        styles.slot,
        doc.opcional && styles.slotOpcional,
        uri && styles.slotListo,
        tono === "error" && styles.slotError,
        tono === "aviso" && styles.slotAviso,
      ]}
    >
      <View style={styles.cabeza}>
        {uri ? (
          <Image source={{ uri }} style={styles.miniatura} />
        ) : (
          <View style={[styles.icono, doc.opcional && styles.iconoOpcional]}>
            <Icon name={doc.icon} size={19} color={doc.opcional ? colors.textMuted : colors.primary} />
          </View>
        )}

        <View style={{ flex: 1 }}>
          <View style={styles.tituloFila}>
            <Text style={styles.titulo}>{doc.titulo}</Text>
            {doc.opcional ? <Text style={styles.opcionalTag}>Opcional</Text> : null}
          </View>
          <Text style={[styles.ayuda, uri && !texto && { color: colors.accentDark, fontWeight: "600" }]}>
            {uri && !texto ? "Documento listo" : doc.ayuda}
          </Text>
        </View>

        {uploading ? (
          <ActivityIndicator color={colors.primary} size="small" />
        ) : uri ? (
          <TouchableOpacity onPress={onClear} hitSlop={theme.control.hitSlop} accessibilityLabel="Quitar documento">
            <Icon name="trash" size={18} color={colors.danger} />
          </TouchableOpacity>
        ) : null}
      </View>

      {texto ? (
        <View style={styles.veredicto}>
          <Icon
            name={tono === "error" ? "alert" : tono === "ok" ? "check" : "clock"}
            size={13}
            color={colorTono}
          />
          <Text style={[styles.veredictoTexto, { color: colorTono }]}>{texto}</Text>
        </View>
      ) : null}

      {!uri && !uploading ? (
        <View style={styles.acciones}>
          <TouchableOpacity style={styles.btn} onPress={onCamera} activeOpacity={0.85}>
            <Icon name="camera" size={15} color={colors.primary} />
            <Text style={styles.btnText}>Fotografiar</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.btn} onPress={onFile} activeOpacity={0.85}>
            <Icon name="document" size={15} color={colors.primary} />
            <Text style={styles.btnText}>Galería</Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  slot: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    gap: 10,
  },
  slotOpcional: { borderStyle: "dashed" },
  slotListo: { borderColor: colors.successBorder, backgroundColor: colors.surfaceSubtle },
  slotError: { borderColor: colors.dangerBorder },
  slotAviso: { borderColor: colors.warningBorder },
  cabeza: { flexDirection: "row", alignItems: "center", gap: 12 },
  miniatura: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.successBorder,
  },
  icono: {
    width: 42,
    height: 42,
    borderRadius: 10,
    backgroundColor: colors.primary100,
    alignItems: "center",
    justifyContent: "center",
  },
  iconoOpcional: { backgroundColor: colors.surfaceSubtle },
  tituloFila: { flexDirection: "row", alignItems: "center", gap: 6 },
  titulo: { fontSize: 14, fontWeight: "700", color: colors.text, flexShrink: 1 },
  opcionalTag: {
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.4,
    color: colors.textMuted,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
    overflow: "hidden",
  },
  ayuda: { fontSize: 11.5, color: colors.textMuted, lineHeight: 15, marginTop: 2 },
  veredicto: { flexDirection: "row", alignItems: "flex-start", gap: 6 },
  veredictoTexto: { flex: 1, fontSize: 11.5, lineHeight: 16 },
  acciones: { flexDirection: "row", gap: 8 },
  btn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    height: 42,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.primary200,
    backgroundColor: colors.primary100,
  },
  btnText: { fontSize: 13, fontWeight: "700", color: colors.primary },
});
