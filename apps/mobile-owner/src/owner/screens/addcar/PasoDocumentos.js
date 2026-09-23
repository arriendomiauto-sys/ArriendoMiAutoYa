import React from "react";
import { ScrollView } from "react-native";
import { TituloPaso, BarraProgreso } from "./comun";
import { RanuraDocumento } from "./RanuraDocumento";
import { DOCS, DOCS_OBLIGATORIOS } from "./useCarWizard";

export function PasoDocumentos({ wizard }) {
  const {
    form,
    validacionDocs,
    validandoDoc,
    uploadingDoc,
    subirDocumento,
    quitarDocumento,
    reintentarValidacion,
    docsCargados,
  } = wizard;

  return (
    <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 40, gap: 12 }} showsVerticalScrollIndicator={false}>
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
          onReintentar={() => reintentarValidacion(doc.key)}
        />
      ))}
    </ScrollView>
  );
}
