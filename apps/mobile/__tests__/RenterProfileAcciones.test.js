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

jest.mock("expo-local-authentication", () => ({
  hasHardwareAsync: jest.fn(async () => false),
  isEnrolledAsync: jest.fn(async () => false),
  authenticateAsync: jest.fn(async () => ({ success: false })),
}));

const mockShowAlert = jest.fn();
jest.mock("@rentacar/mobile-shared/utils/alert", () => ({
  showAlert: (...a) => mockShowAlert(...a),
}));

const mockCrearTicket = jest.fn(() => Promise.resolve({ id: "t1" }));
jest.mock("@rentacar/mobile-shared/api/client", () => {
  const real = jest.requireActual("@rentacar/mobile-shared/api/client");
  real.ApiClient.getCalificaciones = jest.fn(() => Promise.resolve([]));
  real.ApiClient.crearTicketSoporte = (...a) => mockCrearTicket(...a);
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
  mockCrearTicket.mockClear();
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

  it("'Eliminar mi cuenta' pide confirmación y, al confirmar, abre un ticket de soporte", async () => {
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

    expect(mockCrearTicket).toHaveBeenCalledTimes(1);
    expect(mockCrearTicket.mock.calls[0][0]).toMatch(/eliminaci[oó]n de cuenta/i);
  });
});
