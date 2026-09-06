/**
 * Cargador de licencia / fotos KYC: la subida a POST /storage/upload tiene que
 * salir del teléfono.
 *
 * Desde Expo SDK 54 el `fetch` global (runtime "winter") NO sabe subir un
 * archivo con el shorthand `FormData.append("file", { uri, name, type })` de
 * React Native — falla con "Unsupported FormDataPart implementation" y la foto
 * nunca llega. `ApiClient.request` manda los cuerpos multipart por
 * XMLHttpRequest, que sí lo soporta.
 */
import { ApiClient } from "@rentacar/mobile-shared";

jest.mock("@rentacar/mobile-shared/api/supabase", () => ({
  supabase: { auth: {} },
  getAccessToken: jest.fn(async () => "tok-123"),
  refreshAccessToken: jest.fn(async () => null),
}));

const asentar = () => new Promise((r) => setTimeout(r, 0));

describe("Subida multipart (fix cargador de licencia)", () => {
  let xhrs;
  let XHRReal;

  beforeEach(() => {
    xhrs = [];
    XHRReal = global.XMLHttpRequest;
    global.XMLHttpRequest = class {
      constructor() {
        this.headers = {};
        xhrs.push(this);
      }
      open(method, url) {
        this.method = method;
        this.url = url;
      }
      setRequestHeader(k, v) {
        this.headers[k] = v;
      }
      send(body) {
        this.body = body;
      }
    };
    jest.spyOn(global, "fetch").mockRejectedValue(new Error("fetch no debería usarse para multipart"));
  });

  afterEach(() => {
    global.XMLHttpRequest = XHRReal;
    jest.restoreAllMocks();
  });

  it("sube el archivo por XHR con el Bearer, sin fijar Content-Type y sin tocar fetch", async () => {
    const p = ApiClient.subirArchivoStorage("file:///lic.jpg", "licencia_conducir.jpg", "documentos-kyc");
    await asentar();

    expect(xhrs).toHaveLength(1);
    const xhr = xhrs[0];
    expect(xhr.method).toBe("POST");
    expect(xhr.url).toMatch(/\/storage\/upload$/);
    expect(xhr.headers.Authorization).toBe("Bearer tok-123");
    expect(Object.keys(xhr.headers).map((k) => k.toLowerCase())).not.toContain("content-type");

    xhr.status = 200;
    xhr.responseText = JSON.stringify({ success: true, url: "https://storage/kyc/lic.jpg" });
    xhr.onload();

    await expect(p).resolves.toMatchObject({ success: true, url: "https://storage/kyc/lic.jpg" });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("propaga el error cuando el backend responde 500 a la subida", async () => {
    const p = ApiClient.subirArchivoStorage("file:///lic.jpg", "lic.jpg", "documentos-kyc");
    await asentar();

    const xhr = xhrs[0];
    xhr.status = 500;
    xhr.responseText = JSON.stringify({ detail: "no se pudo guardar" });
    xhr.onload();

    await expect(p).rejects.toMatchObject({ status: 500 });
  });

  it("EXPO_PUBLIC_USE_RN_FETCH=0 desactiva el XHR y vuelve a fetch", async () => {
    const prev = process.env.EXPO_PUBLIC_USE_RN_FETCH;
    process.env.EXPO_PUBLIC_USE_RN_FETCH = "0";
    global.fetch.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ url: "x" }) });
    try {
      await ApiClient.subirArchivoStorage("file:///lic.jpg", "lic.jpg", "documentos-kyc");
      await asentar();
      expect(xhrs).toHaveLength(0);
      expect(global.fetch).toHaveBeenCalled();
    } finally {
      process.env.EXPO_PUBLIC_USE_RN_FETCH = prev;
    }
  });
});
