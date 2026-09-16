import React from "react";
import { act } from "react-test-renderer";
import App from "../App";
import { renderTree, textOf } from "../test-utils";

jest.mock("react-native-safe-area-context", () => {
  const React = require("react");
  return {
    SafeAreaProvider: ({ children }) => children,
    SafeAreaView: ({ children }) => children,
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  };
});

const mockUseApp = {
  isLoggedIn: true,
  authLoading: false,
  transition: null,
  currentUser: { id: "u1", nombre: "Marcela" },
  onboardingVisto: true,
};
// App.js importa `verificarMandatoAceptado` desde el barrel
// "@rentacar/mobile-shared", no desde la ruta del submódulo — el mock tiene
// que reemplazarlo ahí, si no App.js sigue viendo la función real.
const mockVerificarMandato = jest.fn();
jest.mock("@rentacar/mobile-shared", () => {
  const real = jest.requireActual("@rentacar/mobile-shared");
  return {
    ...real,
    useApp: () => mockUseApp,
    useVersionCheck: () => ({ bloqueado: false, urlStore: null }),
    useNetworkStatus: () => ({ isConnected: true }),
    verificarMandatoAceptado: (...args) => mockVerificarMandato(...args),
  };
});

const asentar = async () => {
  await act(async () => {
    await Promise.resolve();
  });
};

describe("App (mobile-owner) · gate de mandato", () => {
  it("si nunca aceptó el mandato, lo muestra antes de OwnerApp", async () => {
    mockVerificarMandato.mockResolvedValue(false);

    const tr = renderTree(<App />);
    await asentar();

    expect(textOf(tr)).toContain("Autorización para arrendar tu vehículo");
  });

  it("si ya aceptó el mandato, entra directo a OwnerApp", async () => {
    mockVerificarMandato.mockResolvedValue(true);

    const tr = renderTree(<App />);
    await asentar();

    expect(textOf(tr)).not.toContain("Autorización para arrendar tu vehículo");
  });
});
