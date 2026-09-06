import React from "react";
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from "react-native";
import { colors, theme, Icon } from "@rentacar/mobile-shared";
import { TituloPaso, BarraProgreso } from "./comun";
import { RanuraDocumento } from "./RanuraDocumento";
import { DOCS, DOCS_OBLIGATORIOS } from "./useCarWizard";

export function PasoDocumentos({ wizard }) {
  const { form, validacionDocs, validandoDoc, uploadingDoc, subirDocumento, quitarDocumento, docsCargados } =
    wizard;

  return (
    <ScrollView contentContainerStyle={estilos.scroll} showsVerticalScrollIndicator={false}>
      <TituloPaso
        titulo="Documentos del auto"
        bajada="Al subir cada uno lo leemos para confirmar que es de este auto y sigue vigente."
      />

      <BarraProgreso hechos={docsCargados} total={DOCS_OBLIGATORIOS.length} etiqueta="obligatorios" />

      {DOCS.map((doc) => (
        <RanuraDocumento
          key={doc.key}
          doc={doc}
          uri={form.docs[doc.key]}
          uploading={uploadingDoc === doc.key}
          validando={validandoDoc === doc.key}
          validacion={validacionDocs[doc.key]}
          onCamera={() => subirDocumento(doc.key, "camera")}
          onFile={() => subirDocumento(doc.key, "library")}
          onClear={() => quitarDocumento(doc.key)}
        />
      ))}

      <TouchableOpacity
        style={[estilos.gps, form.gps_consentimiento && estilos.gpsOn]}
        onPress={() => wizard.setField("gps_consentimiento", !form.gps_consentimiento)}
        activeOpacity={0.85}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: form.gps_consentimiento }}
      >
        <View style={[estilos.gpsBox, form.gps_consentimiento && estilos.gpsBoxOn]}>
          {form.gps_consentimiento ? <Icon name="check" size={13} color="#FFFFFF" /> : null}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={estilos.gpsTitulo}>Autorizo la instalación del GPS</Text>
          <Text style={estilos.gpsTexto}>
            Equipo en comodato, sin costo. Ves la posición de tu auto desde la app y pides el retiro
            del equipo cuando salgas de la plataforma. El corte remoto de motor es exclusivo de la
            plataforma y solo ante no devolución o disputa formal.
          </Text>
        </View>
      </TouchableOpacity>
    </ScrollView>
  );
}

const estilos = StyleSheet.create({
  scroll: {
    paddingHorizontal: theme.spacing.screen,
    paddingTop: theme.spacing.md,
    paddingBottom: 40,
    gap: theme.spacing.md,
  },
  gps: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    marginTop: 4,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.primary100,
  },
  gpsOn: { borderColor: colors.primary },
  gpsBox: {
    width: 22,
    height: 22,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: colors.borderLight,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  gpsBoxOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  gpsTitulo: { fontSize: 13, fontWeight: "700", color: colors.primary },
  gpsTexto: { fontSize: 11.5, color: colors.textMuted, lineHeight: 16, marginTop: 3 },
});
