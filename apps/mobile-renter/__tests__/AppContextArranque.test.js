/**
 * Al abrir la app se revisa la sesión guardada. Con mala señal esa revisión
 * puede quedar colgada o fallar por la red: eso NO significa que la persona
 * haya perdido su sesión, así que no se la puede mandar al login como si así
 * fuera. `sesionEstado` distingue "revisando", "listo" y "sin_conexion", y
 * `reintentarSesion` repite la revisión.
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
jest.mock("@rentacar/mobile-shared/api/client", () => {
  const real = jest.requireActual("@rentacar/mobile-shared/api/client");
  return {
    ...real,
    ApiClient: {
      ...real.ApiClient,
      getMe: (...args) => mockGetMe(...args),
      getAutos: jest.fn(async () => []),
    },
  };
});

// require() explícito y DESPUÉS de armar los mocks (ver sesionInvalida.test.js).
const { AppProvider, useApp } = require("@rentacar/mobile-shared");

const contexto = { current: null };
function Sonda() {
  contexto.current = useApp();
  const { sesionEstado, authLoading, isLoggedIn } = contexto.current;
  return <Text>{`estado:${sesionEstado} authLoading:${authLoading} isLoggedIn:${isLoggedIn}`}</Text>;
}

let arbolActual = null;
afterEach(() => {
  if (arbolActual) arbolActual.unmount();
  arbolActual = null;
  jest.useRealTimers();
});

const montar = () => {
  const tr = renderTree(<AppProvider><Sonda /></AppProvider>);
  arbolActual = tr;
  return tr;
};
const asentar = () => act(() => new Promise((resolve) => setTimeout(resolve, 0)));
const avanzar = (ms) =>
  act(async () => {
    jest.advanceTimersByTime(ms);
  });

const errorDeRed = () => Object.assign(new Error("fetch failed"), { name: "AuthRetryableFetchError" });

beforeEach(() => {
  jest.clearAllMocks();
  mockAuth.onAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: jest.fn() } } });
});

describe("Revisión de la sesión al abrir la app", () => {
  it("mientras revisa está 'revisando' y cargando", async () => {
    mockAuth.getSession.mockReturnValue(new Promise(() => {}));
    const tr = montar();
    await asentar();
    expect(textOf(tr)).toContain("estado:revisando authLoading:true");
  });

  it("con una sesión válida termina 'listo' y dentro", async () => {
    mockAuth.getSession.mockResolvedValue({ data: { session: { access_token: "t" } } });
    mockGetMe.mockResolvedValue({ id: "u1" });
    const tr = montar();
    await asentar();
    expect(textOf(tr)).toContain("estado:listo authLoading:false isLoggedIn:true");
  });

  it("sin sesión guardada termina 'listo' y fuera", async () => {
    mockAuth.getSession.mockResolvedValue({ data: { session: null }, error: null });
    const tr = montar();
    await asentar();
    expect(textOf(tr)).toContain("estado:listo authLoading:false isLoggedIn:false");
  });

  it("un error que no es de red (sesión revocada) sí cuenta como sin sesión", async () => {
    mockAuth.getSession.mockResolvedValue({
      data: { session: null },
      error: Object.assign(new Error("Invalid Refresh Token"), { name: "AuthApiError" }),
    });
    const tr = montar();
    await asentar();
    expect(textOf(tr)).toContain("estado:listo authLoading:false isLoggedIn:false");
  });

  it("un fallo de red al recuperar la sesión NO manda al login: queda 'sin_conexion'", async () => {
    mockAuth.getSession.mockResolvedValue({ data: { session: null }, error: errorDeRed() });
    const tr = montar();
    await asentar();
    expect(textOf(tr)).toContain("estado:sin_conexion authLoading:false isLoggedIn:false");
    expect(mockAuth.signOut).not.toHaveBeenCalled();
  });

  it("si getSession se cuelga, a los 8 s queda 'sin_conexion' (ni antes ni después)", async () => {
    jest.useFakeTimers();
    mockAuth.getSession.mockReturnValue(new Promise(() => {}));
    const tr = montar();

    await avanzar(7999);
    expect(textOf(tr)).toContain("estado:revisando authLoading:true");

    await avanzar(1);
    expect(textOf(tr)).toContain("estado:sin_conexion authLoading:false isLoggedIn:false");
    expect(mockAuth.signOut).not.toHaveBeenCalled();
  });

  it("reintentarSesion vuelve a 'revisando' y, si ahora hay red, entra con la sesión guardada", async () => {
    mockAuth.getSession.mockResolvedValueOnce({ data: { session: null }, error: errorDeRed() });
    const tr = montar();
    await asentar();
    expect(textOf(tr)).toContain("estado:sin_conexion");

    let liberar;
    mockAuth.getSession.mockReturnValueOnce(new Promise((resolve) => (liberar = resolve)));
    mockGetMe.mockResolvedValue({ id: "u1" });
    act(() => {
      contexto.current.reintentarSesion();
    });
    expect(textOf(tr)).toContain("estado:revisando authLoading:true");

    await act(async () => liberar({ data: { session: { access_token: "t" } } }));
    await asentar();
    expect(textOf(tr)).toContain("estado:listo authLoading:false isLoggedIn:true");
  });

  it("reintentarSesion que vuelve a fallar deja 'sin_conexion' otra vez", async () => {
    mockAuth.getSession.mockResolvedValue({ data: { session: null }, error: errorDeRed() });
    const tr = montar();
    await asentar();

    await act(async () => {
      contexto.current.reintentarSesion();
    });
    await asentar();

    expect(textOf(tr)).toContain("estado:sin_conexion authLoading:false");
    expect(mockAuth.getSession).toHaveBeenCalledTimes(2);
  });
});
