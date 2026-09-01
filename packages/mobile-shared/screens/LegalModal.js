import React, { useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal } from "react-native";
import * as WebBrowser from "expo-web-browser";
import { colors } from "../theme/colors";
import { theme } from "../theme/tokens";
import { Icon } from "../components/Icon";
import { Button, Chip } from "../components/ui";
import { DOCUMENTOS_LEGALES } from "../legal/documentos";
import { showAlert } from "../utils/alert";

/**
 * Visor de los documentos legales (términos y política de privacidad) que se
 * aceptan al crear la cuenta. Se abre desde el registro para poder leerlos
 * ANTES de marcar la casilla; `onAccept` deja aceptar desde acá mismo.
 */
export function LegalModal({ visible, doc = "terminos", onClose, onAccept }) {
  const [activo, setActivo] = useState(doc);
  const [ultimoDoc, setUltimoDoc] = useState(doc);
  // Al reabrirlo desde otro link se muestra el documento que se pidió.
  if (visible && doc !== ultimoDoc) {
    setUltimoDoc(doc);
    setActivo(doc);
  }

  const documento = DOCUMENTOS_LEGALES[activo] || DOCUMENTOS_LEGALES.terminos;

  const abrirEnElSitio = async () => {
    try {
      await WebBrowser.openBrowserAsync(documento.url);
    } catch {
      showAlert("No se pudo abrir el navegador", `Puedes leerlo en ${documento.url}`);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.handle} />

          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>{documento.titulo}</Text>
              <Text style={styles.sub}>{documento.subtitulo}</Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={theme.control.hitSlop} accessibilityLabel="Cerrar">
              <Icon name="close" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          <View style={styles.tabs}>
            {Object.values(DOCUMENTOS_LEGALES).map((d) => (
              <Chip
                key={d.id}
                label={d.id === "terminos" ? "Términos" : "Privacidad"}
                selected={activo === d.id}
                onPress={() => setActivo(d.id)}
              />
            ))}
          </View>

          <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent} showsVerticalScrollIndicator={false}>
            <Text style={styles.actualizado}>{documento.actualizado}</Text>

            {documento.secciones.map((s) => (
              <View key={s.h} style={styles.seccion}>
                <Text style={styles.seccionTitulo}>{s.h}</Text>
                {s.p ? <Text style={styles.parrafo}>{s.p}</Text> : null}
                {(s.items || []).map((item) => (
                  <View key={item} style={styles.item}>
                    <Text style={styles.bullet}>•</Text>
                    <Text style={styles.itemTexto}>{item}</Text>
                  </View>
                ))}
              </View>
            ))}

            <TouchableOpacity style={styles.linkSitio} onPress={abrirEnElSitio} activeOpacity={0.8}>
              <Icon name="document" size={15} color={colors.accentDark} />
              <Text style={styles.linkSitioTexto}>Ver la versión completa en el sitio</Text>
            </TouchableOpacity>
          </ScrollView>

          <View style={styles.footer}>
            {onAccept ? (
              <>
                <Button label="Cerrar" variant="secondary" onPress={onClose} fullWidth={false} style={{ flex: 1 }} />
                <Button
                  label="Acepto"
                  onPress={() => {
                    onAccept();
                    onClose?.();
                  }}
                  fullWidth={false}
                  style={{ flex: 1 }}
                />
              </>
            ) : (
              <Button label="Cerrar" onPress={onClose} />
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(6,30,31,0.55)", justifyContent: "flex-end" },
  sheet: {
    maxHeight: "90%",
    backgroundColor: colors.surface,
    borderTopLeftRadius: theme.radius.card,
    borderTopRightRadius: theme.radius.card,
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
  },
  handle: {
    alignSelf: "center",
    width: 44,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
  },
  header: { flexDirection: "row", alignItems: "flex-start", gap: theme.spacing.md },
  title: { ...theme.typography.title, color: colors.text },
  sub: { fontSize: 13, color: colors.textMuted, marginTop: 2 },

  tabs: { flexDirection: "row", gap: theme.spacing.sm },

  body: { flexGrow: 0 },
  bodyContent: { gap: theme.spacing.lg, paddingBottom: theme.spacing.md },
  actualizado: { fontSize: 12, color: colors.textMuted, fontStyle: "italic" },

  seccion: { gap: 6 },
  seccionTitulo: { fontSize: 15, fontWeight: "700", color: colors.text },
  parrafo: { fontSize: 14, color: colors.textSecondary, lineHeight: 21 },
  item: { flexDirection: "row", gap: 8, paddingLeft: 4 },
  bullet: { fontSize: 14, color: colors.accentDark, lineHeight: 21 },
  itemTexto: { flex: 1, fontSize: 14, color: colors.textSecondary, lineHeight: 21 },

  linkSitio: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: theme.spacing.sm,
  },
  linkSitioTexto: { fontSize: 14, fontWeight: "600", color: colors.accentDark },

  footer: {
    flexDirection: "row",
    gap: theme.spacing.md,
    paddingTop: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
});
