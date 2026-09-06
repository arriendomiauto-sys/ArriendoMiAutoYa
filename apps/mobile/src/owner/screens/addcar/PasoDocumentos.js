import React from "react";
import { ScrollView, StyleSheet } from "react-native";
import { theme } from "@rentacar/mobile-shared";
import { TituloPaso, BarraProgreso } from "./comun";
import { RanuraDocumento } from "./RanuraDocumento";
import { DOCS, DOCS_OBLIGATORIOS } from "./useCarWizard";

export function PasoDocumentos({ wizard }) {
  const { form, validacionDocs, validandoDoc, uploadingDoc, subirDocumento, quitarDocumento, docsCargados } =
    wizard;
  // NOTA (Limpieza de UI de GPS): la casilla "Autorizo la instalación del GPS"
  // se ocultó hasta la nueva definición formal del módulo GPS. El
  // consentimiento se sigue enviando por defecto en useCarWizard para no
  // romper la publicación con el backend actual.

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
});
