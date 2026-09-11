/**
 * `reservations` nunca se poblaba (ningún efecto llamaba getReservas) y
 * `activeReservation` solo se fijaba desde el flujo de pago o al tocar el
 * historial — un arriendo activo desaparecía al reabrir la app y el perfil
 * mostraba "0 arriendos" siempre, aunque hubiera historial real.
 */
import React from "react";
import { Text } from "react-native";
import { act } from "react-test-renderer";
import { renderTree, textOf } from "../test-utils";

const mockAuth = {
  getSession: jest.fn(),
  onAuthStateChange: jest.fn(() => ({ data: { subscription: { unsubscribe: jest.fn() } } })),
  signOut: jest.fn(async () => ({ error: null })),
  startAutoRefresh: jest.fn(),
  stopAutoRefresh: jest.fn(),
};

jest.mock("@supabase/supabase-js", () => ({
  createClient: () => ({ auth: mockAuth }),
}));

const mockGetMe = jest.fn();
const mockGetReservas = jest.fn();
jest.mock("@rentacar/mobile-shared/api/client", () => {
  const real = jest.requireActual("@rentacar/mobile-shared/api/client");
  return {
    ...real,
    ApiClient: {
      ...real.ApiClient,
      getMe: (...args) => mockGetMe(...args),
      getAutos: jest.fn(async () => []),
      getReservas: (...args) => mockGetReservas(...args),
    },
  };
});

const { AppProvider, useApp } = require("@rentacar/mobile-shared");

const asentar = () => act(() => new Promise((resolve) => setTimeout(resolve, 0)));

function Sonda() {
  const { reservations, activeReservation } = useApp();
  return (
    <Text>
      {`total:${reservations.length} activa:${activeReservation?.id || "ninguna"}`}
    </Text>
  );
}

let arbolActual = null;

afterEach(() => {
  if (arbolActual) arbolActual.unmount();
  arbolActual = null;
});

const montar = () => {
  const tr = renderTree(<AppProvider><Sonda /></AppProvider>);
  arbolActual = tr;
  return tr;
};

beforeEach(() => {
  jest.clearAllMocks();
  mockAuth.onAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: jest.fn() } } });
});

describe("AppContext · reservas reales", () => {
  it("carga las reservas del cliente al iniciar sesión", async () => {
    mockAuth.getSession.mockResolvedValue({ data: { session: { access_token: "token" } } });
    mockGetMe.mockResolvedValue({ id: "u1", nombre: "Cliente" });
    mockGetReservas.mockResolvedValue([
      { id: "r1", estado: "finalizada" },
      { id: "r2", estado: "cancelada" },
    ]);

    const tr = montar();
    await asentar();

    expect(mockGetReservas).toHaveBeenCalledWith("cliente");
    expect(textOf(tr)).toContain("total:2");
  });

  it("restaura como activa la primera reserva en_curso o confirmada", async () => {
    mockAuth.getSession.mockResolvedValue({ data: { session: { access_token: "token" } } });
    mockGetMe.mockResolvedValue({ id: "u1", nombre: "Cliente" });
    mockGetReservas.mockResolvedValue([
      { id: "r1", estado: "finalizada" },
      { id: "r2", estado: "en_curso" },
    ]);

    const tr = montar();
    await asentar();

    expect(textOf(tr)).toContain("activa:r2");
  });

  it("sin ninguna reserva activa o confirmada, no fija ninguna como activa", async () => {
    mockAuth.getSession.mockResolvedValue({ data: { session: { access_token: "token" } } });
    mockGetMe.mockResolvedValue({ id: "u1", nombre: "Cliente" });
    mockGetReservas.mockResolvedValue([{ id: "r1", estado: "finalizada" }]);

    const tr = montar();
    await asentar();

    expect(textOf(tr)).toContain("activa:ninguna");
  });

  it("sin sesión no llama a getReservas", async () => {
    mockAuth.getSession.mockResolvedValue({ data: { session: null } });

    montar();
    await asentar();

    expect(mockGetReservas).not.toHaveBeenCalled();
  });
});
