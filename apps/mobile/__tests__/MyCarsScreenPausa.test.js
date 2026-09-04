/**
 * Pausa rápida de publicación desde "Mi Flota".
 *
 * El switch por tarjeta ya estaba construido (optimista + rollback si el
 * backend falla); lo que faltaba era la cobertura de que en verdad pausa,
 * reactiva, y que un fallo del backend no deja al dueño creyendo que pausó
 * un auto que en realidad sigue visible en el marketplace.
 */
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

const auto = {
  id: "auto-1",
  marca: "Kia",
  modelo: "Rio",
  anio: 2022,
  tarifa_dia: 30000,
  estado: "activo",
  documentos_verificados: true,
  fotos: [],
};

const asentar = async () => {
  await act(async () => {
    await Promise.resolve();
  });
};

const encontrarSwitch = (tr) => tr.root.findAll((n) => typeof n.props?.onValueChange === "function")[0];

beforeEach(() => {
  mockActualizarAuto.mockReset();
});

describe("Mi Flota · pausa rápida", () => {
  it("un auto activo se ve como Disponible", () => {
    const t = textOf(
      renderTree(<MyCarsScreen cars={[auto]} setCars={() => {}} onAddNewCar={() => {}} identidadVerificada />)
    );
    expect(t).toContain("Disponible");
  });

  it("pausar llama al backend con estado pausado y actualiza la lista", async () => {
    mockActualizarAuto.mockResolvedValue({ ...auto, estado: "pausado" });
    let cars = [auto];
    const setCars = (fn) => {
      cars = typeof fn === "function" ? fn(cars) : fn;
    };

    const tr = renderTree(<MyCarsScreen cars={cars} setCars={setCars} onAddNewCar={() => {}} identidadVerificada />);
    const sw = encontrarSwitch(tr);
    await act(async () => {
      sw.props.onValueChange();
      await Promise.resolve();
    });

    expect(mockActualizarAuto).toHaveBeenCalledWith("auto-1", { estado: "pausado" });
    expect(cars[0].estado).toBe("pausado");
  });

  it("reactivar un auto pausado manda estado activo", async () => {
    const pausado = { ...auto, estado: "pausado" };
    mockActualizarAuto.mockResolvedValue({ ...pausado, estado: "activo" });
    let cars = [pausado];
    const setCars = (fn) => {
      cars = typeof fn === "function" ? fn(cars) : fn;
    };

    const tr = renderTree(<MyCarsScreen cars={cars} setCars={setCars} onAddNewCar={() => {}} identidadVerificada />);
    await act(async () => {
      encontrarSwitch(tr).props.onValueChange();
      await Promise.resolve();
    });

    expect(mockActualizarAuto).toHaveBeenCalledWith("auto-1", { estado: "activo" });
    expect(cars[0].estado).toBe("activo");
  });

  it("si el backend falla, el switch vuelve a su estado real en vez de quedar mintiendo", async () => {
    mockActualizarAuto.mockRejectedValue(new Error("Sin conexión"));
    let cars = [auto];
    const setCars = (fn) => {
      cars = typeof fn === "function" ? fn(cars) : fn;
    };

    const tr = renderTree(<MyCarsScreen cars={cars} setCars={setCars} onAddNewCar={() => {}} identidadVerificada />);
    await act(async () => {
      encontrarSwitch(tr).props.onValueChange();
      await Promise.resolve();
      await Promise.resolve();
    });

    // El update optimista se deshizo: sigue activo, como en verdad está en
    // el backend.
    expect(cars[0].estado).toBe("activo");
  });
});
