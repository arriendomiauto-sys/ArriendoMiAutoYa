import React from "react";
import { CarDetailScreen } from "../src/renter/screens/CarDetailScreen";
import { renderTree, textOf, pressText } from "../test-utils";
import { validarLicenciaParaAuto } from "@rentacar/mobile-shared";

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

describe("validarLicenciaParaAuto - Reglas por categoría", () => {
  it("valida correctamente la licencia Clase B para autos económicos", () => {
    const res = validarLicenciaParaAuto("economico", {
      licencia_clase: "B",
      licencia_estado: "verificada",
      antiguedad_licencia_anios: 2,
      edad: 25,
    });
    expect(res.valida).toBe(true);
    expect(res.requisito).toContain("Clase B");
  });

  it("rechaza si la licencia no está verificada o aprobada", () => {
    const res = validarLicenciaParaAuto("economico", {
      licencia_clase: "B",
      licencia_estado: "pendiente",
    });
    expect(res.valida).toBe(false);
    expect(res.motivo).toContain("verificada");
  });

  it("rechaza categoría camioneta si no cumple edad mínima (21 años)", () => {
    const res = validarLicenciaParaAuto("camioneta", {
      licencia_clase: "B",
      licencia_estado: "verificada",
      antiguedad_licencia_anios: 1,
      edad: 19,
    });
    expect(res.valida).toBe(false);
    expect(res.motivo).toContain("edad mínima de 21 años");
  });

  it("rechaza categoría premium si no cumple 2 años de antigüedad de licencia", () => {
    const res = validarLicenciaParaAuto("premium", {
      licencia_clase: "B",
      licencia_estado: "verificada",
      antiguedad_licencia_anios: 0.5,
      edad: 26,
    });
    expect(res.valida).toBe(false);
    expect(res.motivo).toContain("al menos 2 años de antigüedad");
  });
});

describe("CarDetailScreen - Sellos de Confianza y Requisitos de Licencia", () => {
  const car = {
    id: "c-premium-1",
    marca: "BMW",
    modelo: "Serie 3",
    anio: 2024,
    categoria: "premium",
    tarifa_dia: 180000,
    ubicacion_base: "Santiago",
    fotos: ["https://example.com/bmw.jpg"],
    doc_historial_vehicular_url: "https://example.com/historial.pdf",
  };

  it("muestra la tarjeta de Requisito de Conductor y los Sellos de Garantía y Protección", () => {
    const tr = renderTree(
      <CarDetailScreen car={car} onBack={() => {}} onProceedToPayment={() => {}} />
    );
    const txt = textOf(tr);
    expect(txt).toContain("Requisito de Conductor");
    expect(txt).toContain("Garantías y Protección");
    expect(txt).toContain("Seguro P2P con deducible fijado en 15 UF");
    expect(txt).toContain("SOAP y Permiso de circulación vigentes");
    expect(txt).toContain("Revisión técnica y emisión de gases al día");
    expect(txt).toContain("Historial vehicular verificado");
    expect(txt).toContain("Contrato digital con firma electrónica y check-in fotográfico de 9 puntos");
  });
});
