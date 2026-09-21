/**
 * Pantalla de antecedentes: la persona sube los dos certificados oficiales gratuitos del Registro
 * Civil (antecedentes y hoja de vida del conductor) en PDF. Sin consentimiento no se sube nada.
 */
import React from "react";
import { Linking } from "react-native";
import { act } from "react-test-renderer";
import { AntecedentesScreen } from "@rentacar/mobile-shared/screens/AntecedentesScreen";
import { renderTree, textOf, pressText } from "../test-utils";

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

const mockGetEstado = jest.fn();
const mockSubir = jest.fn();
jest.mock("@rentacar/mobile-shared/api/client", () => {
  const real = jest.requireActual("@rentacar/mobile-shared/api/client");
  return {
    ApiClient: {
      ...real.ApiClient,
      getEstadoAntecedentes: (...a) => mockGetEstado(...a),
      subirCertificadoAntecedente: (...a) => mockSubir(...a),
    },
  };
});

const mockElegirPdf = jest.fn();
jest.mock("@rentacar/mobile-shared/utils/documentoPdf", () => ({
  elegirPdf: (...a) => mockElegirPdf(...a),
}));

const mockShowAlert = jest.fn();
jest.mock("@rentacar/mobile-shared/utils/alert", () => ({
  showAlert: (...a) => mockShowAlert(...a),
}));

const asentar = () => act(() => new Promise((r) => setTimeout(r, 0)));

const estado = (estadoGeneral, antecedentes = "sin_subir", hoja = "sin_subir", motivo = null) => ({
  estado: estadoGeneral,
  obligatorio: true,
  documentos: [
    { tipo: "antecedentes", estado: antecedentes, motivo, subido_en: null, vence_en: null },
    { tipo: "hoja_vida", estado: hoja, motivo: null, subido_en: null, vence_en: null },
  ],
});

let arbol = null;
const montar = async () => {
  arbol = renderTree(<AntecedentesScreen onBack={() => {}} />);
  await asentar();
  return arbol;
};

beforeEach(() => {
  jest.clearAllMocks();
  mockGetEstado.mockResolvedValue(estado("pendiente"));
  mockElegirPdf.mockResolvedValue({ cancelado: false, uri: "file:///cache/cert.pdf", name: "cert.pdf" });
  mockSubir.mockResolvedValue({ id: "c1", tipo: "antecedentes", estado: "revision", motivo: null });
});

afterEach(() => {
  if (arbol) act(() => arbol.unmount());
  arbol = null;
});

describe("AntecedentesScreen", () => {
  it("muestra los dos certificados como 'Sin subir' y explica que son gratis", async () => {
    const tr = await montar();

    const t = textOf(tr);
    expect(t).toContain("Certificado de antecedentes");
    expect(t).toContain("Hoja de vida del conductor");
    expect(t).toContain("Sin subir");
    expect(t).toContain("gratis");
  });

  it("sin consentimiento no abre el selector ni sube nada", async () => {
    const tr = await montar();

    act(() => pressText(tr, "Subir antecedentes"));
    await asentar();

    expect(mockElegirPdf).not.toHaveBeenCalled();
    expect(mockSubir).not.toHaveBeenCalled();
  });

  it("con consentimiento sube el PDF elegido y refresca el estado", async () => {
    mockGetEstado
      .mockResolvedValueOnce(estado("pendiente"))
      .mockResolvedValueOnce(estado("revision", "revision"));
    const tr = await montar();

    act(() => pressText(tr, "Autorizo"));
    act(() => pressText(tr, "Subir antecedentes"));
    await asentar();
    await asentar();

    expect(mockSubir).toHaveBeenCalledWith({
      tipo: "antecedentes",
      archivo: { uri: "file:///cache/cert.pdf", name: "cert.pdf" },
      consentimiento: true,
    });
    expect(textOf(tr)).toContain("En revisión");
  });

  it("cada botón sube su propio tipo de certificado", async () => {
    const tr = await montar();

    act(() => pressText(tr, "Autorizo"));
    act(() => pressText(tr, "Subir hoja de vida"));
    await asentar();

    expect(mockSubir).toHaveBeenCalledWith(expect.objectContaining({ tipo: "hoja_vida" }));
  });

  it("si cancela el selector no se sube nada", async () => {
    mockElegirPdf.mockResolvedValue({ cancelado: true });
    const tr = await montar();

    act(() => pressText(tr, "Autorizo"));
    act(() => pressText(tr, "Subir antecedentes"));
    await asentar();

    expect(mockSubir).not.toHaveBeenCalled();
  });

  it("un certificado rechazado muestra el motivo para poder corregirlo", async () => {
    mockSubir.mockResolvedValue({
      id: "c1", tipo: "antecedentes", estado: "rechazado",
      motivo: "El certificado es de otra persona: el RUT no coincide con el de tu cuenta.",
    });
    mockGetEstado
      .mockResolvedValueOnce(estado("pendiente"))
      .mockResolvedValueOnce(estado("pendiente", "rechazado", "sin_subir", "El certificado es de otra persona: el RUT no coincide con el de tu cuenta."));
    const tr = await montar();

    act(() => pressText(tr, "Autorizo"));
    act(() => pressText(tr, "Subir antecedentes"));
    await asentar();
    await asentar();

    expect(textOf(tr)).toContain("Rechazado");
    expect(textOf(tr)).toContain("otra persona");
  });

  it("si la subida falla avisa con el mensaje del servidor", async () => {
    mockSubir.mockRejectedValue(new Error("El archivo no es un PDF."));
    const tr = await montar();

    act(() => pressText(tr, "Autorizo"));
    act(() => pressText(tr, "Subir antecedentes"));
    await asentar();

    expect(mockShowAlert).toHaveBeenCalledWith("No se pudo subir", expect.stringContaining("PDF"));
  });

  it("aprobado se muestra como habilitado", async () => {
    mockGetEstado.mockResolvedValue(estado("limpio", "aprobado", "aprobado"));
    const tr = await montar();

    expect(textOf(tr)).toContain("Antecedentes aprobados");
  });

  it("una cuenta bloqueada manda a hablar con soporte", async () => {
    mockGetEstado.mockResolvedValue(estado("bloqueado", "rechazado", "rechazado"));
    const tr = await montar();

    expect(textOf(tr)).toContain("soporte");
  });

  it("el enlace abre registrocivil.cl", async () => {
    const abrir = jest.spyOn(Linking, "openURL").mockResolvedValue();
    const tr = await montar();

    act(() => pressText(tr, "Abrir registrocivil.cl"));

    expect(abrir).toHaveBeenCalledWith(expect.stringContaining("registrocivil.cl"));
    abrir.mockRestore();
  });
});
