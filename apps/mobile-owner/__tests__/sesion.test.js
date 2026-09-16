/**
 * Continuidad de la sesión: que abrir la app no pida iniciar sesión de nuevo.
 *
 * Los dos mecanismos que lo sostienen son el refresco del token mientras la
 * app está en primer plano, y el reintento del cliente HTTP cuando el backend
 * responde 401 con un token vencido.
 */
import { AppState } from "react-native";

const mockAuth = {
  getSession: jest.fn(async () => ({ data: { session: { access_token: "token-viejo" } } })),
  refreshSession: jest.fn(async () => ({
    data: { session: { access_token: "token-nuevo" } },
    error: null,
  })),
  startAutoRefresh: jest.fn(),
  stopAutoRefresh: jest.fn(),
};

jest.mock("@supabase/supabase-js", () => ({
  createClient: () => ({ auth: mockAuth }),
}));

const { supabase, getAccessToken, refreshAccessToken, vigilarSesionEnPrimerPlano } =
  require("@rentacar/mobile-shared/api/supabase");
const { ApiClient } = require("@rentacar/mobile-shared/api/client");

describe("Refresco de sesión en primer plano", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("mantiene el token vivo mientras la app está activa y lo detiene al salir", () => {
    const dejarDeVigilar = vigilarSesionEnPrimerPlano();

    // El estado inicial ya cuenta: la app arranca activa en los tests.
    expect(supabase.auth.startAutoRefresh).toHaveBeenCalled();

    // Simula el ciclo de vida real: la app se va al fondo y vuelve.
    const handler = AppState.addEventListener.mock
      ? AppState.addEventListener.mock.calls[0][1]
      : null;
    if (handler) {
      handler("background");
      expect(supabase.auth.stopAutoRefresh).toHaveBeenCalled();

      supabase.auth.startAutoRefresh.mockClear();
      handler("active");
      expect(supabase.auth.startAutoRefresh).toHaveBeenCalled();
    }

    dejarDeVigilar();
    expect(supabase.auth.stopAutoRefresh).toHaveBeenCalled();
  });

  it("refreshAccessToken devuelve null en vez de tirar cuando la sesión ya no se puede renovar", async () => {
    supabase.auth.refreshSession.mockResolvedValueOnce({ data: null, error: { message: "invalid" } });
    await expect(refreshAccessToken()).resolves.toBeNull();

    supabase.auth.refreshSession.mockRejectedValueOnce(new Error("sin red"));
    await expect(refreshAccessToken()).resolves.toBeNull();
  });

  it("getAccessToken toma el token de la sesión guardada", async () => {
    await expect(getAccessToken()).resolves.toBe("token-viejo");
  });
});

describe("ApiClient · token vencido", () => {
  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  it("renueva el token y reintenta una vez cuando el backend responde 401", async () => {
    const fetchSpy = jest
      .spyOn(global, "fetch")
      .mockResolvedValueOnce({ ok: false, status: 401, json: async () => ({}) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ id: "u1" }) });

    await expect(ApiClient.getMe()).resolves.toEqual({ id: "u1" });

    expect(supabase.auth.refreshSession).toHaveBeenCalledTimes(1);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it("no reintenta en bucle: si el 401 persiste, propaga el error", async () => {
    const fetchSpy = jest
      .spyOn(global, "fetch")
      .mockResolvedValue({ ok: false, status: 401, json: async () => ({ detail: "No autorizado" }) });

    await expect(ApiClient.getMe()).rejects.toMatchObject({ status: 401 });
    // Una sola renovación y un solo reintento.
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it("un 401 sin sesión no gasta un refresh: no hay nada que renovar", async () => {
    supabase.auth.getSession.mockResolvedValueOnce({ data: { session: null } });
    const fetchSpy = jest
      .spyOn(global, "fetch")
      .mockResolvedValue({ ok: false, status: 401, json: async () => ({}) });

    await expect(ApiClient.getMe()).rejects.toMatchObject({ status: 401 });
    expect(supabase.auth.refreshSession).not.toHaveBeenCalled();
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("un error que no es 401 se propaga sin intentar renovar", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue({ ok: false, status: 500, json: async () => ({}) });

    await expect(ApiClient.getMe()).rejects.toMatchObject({ status: 500 });
    expect(supabase.auth.refreshSession).not.toHaveBeenCalled();
  });
});
