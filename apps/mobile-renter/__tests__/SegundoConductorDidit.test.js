/**
 * El segundo conductor verifica identidad (cédula + selfie) Y licencia de
 * conducir con Didit, cada una en su propia sesión hosted e independiente
 * entre sí. El nombre ya no se pide a mano: se crea el registro vacío y
 * Didit lo completa al aprobar la identidad. La captura manual + OCR casero
 * sigue existiendo como respaldo para cada una, solo si Didit falla o no
 * está disponible.
 */
import React from "react";
import { act } from "react-test-renderer";
import { SegundoConductorModal } from "@rentacar/mobile-shared/screens/SegundoConductorModal";
import { renderTree, textOf, pressText } from "../test-utils";

const mockAsignar = jest.fn();
const mockObtener = jest.fn();
const mockActualizar = jest.fn();
const mockCrearSesion = jest.fn();
const mockCrearSesionLicencia = jest.fn();

jest.mock("@rentacar/mobile-shared/api/client", () => {
  const real = jest.requireActual("@rentacar/mobile-shared/api/client");
  return {
    ApiClient: {
      ...real.ApiClient,
      asignarSegundoConductor: (...a) => mockAsignar(...a),
      obtenerSegundoConductor: (...a) => mockObtener(...a),
      actualizarSegundoConductor: (...a) => mockActualizar(...a),
      crearSesionVerificacionSegundoConductor: (...a) => mockCrearSesion(...a),
      crearSesionVerificacionLicenciaSegundoConductor: (...a) => mockCrearSesionLicencia(...a),
    },
  };
});

const mockShowAlert = jest.fn();
jest.mock("@rentacar/mobile-shared/utils/alert", () => ({
  showAlert: (...a) => mockShowAlert(...a),
}));

const asentar = () => new Promise((r) => setTimeout(r, 0));

let arbolActual = null;
afterEach(() => {
  if (arbolActual) arbolActual.unmount();
  arbolActual = null;
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe("SegundoConductorModal · identidad con Didit", () => {
  it("no pide nombre: crea al conductor vacío y abre la sesión de Didit al tocar 'Verificar identidad'", async () => {
    mockAsignar.mockResolvedValue({ id: "cond-1", estado_kyc: "pendiente" });
    mockCrearSesion.mockResolvedValue({ url: "https://verify.didit.me/sess-1", session_id: "sess-1" });
    mockObtener.mockResolvedValue({
      id: "cond-1", estado_kyc: "pendiente", verificacion_externa_estado: "pendiente",
    });

    const tr = renderTree(
      <SegundoConductorModal visible reservaId="res-1" onClose={() => {}} onSaved={() => {}} />
    );
    arbolActual = tr;

    expect(textOf(tr)).not.toContain("Nombre completo");

    await act(async () => {
      pressText(tr, "Verificar identidad con Didit");
      await asentar();
    });

    expect(mockAsignar).toHaveBeenCalledWith("res-1", { nombre: "" });
    expect(mockCrearSesion).toHaveBeenCalledWith("res-1", "renter");

    const WebBrowser = require("expo-web-browser");
    expect(WebBrowser.openAuthSessionAsync).toHaveBeenCalledWith(
      "https://verify.didit.me/sess-1",
      "arriendatuauto://kyc-retorno"
    );
    expect(mockObtener).toHaveBeenCalledWith("res-1");
  });

  it("no vuelve a crear al conductor si ya existe (edición)", async () => {
    mockCrearSesion.mockResolvedValue({ url: "https://verify.didit.me/sess-2", session_id: "sess-2" });
    mockObtener.mockResolvedValue({ id: "cond-1", estado_kyc: "pendiente", verificacion_externa_estado: "aprobada" });

    const tr = renderTree(
      <SegundoConductorModal
        visible
        reservaId="res-1"
        onClose={() => {}}
        onSaved={() => {}}
        initialData={{ id: "cond-1", nombre: "Carlos Segundo", estado_kyc: "pendiente" }}
      />
    );
    arbolActual = tr;

    await act(async () => {
      pressText(tr, "Verificar identidad con Didit");
      await asentar();
    });

    expect(mockAsignar).not.toHaveBeenCalled();
    expect(mockCrearSesion).toHaveBeenCalledWith("res-1", "renter");
  });

  it("si la identidad ya está aprobada, no muestra el botón de Didit ni la captura manual", async () => {
    const tr = renderTree(
      <SegundoConductorModal
        visible
        reservaId="res-1"
        onClose={() => {}}
        initialData={{
          id: "cond-1", nombre: "Carlos Segundo", estado_kyc: "pendiente",
          verificacion_externa_estado: "aprobada",
        }}
      />
    );
    arbolActual = tr;
    await act(async () => {
      await asentar();
    });

    expect(textOf(tr)).not.toContain("Verificar identidad con Didit");
    expect(textOf(tr)).not.toContain("Escanear Frente");
    expect(textOf(tr)).toContain("Identidad confirmada por Didit.");
  });

  it("si Didit falla, ofrece caer a la captura manual", async () => {
    mockAsignar.mockResolvedValue({ id: "cond-1", estado_kyc: "pendiente" });
    mockCrearSesion.mockRejectedValue(new Error("La verificación con proveedor externo no está habilitada."));

    const tr = renderTree(
      <SegundoConductorModal visible reservaId="res-1" onClose={() => {}} onSaved={() => {}} />
    );
    arbolActual = tr;

    await act(async () => {
      pressText(tr, "Verificar identidad con Didit");
      await asentar();
    });

    expect(mockShowAlert).toHaveBeenCalledWith(
      "No se pudo verificar con Didit",
      expect.any(String),
      expect.arrayContaining([expect.objectContaining({ text: "Usar fotos manuales" })])
    );

    // Simula al usuario eligiendo el fallback.
    const botones = mockShowAlert.mock.calls[0][2];
    const fallback = botones.find((b) => b.text === "Usar fotos manuales");
    await act(async () => {
      fallback.onPress();
      await asentar();
    });

    expect(textOf(tr)).toContain("Escanear Frente");
    expect(textOf(tr)).toContain("Tomar Selfie Biométrica");
  });
});

describe("SegundoConductorModal · licencia con Didit", () => {
  it("abre la sesión de Didit de licencia al tocar 'Verificar licencia con Didit'", async () => {
    mockCrearSesionLicencia.mockResolvedValue({ url: "https://verify.didit.me/sess-lic-1", session_id: "sess-lic-1" });
    mockObtener.mockResolvedValue({
      id: "cond-1", estado_kyc: "pendiente", licencia_verificacion_externa_estado: "pendiente",
    });

    const tr = renderTree(
      <SegundoConductorModal
        visible
        reservaId="res-1"
        onClose={() => {}}
        onSaved={() => {}}
        initialData={{ id: "cond-1", nombre: "Carlos Segundo", estado_kyc: "pendiente" }}
      />
    );
    arbolActual = tr;

    await act(async () => {
      pressText(tr, "Verificar licencia con Didit");
      await asentar();
    });

    expect(mockCrearSesionLicencia).toHaveBeenCalledWith("res-1", "renter");

    const WebBrowser = require("expo-web-browser");
    expect(WebBrowser.openAuthSessionAsync).toHaveBeenCalledWith(
      "https://verify.didit.me/sess-lic-1",
      "arriendatuauto://kyc-retorno"
    );
    expect(mockObtener).toHaveBeenCalledWith("res-1");
  });

  it("si la licencia ya está verificada por Didit, no pide escanearla a mano", async () => {
    const tr = renderTree(
      <SegundoConductorModal
        visible
        reservaId="res-1"
        onClose={() => {}}
        initialData={{
          id: "cond-1", nombre: "Carlos Segundo", estado_kyc: "pendiente",
          licencia_verificacion_externa_estado: "aprobada",
        }}
      />
    );
    arbolActual = tr;
    await act(async () => {
      await asentar();
    });

    expect(textOf(tr)).not.toContain("Verificar licencia con Didit");
    expect(textOf(tr)).not.toContain("Escanear licencia");
    expect(textOf(tr)).toContain("Licencia confirmada por Didit.");
  });

  it("si la licencia se subió a mano (Didit no la verificó), se guarda por captura manual con actualizarSegundoConductor", async () => {
    mockActualizar.mockResolvedValue({ estado_kyc: "verificado" });

    const tr = renderTree(
      <SegundoConductorModal
        visible
        reservaId="res-1"
        onClose={() => {}}
        onSaved={() => {}}
        initialData={{
          id: "cond-1", nombre: "Carlos Segundo", estado_kyc: "pendiente",
          verificacion_externa_estado: "aprobada", licencia_url: "https://ejemplo.com/licencia.jpg",
        }}
      />
    );
    arbolActual = tr;
    await act(async () => {
      await asentar();
    });

    // Con licencia_url ya presente y sin aprobación de Didit, el modal
    // reabre directo en modo manual (no pide tocar el botón de Didit de nuevo).
    expect(textOf(tr)).toContain("✓ Licencia escaneada (cambiar)");

    await act(async () => {
      pressText(tr, "Guardar verificación");
      await asentar();
    });

    expect(mockActualizar).toHaveBeenCalledWith(
      "res-1",
      expect.objectContaining({ licencia_url: "https://ejemplo.com/licencia.jpg" })
    );
  });
});
