/**
 * Toggle de bloqueo biométrico en el perfil: solo se ofrece si el teléfono
 * tiene Face ID/huella configurada, y activarlo exige antes una
 * autenticación exitosa — si no, quedaría un candado que nadie puede abrir.
 */
import React from "react";
import { act } from "react-test-renderer";
import { RenterProfileScreen } from "../src/renter/screens/RenterProfileScreen";
import { renderTree, textOf, pressText } from "../test-utils";

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

const mockHasHardware = jest.fn();
const mockIsEnrolled = jest.fn();
const mockAuthenticate = jest.fn();
jest.mock("expo-local-authentication", () => ({
  hasHardwareAsync: (...a) => mockHasHardware(...a),
  isEnrolledAsync: (...a) => mockIsEnrolled(...a),
  authenticateAsync: (...a) => mockAuthenticate(...a),
}));

const mockContexto = {
  currentUser: { id: "u1", nombre: "Ana", estado_documentos: "verificado" },
  reservations: [],
  paymentMethods: [],
  logout: jest.fn(),
  setMode: jest.fn(),
  isLoggedIn: true,
};
jest.mock("@rentacar/mobile-shared/context/AppContext", () => ({
  useApp: () => mockContexto,
}));

const mockGetCalificaciones = jest.fn(() => Promise.resolve([]));
jest.mock("@rentacar/mobile-shared/api/client", () => {
  const real = jest.requireActual("@rentacar/mobile-shared/api/client");
  real.ApiClient.getCalificaciones = (...a) => mockGetCalificaciones(...a);
  return { ...real, ApiClient: real.ApiClient };
});

const asentar = () => new Promise((resolve) => setTimeout(resolve, 0));

const montar = async () => {
  let tr;
  await act(async () => {
    tr = renderTree(<RenterProfileScreen />);
    await asentar();
  });
  return tr;
};

beforeEach(async () => {
  mockHasHardware.mockReset();
  mockIsEnrolled.mockReset();
  mockAuthenticate.mockReset();
  mockContexto.logout.mockClear();
  const AsyncStorage = require("@react-native-async-storage/async-storage");
  await (AsyncStorage.default || AsyncStorage).clear();
});

describe("Perfil · bloqueo biométrico", () => {
  it("sin hardware biométrico, no se ofrece la opción", async () => {
    mockHasHardware.mockResolvedValue(false);
    mockIsEnrolled.mockResolvedValue(false);

    const tr = await montar();
    expect(textOf(tr)).not.toContain("Bloqueo con Face ID");
  });

  it("con hardware disponible, se puede activar tras autenticar con éxito", async () => {
    mockHasHardware.mockResolvedValue(true);
    mockIsEnrolled.mockResolvedValue(true);
    mockAuthenticate.mockResolvedValue({ success: true });

    const tr = await montar();
    expect(textOf(tr)).toContain("Desactivado");

    await act(async () => {
      pressText(tr, "Bloqueo con Face ID / huella");
      await asentar();
    });

    expect(mockAuthenticate).toHaveBeenCalledTimes(1);
    expect(textOf(tr)).toContain("Activado");
  });

  it("si la autenticación falla, no se activa el bloqueo", async () => {
    mockHasHardware.mockResolvedValue(true);
    mockIsEnrolled.mockResolvedValue(true);
    mockAuthenticate.mockResolvedValue({ success: false });

    const tr = await montar();
    await act(async () => {
      pressText(tr, "Bloqueo con Face ID / huella");
      await asentar();
    });

    expect(textOf(tr)).toContain("Desactivado");
  });
});
