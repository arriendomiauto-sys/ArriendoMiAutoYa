/**
 * Un token guardado que ya no corresponde a una cuenta real.
 *
 * `isLoggedIn` se ponía en true apenas había un token sin vencer localmente:
 * un JWT firmado sigue "vigente" para el reloj del teléfono aunque la cuenta
 * se haya borrado en Supabase Auth o la sesión se haya revocado del lado del
 * servidor. Solo GET /usuarios/me (que valida el token contra el backend)
 * puede confirmar si la cuenta detrás del token sigue existiendo — y cuando
 * decía que no, el error se registraba en consola y ahí quedaba: la sesión
 * seguía en isLoggedIn=true con currentUser=null para siempre, mostrando el
 * dashboard de una cuenta que ya no existe.
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

// require() explícito y DESPUÉS de armar los mocks — no import arriba del
// archivo: un import se resuelve antes que las const de este módulo, y el
// factory de jest.mock("@supabase/supabase-js", ...) se ejecuta con
// `mockAuth` todavía sin valor.
const { AppProvider, useApp } = require("@rentacar/mobile-shared");

// Deja pasar cualquier cantidad de saltos de microtask encadenados
// (getSession -> syncProfile -> getMe -> signOut -> setState) esperando un
// macrotask real: para cuando el setTimeout(0) dispara, todos los
// microtasks pendientes ya drenaron.
const asentar = () => act(() => new Promise((resolve) => setTimeout(resolve, 0)));

function Sonda() {
  const { isLoggedIn, authLoading, currentUser } = useApp();
  return (
    <Text>
      {`isLoggedIn:${isLoggedIn} authLoading:${authLoading} currentUser:${currentUser ? "si" : "no"}`}
    </Text>
  );
}

let arbolActual = null;

// Con la sesión válida, AppProvider deja un setInterval de notificaciones
// corriendo (cada 30 s) y una suscripción de auth activa. Sin desmontar
// entre tests esos temporizadores se acumulan test tras test y Jest nunca
// termina de correr el archivo completo, aunque cada test aislado pase.
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

describe("Sesión con un token que ya no corresponde a una cuenta real", () => {
  it("un 401 de /usuarios/me cierra la sesión en vez de dejar el dashboard a medias", async () => {
    mockAuth.getSession.mockResolvedValue({ data: { session: { access_token: "token-de-cuenta-borrada" } } });
    const err = new Error("No autenticado");
    err.status = 401;
    mockGetMe.mockRejectedValue(err);

    const tr = montar();
    await asentar();

    expect(mockAuth.signOut).toHaveBeenCalled();
    const t = textOf(tr);
    expect(t).toContain("isLoggedIn:false");
    expect(t).toContain("currentUser:no");
  });

  it("no muestra la app como lista antes de confirmar la cuenta contra el backend", async () => {
    // authLoading debe seguir en true mientras syncProfile() todavía no
    // resolvió: es lo que mantiene la pantalla de carga en vez del dashboard.
    let liberarGetMe;
    mockAuth.getSession.mockResolvedValue({ data: { session: { access_token: "token-valido" } } });
    mockGetMe.mockReturnValue(new Promise((resolve) => { liberarGetMe = resolve; }));

    const tr = montar();
    await act(() => new Promise((resolve) => setTimeout(resolve, 0)));

    // getSession() ya resolvió pero getMe() sigue pendiente: no debería
    // haber terminado de cargar todavía.
    expect(textOf(tr)).toContain("authLoading:true");

    liberarGetMe({ id: "u1", nombre: "Cliente" });
    await asentar();

    expect(textOf(tr)).toContain("authLoading:false");
    expect(textOf(tr)).toContain("isLoggedIn:true");
  });

  it("una cuenta real sigue entrando sin que el token se cierre solo", async () => {
    mockAuth.getSession.mockResolvedValue({ data: { session: { access_token: "token-valido" } } });
    mockGetMe.mockResolvedValue({ id: "u1", nombre: "Cliente Real" });

    const tr = montar();
    await asentar();

    expect(mockAuth.signOut).not.toHaveBeenCalled();
    const t = textOf(tr);
    expect(t).toContain("isLoggedIn:true");
    expect(t).toContain("currentUser:si");
  });

  it("un error de red al sincronizar el perfil no cierra la sesión (no es un 401)", async () => {
    // Solo un 401 confirmado es motivo de cierre. Un timeout o el servidor
    // caído no dicen nada sobre si la cuenta existe, y cerrar la sesión ahí
    // sacaría a alguien de su cuenta real por un problema de conexión.
    mockAuth.getSession.mockResolvedValue({ data: { session: { access_token: "token-valido" } } });
    mockGetMe.mockRejectedValue(new Error("Network request failed"));

    const tr = montar();
    await asentar();

    expect(mockAuth.signOut).not.toHaveBeenCalled();
    expect(textOf(tr)).toContain("isLoggedIn:true");
  });

  it("sin sesión guardada no llama a getMe ni a signOut", async () => {
    mockAuth.getSession.mockResolvedValue({ data: { session: null } });

    const tr = montar();
    await asentar();

    expect(mockGetMe).not.toHaveBeenCalled();
    expect(mockAuth.signOut).not.toHaveBeenCalled();
    expect(textOf(tr)).toContain("isLoggedIn:false");
  });
});
