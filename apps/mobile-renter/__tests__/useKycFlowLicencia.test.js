/**
 * BUG-039: `licenseValid` arrancaba en true solo si `licencia_estado` era
 * "aprobada", un valor que el backend nunca escribe en ese campo (usa
 * "verificada", "revision", "rechazada"; "aprobada" es del veredicto de Didit).
 */
import React from "react";
import { useKycFlow } from "@rentacar/mobile-shared/auth/kyc/useKycFlow";
import { renderTree } from "../test-utils";

let mockUsuario = {};
jest.mock("@rentacar/mobile-shared/context/AppContext", () => ({
  useApp: () => ({
    currentUser: mockUsuario,
    completeEnrolment: jest.fn(),
    syncProfile: jest.fn(),
  }),
}));

function licenciaValidaPara(usuario) {
  mockUsuario = usuario;
  let flujo;
  function Sonda() {
    flujo = useKycFlow({ role: "renter", onComplete: () => {}, onBack: () => {} });
    return null;
  }
  renderTree(<Sonda />);
  return flujo.verifiedData.licenseValid;
}

describe("useKycFlow · licencia ya verificada al abrir el flujo", () => {
  it("es válida cuando el backend la marcó 'verificada'", () => {
    expect(licenciaValidaPara({ licencia_estado: "verificada" })).toBe(true);
  });

  it.each(["revision", "rechazada", "pendiente", null, undefined])(
    "no es válida con licencia_estado=%s",
    (estado) => {
      expect(licenciaValidaPara({ licencia_estado: estado })).toBe(false);
    }
  );

  it("'aprobada' no es un estado de licencia y no la da por válida", () => {
    expect(licenciaValidaPara({ licencia_estado: "aprobada" })).toBe(false);
  });
});
