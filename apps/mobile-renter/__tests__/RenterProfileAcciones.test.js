/**
 * Accesos del perfil del arrendatario que se agregaron para acortar el flujo:
 * editar los datos de contacto (tocando la cabecera), ver los autos guardados
 * y solicitar la eliminación de la cuenta (requisito de las tiendas de apps).
 */
import React from "react";
import { act } from "react-test-renderer";
import { RenterProfileScreen } from "../src/renter/screens/RenterProfileScreen";
import { renderTree, pressText } from "../test-utils";

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

const mockShowAlert = jest.fn();
jest.mock("@rentacar/mobile-shared/utils/alert", () => ({
  showAlert: (...a) => mockShowAlert(...a),
}));

const mockSolicitarEliminacion = jest.fn(() => Promise.resolve({ solicitado: true, mensaje: "Tu solicitud quedó registrada." }));
jest.mock("@rentacar/mobile-shared/api/client", () => {
  const real = jest.requireActual("@rentacar/mobile-shared/api/client");
  real.ApiClient.getCalificaciones = jest.fn(() => Promise.resolve([]));
  real.ApiClient.solicitarEliminacionCuenta = (...a) => mockSolicitarEliminacion(...a);
  return { ...real, ApiClient: real.ApiClient };
});

const mockContexto = {
  currentUser: { id: "u1", nombre: "Ana", email: "ana@correo.cl", estado_documentos: "verificado" },
  reservations: [],
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
    tr = renderTree(<RenterProfileScreen {...props} />);
    await asentar();
  });
  return tr;
};

beforeEach(() => {
  mockShowAlert.mockReset();
  mockSolicitarEliminacion.mockClear();
});

describe("Perfil arrendatario · accesos nuevos", () => {
  it("tocar la cabecera abre editar perfil", async () => {
    const onOpenEditProfile = jest.fn();
    const tr = await montar({ onOpenEditProfile });

    await act(async () => {
      pressText(tr, "Ana");
      await asentar();
    });

    expect(onOpenEditProfile).toHaveBeenCalledTimes(1);
  });

  it("'Autos guardados' abre la pantalla de favoritos", async () => {
    const onOpenFavorites = jest.fn();
    const tr = await montar({ onOpenFavorites });

    await act(async () => {
      pressText(tr, "Autos guardados");
      await asentar();
    });

    expect(onOpenFavorites).toHaveBeenCalledTimes(1);
  });

  it("'Eliminar mi cuenta' pide confirmación y, al confirmar, llama al endpoint real de baja", async () => {
    const tr = await montar({});

    await act(async () => {
      pressText(tr, "Eliminar mi cuenta");
      await asentar();
    });

    // Primer alert: confirmación destructiva
    expect(mockShowAlert).toHaveBeenCalledTimes(1);
    const [titulo, , botones] = mockShowAlert.mock.calls[0];
    expect(titulo).toBe("Eliminar mi cuenta");
    const confirmar = botones.find((b) => b.style === "destructive");
    expect(confirmar).toBeTruthy();

    await act(async () => {
      confirmar.onPress();
      await asentar();
    });

    expect(mockSolicitarEliminacion).toHaveBeenCalledTimes(1);
    expect(mockShowAlert).toHaveBeenLastCalledWith("Solicitud enviada", "Tu solicitud quedó registrada.");
  });

  it("si el backend bloquea con 409 (arriendos activos), muestra el motivo en vez del error genérico", async () => {
    mockSolicitarEliminacion.mockRejectedValue(
      Object.assign(new Error("No puedes eliminar tu cuenta todavía: tienes 1 arriendo(s) tuyo(s) en curso o pendiente(s)."), {
        status: 409,
      })
    );
    const tr = await montar({});

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
      expect.stringContaining("1 arriendo(s)")
    );
  });
});
