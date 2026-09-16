/**
 * Carga de archivos: optimización antes de subir y elección de origen.
 *
 * La foto que entrega la cámara pesa entre 3 y 8 MB. Subirla tal cual por 4G
 * es lo que hacía que el checklist de nueve fotos y el enrolamiento se
 * sintieran trancados, así que la optimización no es un detalle: es el flujo.
 */
const mockManipulate = jest.fn();
const mockCamara = jest.fn();
const mockGaleria = jest.fn();
const mockPermisoCamara = jest.fn();
const mockPermisoGaleria = jest.fn();

jest.mock("expo-image-manipulator", () => ({
  manipulateAsync: (...args) => mockManipulate(...args),
  SaveFormat: { JPEG: "jpeg" },
}));

jest.mock("expo-image-picker", () => ({
  launchCameraAsync: (...a) => mockCamara(...a),
  launchImageLibraryAsync: (...a) => mockGaleria(...a),
  requestCameraPermissionsAsync: (...a) => mockPermisoCamara(...a),
  requestMediaLibraryPermissionsAsync: (...a) => mockPermisoGaleria(...a),
}));

jest.mock("react-native", () => ({
  Image: { getSize: (uri, ok) => ok(4000, 3000) },
  Platform: { OS: "ios" },
  Alert: { alert: jest.fn() },
}));

const mockSubir = jest.fn();
jest.mock("@rentacar/mobile-shared/api/client", () => ({
  ApiClient: { subirArchivoStorage: (...a) => mockSubir(...a) },
}));

const {
  optimizarImagen,
  subirImagenOptimizada,
  elegirImagen,
  elegirYSubirImagen,
  AJUSTES_DOCUMENTO,
  ANCHO_MAXIMO_FOTO,
} = require("@rentacar/mobile-shared/utils/imagenes");

describe("Optimización antes de subir", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockManipulate.mockResolvedValue({ uri: "file://optimizada.jpg" });
    mockSubir.mockResolvedValue({ url: "https://storage/optimizada.jpg" });
  });

  it("reduce la foto de cámara al ancho máximo antes de subirla", async () => {
    await optimizarImagen("file://original.jpg");

    const [, acciones, opciones] = mockManipulate.mock.calls[0];
    expect(acciones).toEqual([{ resize: { width: ANCHO_MAXIMO_FOTO } }]);
    expect(opciones.compress).toBeLessThan(1);
  });

  it("los documentos que lee el OCR conservan más resolución y calidad", async () => {
    await optimizarImagen("file://cedula.jpg", AJUSTES_DOCUMENTO);

    const [, acciones, opciones] = mockManipulate.mock.calls[0];
    expect(acciones[0].resize.width).toBe(AJUSTES_DOCUMENTO.maxAncho);
    expect(acciones[0].resize.width).toBeGreaterThan(ANCHO_MAXIMO_FOTO);
    expect(opciones.compress).toBe(AJUSTES_DOCUMENTO.calidad);
    // Un documento comprimido como foto de carrocería pierde el texto chico.
    expect(opciones.compress).toBeGreaterThan(0.8);
  });

  it("sube la versión optimizada, no la original", async () => {
    const url = await subirImagenOptimizada("file://original.jpg", {
      filename: "checklist.jpg",
      bucket: "checklists",
    });

    expect(mockSubir).toHaveBeenCalledWith("file://optimizada.jpg", "checklist.jpg", "checklists");
    expect(url).toBe("https://storage/optimizada.jpg");
  });

  it("si la optimización falla sube igual la original: perder la foto es peor", async () => {
    mockManipulate.mockRejectedValue(new Error("formato raro"));

    const url = await subirImagenOptimizada("file://original.jpg", { filename: "x.jpg" });

    expect(mockSubir).toHaveBeenCalledWith("file://original.jpg", "x.jpg", "general");
    expect(url).toBe("https://storage/optimizada.jpg");
  });
});

describe("Elegir el origen de la foto", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockManipulate.mockResolvedValue({ uri: "file://optimizada.jpg" });
    mockSubir.mockResolvedValue({ url: "https://storage/foto.jpg" });
    mockPermisoCamara.mockResolvedValue({ granted: true });
    mockPermisoGaleria.mockResolvedValue({ granted: true });
  });

  it("pide el permiso de cámara y devuelve el uri elegido", async () => {
    mockCamara.mockResolvedValue({ canceled: false, assets: [{ uri: "file://foto.jpg" }] });

    await expect(elegirImagen({ origen: "camera" })).resolves.toBe("file://foto.jpg");
    expect(mockPermisoCamara).toHaveBeenCalled();
    expect(mockGaleria).not.toHaveBeenCalled();
  });

  it("permite adjuntar desde la galería, no solo con la cámara", async () => {
    mockGaleria.mockResolvedValue({ canceled: false, assets: [{ uri: "file://boleta.jpg" }] });

    await expect(elegirImagen({ origen: "library" })).resolves.toBe("file://boleta.jpg");
    expect(mockPermisoGaleria).toHaveBeenCalled();
    expect(mockCamara).not.toHaveBeenCalled();
  });

  it("cancelar no se trata como error ni sube nada", async () => {
    mockCamara.mockResolvedValue({ canceled: true });

    await expect(elegirYSubirImagen({ origen: "camera" })).resolves.toEqual({
      url: null,
      cancelado: true,
    });
    expect(mockSubir).not.toHaveBeenCalled();
  });

  it("sin permiso avisa y no sube nada", async () => {
    mockPermisoCamara.mockResolvedValue({ granted: false });

    const res = await elegirYSubirImagen({ origen: "camera" });

    expect(res.cancelado).toBe(true);
    expect(mockCamara).not.toHaveBeenCalled();
    expect(mockSubir).not.toHaveBeenCalled();
  });
});
