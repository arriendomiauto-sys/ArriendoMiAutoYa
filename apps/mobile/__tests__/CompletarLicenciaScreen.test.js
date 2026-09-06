/**
 * Mini-flujo de licencia: un usuario ya verificado como dueño que quiere
 * arrendar fotografía SOLO su licencia. La foto se sube y luego se envía a
 * validar con `completarLicencia`. Antes la subida no salía del teléfono
 * (ver subirLicenciaXHR.test.js) y el flujo quedaba trancado.
 */
import React from "react";
import { act } from "react-test-renderer";
import { CompletarLicenciaScreen } from "@rentacar/mobile-shared/auth/screens/CompletarLicenciaScreen";
import { renderTree, textOf, pressText } from "../test-utils";

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

// La cámara guiada: se reemplaza por un stub que expone `onCaptured`.
let capturarFoto;
jest.mock("@rentacar/mobile-shared/components/DocumentCameraModal", () => ({
  DocumentCameraModal: ({ visible, onCaptured }) => {
    capturarFoto = onCaptured;
    return null;
  },
}));

const mockSubir = jest.fn(async () => "https://storage/kyc/licencia.jpg");
jest.mock("@rentacar/mobile-shared/utils/imagenes", () => ({
  subirImagenOptimizada: (...a) => mockSubir(...a),
  AJUSTES_DOCUMENTO: { maxAncho: 2000, calidad: 0.85 },
}));

const mockCompletarLicencia = jest.fn(async () => ({ licencia_estado: "verificada" }));
jest.mock("@rentacar/mobile-shared/api/client", () => {
  const real = jest.requireActual("@rentacar/mobile-shared/api/client");
  real.ApiClient.completarLicencia = (...a) => mockCompletarLicencia(...a);
  return { ...real, ApiClient: real.ApiClient };
});

const mockSyncProfile = jest.fn(async () => {});
const contexto = {
  currentUser: { id: "u1", nombre: "Pía", tipo_documento: "rut", estado_documentos: "verificado" },
  syncProfile: mockSyncProfile,
};
jest.mock("@rentacar/mobile-shared/context/AppContext", () => ({
  useApp: () => contexto,
}));

const asentar = () => new Promise((r) => setTimeout(r, 0));

beforeEach(() => {
  mockSubir.mockClear();
  mockCompletarLicencia.mockClear();
  mockSyncProfile.mockClear();
  contexto.currentUser = { id: "u1", nombre: "Pía", tipo_documento: "rut", estado_documentos: "verificado" };
});

describe("CompletarLicenciaScreen", () => {
  it("sube la foto de la licencia y la envía a validar", async () => {
    let tr;
    await act(async () => {
      tr = renderTree(<CompletarLicenciaScreen onDone={() => {}} onCancel={() => {}} />);
      await asentar();
    });

    // Antes de capturar, el botón dice fotografiar y no se puede enviar.
    expect(textOf(tr)).toContain("Fotografiar licencia de conducir");

    // Abrir la cámara (fija el slot) y luego confirmar la foto.
    await act(async () => {
      pressText(tr, "Fotografiar licencia de conducir");
      await asentar();
    });
    await act(async () => {
      capturarFoto("file:///tmp/licencia.jpg");
      await asentar();
    });

    expect(mockSubir).toHaveBeenCalledTimes(1);
    const [uri, opts] = mockSubir.mock.calls[0];
    expect(uri).toBe("file:///tmp/licencia.jpg");
    expect(opts.bucket).toBe("documentos-kyc");
    expect(textOf(tr)).toContain("Licencia capturada");

    // Enviar a validar.
    await act(async () => {
      pressText(tr, "Validar licencia");
      await asentar();
    });

    expect(mockCompletarLicencia).toHaveBeenCalledTimes(1);
    expect(mockCompletarLicencia.mock.calls[0][0]).toMatchObject({
      licencia_url: "https://storage/kyc/licencia.jpg",
      licencia_pais_emisor: "CL",
    });
  });

  it("no deja enviar si la subida falló (no hay licencia_url)", async () => {
    mockSubir.mockResolvedValueOnce(null);
    let tr;
    await act(async () => {
      tr = renderTree(<CompletarLicenciaScreen onDone={() => {}} onCancel={() => {}} />);
      await asentar();
    });

    await act(async () => {
      pressText(tr, "Fotografiar licencia de conducir");
      await asentar();
    });
    await act(async () => {
      capturarFoto("file:///tmp/licencia.jpg");
      await asentar();
    });

    await act(async () => {
      pressText(tr, "Validar licencia");
      await asentar();
    });

    expect(mockCompletarLicencia).not.toHaveBeenCalled();
  });
});
