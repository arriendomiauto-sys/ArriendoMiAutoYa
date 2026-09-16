/**
 * "Eliminar mi cuenta" en el perfil del dueño solo abría un ticket de
 * soporte genérico. Ahora llama al endpoint real
 * (ApiClient.solicitarEliminacionCuenta) y, si el backend bloquea con 409
 * por reservas activas de su flota, muestra ese motivo en vez del error
 * genérico de red.
 */
import React from "react";
import { act } from "react-test-renderer";
import { OwnerProfileScreen } from "../src/owner/screens/OwnerProfileScreen";
import { renderTree, pressText } from "../test-utils";

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

const mockShowAlert = jest.fn();
jest.mock("@rentacar/mobile-shared/utils/alert", () => ({
  showAlert: (...a) => mockShowAlert(...a),
}));

const mockSolicitarEliminacion = jest.fn(() =>
  Promise.resolve({ solicitado: true, mensaje: "Tu solicitud quedó registrada." })
);
jest.mock("@rentacar/mobile-shared/api/client", () => {
  const real = jest.requireActual("@rentacar/mobile-shared/api/client");
  real.ApiClient.getCalificaciones = jest.fn(() => Promise.resolve([]));
  real.ApiClient.solicitarEliminacionCuenta = (...a) => mockSolicitarEliminacion(...a);
  return { ...real, ApiClient: real.ApiClient };
});

const mockContexto = {
  currentUser: { id: "u-dueno", nombre: "Beto", email: "beto@correo.cl", estado_documentos: "verificado" },
  logout: jest.fn(),
  setMode: jest.fn(),
  isLoggedIn: true,
};
jest.mock("@rentacar/mobile-shared/context/AppContext", () => ({
  useApp: () => mockContexto,
}));

const asentar = () => new Promise((resolve) => setTimeout(resolve, 0));

const montar = async (props) => {
  let tr;
  await act(async () => {
    tr = renderTree(<OwnerProfileScreen cars={[]} {...props} />);
    await asentar();
  });
  return tr;
};

let arbolActual = null;
afterEach(() => {
  if (arbolActual) arbolActual.unmount();
  arbolActual = null;
});

beforeEach(() => {
  mockShowAlert.mockReset();
  mockSolicitarEliminacion.mockClear();
  mockSolicitarEliminacion.mockResolvedValue({ solicitado: true, mensaje: "Tu solicitud quedó registrada." });
});

describe("Perfil dueño · eliminar cuenta", () => {
  it("pide confirmación y, al confirmar, llama al endpoint real de baja", async () => {
    const tr = await montar({});
    arbolActual = tr;

    await act(async () => {
      pressText(tr, "Eliminar mi cuenta");
      await asentar();
    });

    const [titulo, , botones] = mockShowAlert.mock.calls[0];
    expect(titulo).toBe("Eliminar mi cuenta");
    const confirmar = botones.find((b) => b.style === "destructive");

    await act(async () => {
      confirmar.onPress();
      await asentar();
    });

    expect(mockSolicitarEliminacion).toHaveBeenCalledTimes(1);
    expect(mockShowAlert).toHaveBeenLastCalledWith("Solicitud enviada", "Tu solicitud quedó registrada.");
  });

  it("si el backend bloquea con 409 (reservas de su flota), muestra ese motivo", async () => {
    mockSolicitarEliminacion.mockRejectedValue(
      Object.assign(new Error("No puedes eliminar tu cuenta todavía: tienes 2 reserva(s) de tu flota en curso o pendiente(s)."), {
        status: 409,
      })
    );
    const tr = await montar({});
    arbolActual = tr;

    await act(async () => {
      pressText(tr, "Eliminar mi cuenta");
      await asentar();
    });
    const confirmar = mockShowAlert.mock.calls[0][2].find((b) => b.style === "destructive");

    await act(async () => {
      confirmar.onPress();
      await asentar();
    });

    expect(mockShowAlert).toHaveBeenLastCalledWith(
      "Todavía no puedes eliminar tu cuenta",
      expect.stringContaining("2 reserva(s)")
    );
  });
});
