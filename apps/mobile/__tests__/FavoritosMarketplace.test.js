/**
 * Wishlist: marcar/desmarcar un auto como favorito desde el corazón de la
 * tarjeta en el marketplace. Optimista (cambia de inmediato) con reversión
 * si el backend falla — mismo patrón que pausar un auto en MyCarsScreen.
 */
import React from "react";
import { act } from "react-test-renderer";
import { MarketplaceScreen } from "../src/renter/screens/MarketplaceScreen";
import { renderTree, textOf } from "../test-utils";

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

const AUTOS = [
  {
    id: "auto-1",
    marca: "Suzuki",
    modelo: "Alto",
    anio: 2021,
    tarifa_dia: 20000,
    ubicacion_base: "Los Ángeles",
    fotos: [],
  },
];

const mockContexto = {
  cars: AUTOS,
  carsError: null,
  currentUser: { estado_documentos: "verificado" },
  loadData: jest.fn(),
  loading: false,
};
jest.mock("@rentacar/mobile-shared/context/AppContext", () => ({
  useApp: () => mockContexto,
}));

const mockGetIdsFavoritos = jest.fn();
const mockMarcarFavorito = jest.fn();
const mockQuitarFavorito = jest.fn();
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

const asentar = () => new Promise((resolve) => setTimeout(resolve, 0));

const montarYAsentar = async () => {
  let tr;
  await act(async () => {
    tr = renderTree(<MarketplaceScreen onSelectCar={() => {}} onOpenMap={() => {}} onVerifyIdentity={() => {}} />);
    await asentar();
  });
  return tr;
};

const tocarCorazon = async (tr) => {
  await act(async () => {
    const boton = tr.root.findAll(
      (n) => n.props?.accessibilityRole === "button" && /favoritos/i.test(n.props?.accessibilityLabel || "")
    )[0];
    boton.props.onPress();
    await asentar();
  });
};

beforeEach(() => {
  mockGetIdsFavoritos.mockReset();
  mockMarcarFavorito.mockReset();
  mockQuitarFavorito.mockReset();
});

describe("Marketplace · favoritos", () => {
  it("un auto sin favorito muestra el corazón vacío y al tocarlo lo marca", async () => {
    mockGetIdsFavoritos.mockResolvedValue([]);
    mockMarcarFavorito.mockResolvedValue({ es_favorito: true });

    const tr = await montarYAsentar();
    let boton = tr.root.findAll(
      (n) => n.props?.accessibilityRole === "button" && n.props?.accessibilityLabel === "Agregar a favoritos"
    )[0];
    expect(boton).toBeTruthy();

    await tocarCorazon(tr);

    expect(mockMarcarFavorito).toHaveBeenCalledWith("auto-1");
    boton = tr.root.findAll(
      (n) => n.props?.accessibilityRole === "button" && n.props?.accessibilityLabel === "Quitar de favoritos"
    )[0];
    expect(boton).toBeTruthy();
  });

  it("un auto ya favorito se muestra marcado desde el inicio", async () => {
    mockGetIdsFavoritos.mockResolvedValue(["auto-1"]);

    const tr = await montarYAsentar();
    const boton = tr.root.findAll(
      (n) => n.props?.accessibilityRole === "button" && n.props?.accessibilityLabel === "Quitar de favoritos"
    )[0];
    expect(boton).toBeTruthy();
  });

  it("si falla el backend, el corazón vuelve a su estado anterior", async () => {
    mockGetIdsFavoritos.mockResolvedValue([]);
    mockMarcarFavorito.mockRejectedValue(new Error("Sin conexión"));

    const tr = await montarYAsentar();
    await tocarCorazon(tr);

    const boton = tr.root.findAll(
      (n) => n.props?.accessibilityRole === "button" && n.props?.accessibilityLabel === "Agregar a favoritos"
    )[0];
    expect(boton).toBeTruthy();
  });
});
