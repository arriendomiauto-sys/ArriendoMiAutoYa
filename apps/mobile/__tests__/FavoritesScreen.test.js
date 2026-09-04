/**
 * Pantalla dedicada de favoritos: lista los autos guardados y, al
 * desmarcar uno desde ahí, lo saca de la lista de inmediato (no solo apaga
 * el corazón — es la razón de ser de esta pantalla).
 */
import React from "react";
import { act } from "react-test-renderer";
import { FavoritesScreen } from "../src/renter/screens/FavoritesScreen";
import { renderTree, textOf } from "../test-utils";

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

const AUTO = {
  id: "auto-fav-1",
  marca: "Suzuki",
  modelo: "Alto",
  anio: 2021,
  tarifa_dia: 20000,
  ubicacion_base: "Los Ángeles",
  fotos: [],
};

const mockGetFavoritos = jest.fn();
const mockGetIdsFavoritos = jest.fn();
const mockQuitarFavorito = jest.fn();
jest.mock("@rentacar/mobile-shared/api/client", () => {
  const real = jest.requireActual("@rentacar/mobile-shared/api/client");
  return {
    ApiClient: {
      ...real.ApiClient,
      getFavoritos: (...a) => mockGetFavoritos(...a),
      getIdsFavoritos: (...a) => mockGetIdsFavoritos(...a),
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
      getFavoritos: (...a) => mockGetFavoritos(...a),
      getIdsFavoritos: (...a) => mockGetIdsFavoritos(...a),
      quitarFavorito: (...a) => mockQuitarFavorito(...a),
    },
  };
});

const asentar = () => new Promise((resolve) => setTimeout(resolve, 0));

beforeEach(() => {
  mockGetFavoritos.mockReset();
  mockGetIdsFavoritos.mockReset();
  mockQuitarFavorito.mockReset();
});

describe("Pantalla de favoritos", () => {
  it("sin favoritos muestra el estado vacío", async () => {
    mockGetFavoritos.mockResolvedValue([]);
    mockGetIdsFavoritos.mockResolvedValue([]);

    let tr;
    await act(async () => {
      tr = renderTree(<FavoritesScreen onBack={() => {}} onSelectCar={() => {}} />);
      await asentar();
    });
    expect(textOf(tr)).toContain("Todavía no tienes favoritos");
  });

  it("lista los autos favoritos y al desmarcar uno lo saca de la lista", async () => {
    mockGetFavoritos.mockResolvedValue([AUTO]);
    mockGetIdsFavoritos.mockResolvedValue([AUTO.id]);
    mockQuitarFavorito.mockResolvedValue({ es_favorito: false });

    let tr;
    await act(async () => {
      tr = renderTree(<FavoritesScreen onBack={() => {}} onSelectCar={() => {}} />);
      await asentar();
    });
    expect(textOf(tr)).toContain("Suzuki Alto");

    const boton = tr.root.findAll(
      (n) => n.props?.accessibilityRole === "button" && n.props?.accessibilityLabel === "Quitar de favoritos"
    )[0];
    await act(async () => {
      boton.props.onPress();
      await asentar();
    });

    expect(mockQuitarFavorito).toHaveBeenCalledWith(AUTO.id);
    expect(textOf(tr)).toContain("Todavía no tienes favoritos");
  });
});
