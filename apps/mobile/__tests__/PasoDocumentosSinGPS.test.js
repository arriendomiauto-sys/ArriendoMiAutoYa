/**
 * Limpieza de UI de GPS: el paso de documentos del asistente para publicar
 * ya no muestra la casilla "Autorizo la instalación del GPS" — el módulo se
 * retiró de la interfaz hasta su nueva definición formal.
 */
import React from "react";
import { PasoDocumentos } from "../src/owner/screens/addcar/PasoDocumentos";
import { renderTree, textOf } from "../test-utils";

const wizard = {
  form: { docs: {} },
  validacionDocs: {},
  validandoDoc: null,
  uploadingDoc: null,
  subirDocumento: () => {},
  quitarDocumento: () => {},
  docsCargados: 0,
  setField: () => {},
};

describe("PasoDocumentos · sin GPS", () => {
  it("no muestra la casilla de consentimiento de GPS", () => {
    const t = textOf(renderTree(<PasoDocumentos wizard={wizard} />));
    expect(t).toContain("Documentos del auto");
    expect(t).not.toContain("Autorizo la instalación del GPS");
    expect(t).not.toContain("GPS");
  });
});
