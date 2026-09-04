/**
 * Compartir nativo y favorito desde la ficha del auto.
 */
import React from "react";
import { act } from "react-test-renderer";
import { Share } from "react-native";
import { CarDetailScreen } from "../src/renter/screens/CarDetailScreen";
import { renderTree } from "../test-utils";

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

const mockGetCalificaciones = jest.fn(() => Promise.resolve([]));
const mockGetIdsFavoritos = jest.fn();
const mockMarcarFavorito = jest.fn();
const mockQuitarFavorito = jest.fn();

// useFavoritos vive dentro de mobile-shared e importa ApiClient por su
// propia ruta relativa ("../api/client"), no por el barrel — igual que
// GPSMapModal (ver GPSBotonesFlota.test.js). Hacen falta los dos mocks.
jest.mock("@rentacar/mobile-shared/api/client", () => {
  const real = jest.requireActual("@rentacar/mobile-shared/api/client");
  return {
    ApiClient: {
      ...real.ApiClient,
      getIdsFavoritos: (...a) => mockGetIdsFavoritos(...a),
      marcarFavorito: (...a) => mockMarcarFavorito(...a),
      quitarFavorito: (...a) => mockQuitarFavorito(...a),
    },
  };
});
jest.mock("@rentacar/mobile-shared", () => {
  const real = jest.requireActual("@rentacar/mobile-shared");
  return {
    ...real,
    ApiClient: {
      ...real.ApiClient,
      getCalificaciones: (...a) => mockGetCalificaciones(...a),
      getIdsFavoritos: (...a) => mockGetIdsFavoritos(...a),
      marcarFavorito: (...a) => mockMarcarFavorito(...a),
      quitarFavorito: (...a) => mockQuitarFavorito(...a),
    },
  };
});

jest.spyOn(Share, "share").mockResolvedValue({});

const car = {
  id: "c1",
  dueno_id: "dueno-1",
  marca: "Suzuki",
  modelo: "Swift",
  anio: 2023,
  tarifa_dia: 40000,
  ubicacion_base: "Los Ángeles",
  fotos: ["https://example.com/1.jpg"],
};

const asentar = () => new Promise((resolve) => setTimeout(resolve, 0));

const montarYAsentar = async () => {
  let tr;
  await act(async () => {
    tr = renderTree(<CarDetailScreen car={car} onBack={() => {}} onProceedToPayment={() => {}} />);
    await asentar();
  });
  return tr;
};

beforeEach(() => {
  mockGetCalificaciones.mockClear();
  mockGetIdsFavoritos.mockReset();
  mockMarcarFavorito.mockReset();
  mockQuitarFavorito.mockReset();
  Share.share.mockClear();
});

describe("CarDetailScreen · compartir y favorito", () => {
  it("el botón de compartir invoca Share.share con los datos del auto", async () => {
    mockGetIdsFavoritos.mockResolvedValue([]);
    const tr = await montarYAsentar();

    const boton = tr.root.findAll(
      (n) => n.props?.accessibilityRole === "button" && n.props?.accessibilityLabel === "Compartir este auto"
    )[0];
    await act(async () => {
      boton.props.onPress();
      await asentar();
    });

    expect(Share.share).toHaveBeenCalledTimes(1);
    const mensaje = Share.share.mock.calls[0][0].message;
    expect(mensaje).toContain("Suzuki");
    expect(mensaje).toContain("Swift");
  });

  it("el corazón marca y desmarca el auto como favorito", async () => {
    mockGetIdsFavoritos.mockResolvedValue([]);
    mockMarcarFavorito.mockResolvedValue({ es_favorito: true });
    const tr = await montarYAsentar();

    let boton = tr.root.findAll(
      (n) => n.props?.accessibilityRole === "button" && n.props?.accessibilityLabel === "Agregar a favoritos"
    )[0];
    await act(async () => {
      boton.props.onPress();
      await asentar();
    });

    expect(mockMarcarFavorito).toHaveBeenCalledWith("c1");
    boton = tr.root.findAll(
      (n) => n.props?.accessibilityRole === "button" && n.props?.accessibilityLabel === "Quitar de favoritos"
    )[0];
    expect(boton).toBeTruthy();
  });
});
