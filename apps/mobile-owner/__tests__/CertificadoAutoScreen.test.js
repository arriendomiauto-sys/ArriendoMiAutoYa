/**
 * El dueño sube el Certificado de anotaciones vigentes de su auto (PDF gratuito del Registro Civil).
 * Sin consentimiento no se sube nada; el resultado del análisis se muestra al instante.
 */
import React from "react";
import { act } from "react-test-renderer";
import { CertificadoAutoScreen } from "@rentacar/mobile-shared/screens/CertificadoAutoScreen";
import { renderTree, textOf, pressText } from "../test-utils";

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

const mockSubir = jest.fn();
jest.mock("@rentacar/mobile-shared/api/client", () => {
  const real = jest.requireActual("@rentacar/mobile-shared/api/client");
  return { ApiClient: { ...real.ApiClient, subirCertificadoAnotaciones: (...a) => mockSubir(...a) } };
});

const mockElegirPdf = jest.fn();
jest.mock("@rentacar/mobile-shared/utils/documentoPdf", () => ({ elegirPdf: (...a) => mockElegirPdf(...a) }));

const mockShowAlert = jest.fn();
jest.mock("@rentacar/mobile-shared/utils/alert", () => ({ showAlert: (...a) => mockShowAlert(...a) }));

const asentar = () => act(() => new Promise((r) => setTimeout(r, 0)));
const auto = { id: "auto-1", marca: "Kia", modelo: "Rio", patente: "KLPW-88" };

let arbol = null;
const montar = async () => {
  arbol = renderTree(<CertificadoAutoScreen auto={auto} onBack={() => {}} />);
  await asentar();
  return arbol;
};

beforeEach(() => {
  jest.clearAllMocks();
  mockElegirPdf.mockResolvedValue({ cancelado: false, uri: "file:///cache/anotaciones.pdf", name: "anotaciones.pdf" });
  mockSubir.mockResolvedValue({ id: "c1", tipo: "anotaciones_vigentes", estado: "revision", motivo: "Falta confirmar el código." });
});

afterEach(() => {
  if (arbol) act(() => arbol.unmount());
  arbol = null;
});

describe("CertificadoAutoScreen", () => {
  it("nombra el auto y explica de dónde sale el certificado", async () => {
    const tr = await montar();

    const t = textOf(tr);
    expect(t).toContain("Kia Rio");
    expect(t).toContain("KLPW-88");
    expect(t).toContain("anotaciones vigentes");
  });

  it("sin consentimiento no sube nada", async () => {
    const tr = await montar();

    act(() => pressText(tr, "Subir certificado"));
    await asentar();

    expect(mockElegirPdf).not.toHaveBeenCalled();
    expect(mockSubir).not.toHaveBeenCalled();
  });

  it("con consentimiento sube el PDF del auto y muestra que quedó en revisión", async () => {
    const tr = await montar();

    act(() => pressText(tr, "Autorizo"));
    act(() => pressText(tr, "Subir certificado"));
    await asentar();
    await asentar();

    expect(mockSubir).toHaveBeenCalledWith("auto-1", {
      archivo: { uri: "file:///cache/anotaciones.pdf", name: "anotaciones.pdf" },
      consentimiento: true,
    });
    expect(textOf(tr)).toContain("En revisión");
  });

  it("un certificado de otra patente se muestra rechazado con el motivo", async () => {
    mockSubir.mockResolvedValue({
      id: "c1", tipo: "anotaciones_vigentes", estado: "rechazado",
      motivo: "El certificado es de otra patente que la del vehículo.",
    });
    const tr = await montar();

    act(() => pressText(tr, "Autorizo"));
    act(() => pressText(tr, "Subir certificado"));
    await asentar();
    await asentar();

    expect(textOf(tr)).toContain("Rechazado");
    expect(textOf(tr)).toContain("otra patente");
  });

  it("si cancela el selector no sube nada", async () => {
    mockElegirPdf.mockResolvedValue({ cancelado: true });
    const tr = await montar();

    act(() => pressText(tr, "Autorizo"));
    act(() => pressText(tr, "Subir certificado"));
    await asentar();

    expect(mockSubir).not.toHaveBeenCalled();
  });

  it("si la subida falla avisa", async () => {
    mockSubir.mockRejectedValue(new Error("El archivo no es un PDF."));
    const tr = await montar();

    act(() => pressText(tr, "Autorizo"));
    act(() => pressText(tr, "Subir certificado"));
    await asentar();

    expect(mockShowAlert).toHaveBeenCalledWith("No se pudo subir", expect.stringContaining("PDF"));
  });
});
