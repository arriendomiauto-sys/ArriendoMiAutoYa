import { Image } from "react-native";
import * as ImageManipulator from "expo-image-manipulator";
import {
  optimizarImagen,
  subirImagenOptimizada,
  subirImagenesOptimizadas,
  ApiClient,
  ANCHO_MAXIMO_FOTO,
} from "@rentacar/mobile-shared";

jest.mock("expo-image-manipulator", () => ({
  manipulateAsync: jest.fn(async () => ({ uri: "file://optimizada.jpg" })),
  SaveFormat: { JPEG: "jpeg" },
}));

const mockGetSize = (width, height) =>
  jest.spyOn(Image, "getSize").mockImplementation((uri, ok) => ok(width, height));

describe("optimizarImagen", () => {
  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  it("reduce y recomprime las fotos grandes de la cámara", async () => {
    mockGetSize(4032, 3024);

    const uri = await optimizarImagen("file://original.jpg");

    expect(uri).toBe("file://optimizada.jpg");
    const [, acciones, opciones] = ImageManipulator.manipulateAsync.mock.calls[0];
    expect(acciones).toEqual([{ resize: { width: ANCHO_MAXIMO_FOTO } }]);
    expect(opciones.compress).toBeLessThan(1);
    expect(opciones.format).toBe("jpeg");
  });

  it("no escala hacia arriba una imagen que ya es chica", async () => {
    mockGetSize(800, 600);

    await optimizarImagen("file://chica.jpg");

    const [, acciones] = ImageManipulator.manipulateAsync.mock.calls[0];
    expect(acciones).toEqual([]);
  });

  it("devuelve el original si la optimización falla, en vez de perder la foto", async () => {
    mockGetSize(4032, 3024);
    ImageManipulator.manipulateAsync.mockRejectedValueOnce(new Error("formato raro"));

    await expect(optimizarImagen("file://original.jpg")).resolves.toBe("file://original.jpg");
  });
});

describe("subida de fotos", () => {
  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  it("sube la versión optimizada, no la original", async () => {
    mockGetSize(4032, 3024);
    const subir = jest
      .spyOn(ApiClient, "subirArchivoStorage")
      .mockResolvedValue({ url: "https://cdn/auto.jpg" });

    const url = await subirImagenOptimizada("file://original.jpg", {
      filename: "auto_frontal.jpg",
      bucket: "autos",
    });

    expect(url).toBe("https://cdn/auto.jpg");
    expect(subir).toHaveBeenCalledWith("file://optimizada.jpg", "auto_frontal.jpg", "autos");
  });

  it("sube varias en paralelo, en orden y avisando el avance", async () => {
    mockGetSize(4032, 3024);
    jest
      .spyOn(ApiClient, "subirArchivoStorage")
      .mockImplementation(async (_uri, filename) => ({ url: `https://cdn/${filename}` }));

    const avances = [];
    const urls = await subirImagenesOptimizadas(
      [
        { uri: "file://1.jpg", filename: "a.jpg" },
        { uri: "file://2.jpg", filename: "b.jpg" },
        { uri: "file://3.jpg", filename: "c.jpg" },
        { uri: "file://4.jpg", filename: "d.jpg" },
      ],
      { bucket: "autos", onProgreso: (listas, total) => avances.push(`${listas}/${total}`) }
    );

    expect(urls).toEqual([
      "https://cdn/a.jpg",
      "https://cdn/b.jpg",
      "https://cdn/c.jpg",
      "https://cdn/d.jpg",
    ]);
    expect(avances[avances.length - 1]).toBe("4/4");
  });

  it("una foto que falla no bota a las demás", async () => {
    mockGetSize(4032, 3024);
    jest
      .spyOn(ApiClient, "subirArchivoStorage")
      .mockImplementation(async (_uri, filename) =>
        filename === "b.jpg" ? Promise.reject(new Error("timeout")) : { url: `https://cdn/${filename}` }
      );

    const urls = await subirImagenesOptimizadas([
      { uri: "file://1.jpg", filename: "a.jpg" },
      { uri: "file://2.jpg", filename: "b.jpg" },
    ]);

    expect(urls).toEqual(["https://cdn/a.jpg", null]);
  });
});
