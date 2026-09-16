/**
 * `markNotificationAsRead` marca "leído" en el estado local antes de que el
 * POST confirme (optimista) y traga el error con `.catch(() => {})`. Si ese
 * POST sigue en vuelo cuando cae el próximo poll de `cargarNotificaciones`
 * (cada 30s), el poll traía el estado viejo del servidor y lo pisaba sin
 * avisar — la notificación volvía a verse como no leída sin que nada fallara
 * a la vista. Esto verifica que el poll no revierte una marca optimista
 * mientras su confirmación sigue pendiente, y que sí la refleja una vez que
 * la confirmación se resuelve (éxito o fallo definitivo).
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
const mockGetNotificaciones = jest.fn();
const mockMarcarLeida = jest.fn();
jest.mock("@rentacar/mobile-shared/api/client", () => {
  const real = jest.requireActual("@rentacar/mobile-shared/api/client");
  return {
    ...real,
    ApiClient: {
      ...real.ApiClient,
      getMe: (...args) => mockGetMe(...args),
      getAutos: jest.fn(async () => []),
      getReservas: jest.fn(async () => []),
      getNotificaciones: (...args) => mockGetNotificaciones(...args),
      marcarNotificacionLeida: (...args) => mockMarcarLeida(...args),
    },
  };
});

const { AppProvider, useApp } = require("@rentacar/mobile-shared");

const asentar = () => act(() => new Promise((resolve) => setTimeout(resolve, 20)));

// Expone las funciones del contexto en un ref para invocarlas directamente y
// awaitear su promesa de verdad (a diferencia de simular un tap con
// pressText, que no espera el `act()` async que dispara un handler async).
const apiRef = { current: null };
function Sonda() {
  const { notifications, markNotificationAsRead, cargarNotificaciones } = useApp();
  apiRef.current = { markNotificationAsRead, cargarNotificaciones };
  const n1 = notifications.find((n) => n.id === "n1");
  return <Text>{`n1:${n1 ? String(n1.leido) : "ausente"}`}</Text>;
}

let arbolActual = null;

afterEach(() => {
  if (arbolActual) arbolActual.unmount();
  arbolActual = null;
  apiRef.current = null;
});

const montar = () => {
  const tr = renderTree(<AppProvider><Sonda /></AppProvider>);
  arbolActual = tr;
  return tr;
};

beforeEach(() => {
  jest.clearAllMocks();
  mockAuth.onAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: jest.fn() } } });
  mockAuth.getSession.mockResolvedValue({ data: { session: { access_token: "token" } } });
  mockGetMe.mockResolvedValue({ id: "u1", nombre: "Cliente" });
});

describe("AppContext · notificaciones optimistas", () => {
  it("el poll no revierte una marca de leído mientras la confirmación sigue pendiente", async () => {
    mockGetNotificaciones.mockResolvedValue([{ id: "n1", leido: false }]);
    let rejectMarcar;
    mockMarcarLeida.mockImplementation(
      () => new Promise((_resolve, reject) => { rejectMarcar = reject; })
    );

    const tr = montar();
    await asentar();
    expect(textOf(tr)).toContain("n1:false");

    act(() => { apiRef.current.markNotificationAsRead("n1"); });
    expect(textOf(tr)).toContain("n1:true"); // optimista, inmediato

    // El "servidor" (mock) todavía no vio el cambio: si el poll cayera acá
    // tal cual antes, pisaría el optimismo.
    await act(() => apiRef.current.cargarNotificaciones());
    expect(textOf(tr)).toContain("n1:true"); // protegido: la confirmación sigue en vuelo

    // Ahora sí falla definitivamente (agotó los reintentos de ApiClient).
    await act(async () => {
      rejectMarcar(new Error("fallo de red"));
      await Promise.resolve();
      await Promise.resolve();
    });

    // Con la confirmación resuelta (en fallo), un poll posterior SÍ refleja
    // el estado real del servidor — no queda "leído" fantasma para siempre.
    await act(() => apiRef.current.cargarNotificaciones());
    expect(textOf(tr)).toContain("n1:false");
  });

  it("una vez confirmado el POST, el poll refleja el servidor con normalidad", async () => {
    mockGetNotificaciones.mockResolvedValue([{ id: "n1", leido: false }]);
    mockMarcarLeida.mockResolvedValue({ ok: true });

    const tr = montar();
    await asentar();

    await act(async () => {
      apiRef.current.markNotificationAsRead("n1");
      await Promise.resolve();
      await Promise.resolve();
    });

    mockGetNotificaciones.mockResolvedValue([{ id: "n1", leido: true }]);
    await act(() => apiRef.current.cargarNotificaciones());
    expect(textOf(tr)).toContain("n1:true");
  });
});
