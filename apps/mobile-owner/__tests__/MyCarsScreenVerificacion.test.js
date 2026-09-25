/**
 * "Mi flota": cada auto tiene un acceso para subir el certificado de anotaciones vigentes y verificarlo.
 */
import React from "react";
import { act } from "react-test-renderer";
import { MyCarsScreen } from "../src/owner/screens/MyCarsScreen";
import { renderTree, pressText } from "../test-utils";

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

// La vista previa abre el visor de fotos, que en la app vive en el
// PhotoViewerProvider de App.js; acá no se monta.
jest.mock("@rentacar/mobile-shared", () => ({
  ...jest.requireActual("@rentacar/mobile-shared"),
  usePhotoViewer: () => jest.fn(),
}));

const auto = { id: "auto-1", marca: "Kia", modelo: "Rio", anio: 2022, tarifa_dia: 30000, estado: "activo",
               documentos_verificados: false, fotos: [] };

describe("Mi Flota · verificación del auto", () => {
  it("el botón 'Verificar' abre la pantalla del auto correspondiente", () => {
    const onOpenVerificacion = jest.fn();
    const tr = renderTree(
      <MyCarsScreen cars={[auto]} setCars={() => {}} onAddNewCar={() => {}} identidadVerificada
                    onOpenVerificacion={onOpenVerificacion} />
    );

    act(() => pressText(tr, "Verificar"));

    expect(onOpenVerificacion).toHaveBeenCalledWith(auto);
  });
});
