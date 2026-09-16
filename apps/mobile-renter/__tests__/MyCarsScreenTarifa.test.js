import React from "react";
import { act } from "react-test-renderer";
import { MyCarsScreen } from "../src/owner/screens/MyCarsScreen";
import { renderTree, textOf } from "../test-utils";

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

const mockActualizarAuto = jest.fn();
jest.mock("@rentacar/mobile-shared", () => {
  const real = jest.requireActual("@rentacar/mobile-shared");
  return { ...real, ApiClient: { ...real.ApiClient, actualizarAuto: (...a) => mockActualizarAuto(...a) } };
});

const autoSedan = {
  id: "auto-sedan-1",
  marca: "Nissan",
  modelo: "Versa",
  anio: 2023,
  patente: "VERS-23",
  categoria: "sedan",
  tarifa_dia: 55000,
  estado: "activo",
  documentos_verificados: true,
  fotos: [],
};

beforeEach(() => {
  mockActualizarAuto.mockReset();
});

describe("MyCarsScreen · Edición de tarifa según reglas de categoría", () => {
  it("abre el modal con la categoría y tarifa fijada por RentACar", async () => {
    const tr = renderTree(
      <MyCarsScreen cars={[autoSedan]} setCars={() => {}} onAddNewCar={() => {}} identidadVerificada />
    );

    // Encuentra el botón Editar
    const btnEditar = tr.root.findAll(
      (n) => typeof n.props?.onPress === "function" && n.findAll((c) => c.props?.children === "Editar").length > 0
    )[0];
    expect(btnEditar).toBeDefined();

    await act(async () => {
      btnEditar.props.onPress();
    });

    const texto = textOf(tr);
    expect(texto).toContain("Ajustar tarifa diaria");
    expect(texto).toContain("Nissan Versa · VERS-23");
    expect(texto).toContain("Sedán");
    expect(texto).toContain("Fijado por RentACar");
    expect(texto).toContain("$55.000");
  });

  it("permite ajustar en tramos de $5.000 hasta el piso de la categoría y guardar", async () => {
    mockActualizarAuto.mockResolvedValue({ ...autoSedan, tarifa_dia: 50000 });
    let cars = [autoSedan];
    const setCars = (fn) => {
      cars = typeof fn === "function" ? fn(cars) : fn;
    };

    const tr = renderTree(
      <MyCarsScreen cars={cars} setCars={setCars} onAddNewCar={() => {}} identidadVerificada />
    );

    // Abrir modal
    const btnEditar = tr.root.findAll(
      (n) => typeof n.props?.onPress === "function" && n.findAll((c) => c.props?.children === "Editar").length > 0
    )[0];
    await act(async () => {
      btnEditar.props.onPress();
    });

    // Bajar tarifa $5.000 con el botón minus
    const btnBajar = tr.root.findAll(
      (n) => n.props?.accessibilityLabel === "Bajar la tarifa cinco mil pesos"
    )[0];
    expect(btnBajar).toBeDefined();

    await act(async () => {
      btnBajar.props.onPress();
    });

    expect(textOf(tr)).toContain("$50.000");

    // Guardar
    const btnGuardar = tr.root.findAll((n) => n.props?.label === "Guardar tarifa")[0];
    await act(async () => {
      btnGuardar.props.onPress();
      await Promise.resolve();
    });

    expect(mockActualizarAuto).toHaveBeenCalledWith("auto-sedan-1", { tarifa_dia: 50000 });
    expect(cars[0].tarifa_dia).toBe(50000);
  });
});
