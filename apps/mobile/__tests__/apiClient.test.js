import { ApiClient, MOCK_CARS } from "@rentacar/mobile-shared";

// El token sale de la sesión de Supabase: en tests no hay sesión y no se
// necesita para GET /autos (endpoint público).
jest.mock("@rentacar/mobile-shared/api/supabase", () => ({
  supabase: { auth: {} },
  getAccessToken: jest.fn(async () => null),
}));

describe("ApiClient.getAutos", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("cae a los autos de demo solo cuando no se pudo contactar al servidor", async () => {
    jest.spyOn(global, "fetch").mockRejectedValue(new TypeError("Network request failed"));
    await expect(ApiClient.getAutos()).resolves.toBe(MOCK_CARS);
  });

  it("propaga el error cuando el servidor responde 500, en vez de fingir un catálogo vacío", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({}),
    });

    await expect(ApiClient.getAutos()).rejects.toMatchObject({ status: 500 });
  });

  it("devuelve los autos cuando el backend responde bien", async () => {
    const autos = [{ id: "a1", marca: "Toyota" }];
    jest.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => autos,
    });

    await expect(ApiClient.getAutos()).resolves.toEqual(autos);
  });
});

describe("ApiClient.validarDocumentosAuto", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("manda los documentos al motor de validación del backend", async () => {
    const respuesta = {
      verificado: false,
      bloqueantes: [{ tipo: "permiso_circulacion", estado: "vencido", motivo: "venció" }],
      documentos: [{ tipo: "permiso_circulacion", estado: "vencido", bloquea: true }],
    };
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => respuesta,
    });

    const data = await ApiClient.validarDocumentosAuto({
      patente: "BBCL-10",
      doc_permiso_circulacion_url: "https://cdn/permiso.jpg",
    });

    expect(data).toEqual(respuesta);
    const [url, opciones] = fetchMock.mock.calls[0];
    expect(url).toContain("/autos/validar-documentos");
    expect(opciones.method).toBe("POST");
    expect(JSON.parse(opciones.body)).toEqual({
      patente: "BBCL-10",
      doc_permiso_circulacion_url: "https://cdn/permiso.jpg",
    });
  });
});
