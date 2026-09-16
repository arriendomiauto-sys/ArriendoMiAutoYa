/**
 * `onAuthStateChange` reacciona a CUALQUIER cambio de sesión que no pase por
 * login()/loginConProveedor() explícitos — el registro, un magic link, o el
 * propio evento SIGNED_IN que dispara un login normal — llamando a
 * syncProfile() sin esperarlo. Como `isLoggedIn` se pone en true en el mismo
 * tick, RenterApp/OwnerApp montaban de inmediato con currentUser todavía
 * null durante todo el round-trip de GET /usuarios/me: banners de "verifica
 * tu identidad" falsos para gente que YA está verificada, hasta que el
 * perfil terminaba de llegar.
 *
 * `sincronizarSesionConTransicion` unifica esto bajo la misma pantalla de
 * transición que ya usan login/logout: mientras el perfil no llegó, se
 * espera con `transition` puesto, igual que boot.
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

const { AppProvider, useApp } = require("@rentacar/mobile-shared");

const asentar = () => act(() => new Promise((resolve) => setTimeout(resolve, 0)));

function Sonda() {
  const { isLoggedIn, currentUser, transition } = useApp();
  return (
    <Text>
      {`isLoggedIn:${isLoggedIn} currentUser:${currentUser ? "si" : "no"} transition:${!!transition}`}
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

describe("AppContext · transición cubre cualquier cambio de sesión, no solo login()", () => {
  it("un SIGNED_IN disparado por fuera de login() (registro, magic link) tapa el hueco con la transición", async () => {
    mockAuth.getSession.mockResolvedValue({ data: { session: null } });

    const tr = montar();
    await asentar();
    expect(textOf(tr)).toContain("isLoggedIn:false");

    // Captura el callback que AppContext le pasó a onAuthStateChange, como
    // haría el propio cliente de Supabase al detectar la sesión nueva.
    const callback = mockAuth.onAuthStateChange.mock.calls[0][0];

    let liberarGetMe;
    mockGetMe.mockReturnValue(new Promise((resolve) => { liberarGetMe = resolve; }));

    act(() => {
      callback("SIGNED_IN", { access_token: "tok-nuevo" });
    });
    await asentar();

    // isLoggedIn ya es true (RenterApp/OwnerApp monta) pero currentUser
    // todavía no llegó — la transición tiene que estar cubriendo la pantalla
    // en este mismo instante, si no los banners falsos quedan a la vista.
    const t1 = textOf(tr);
    expect(t1).toContain("isLoggedIn:true");
    expect(t1).toContain("currentUser:no");
    expect(t1).toContain("transition:true");

    liberarGetMe({ id: "u1", nombre: "Cliente", estado_documentos: "verificado" });
    await asentar();
    expect(textOf(tr)).toContain("currentUser:si");

    // La transición tiene un piso de exhibición (SESSION_SWITCH_MS = 400ms)
    // antes de bajar — no debería quedar pegada más que eso.
    await act(() => new Promise((resolve) => setTimeout(resolve, 500)));
    expect(textOf(tr)).toContain("transition:false");
  });

  it("TOKEN_REFRESHED no dispara una transición (no cambia el perfil)", async () => {
    mockAuth.getSession.mockResolvedValue({ data: { session: null } });
    const tr = montar();
    await asentar();

    const callback = mockAuth.onAuthStateChange.mock.calls[0][0];
    act(() => {
      callback("TOKEN_REFRESHED", { access_token: "tok-refrescado" });
    });
    await asentar();

    expect(mockGetMe).not.toHaveBeenCalled();
    expect(textOf(tr)).toContain("transition:false");
  });
});
