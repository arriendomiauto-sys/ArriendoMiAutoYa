/**
 * Si /autos/{id}/disponibilidad falla, el calendario no debe quedar
 * abierto "confiando" en que ningún día choca: eso deja elegir fechas que
 * el backend va a rechazar recién al pagar, con un 400 sin ninguna pista.
 */
import React from "react";
import { act } from "react-test-renderer";
import { CarDetailScreen } from "../src/renter/screens/CarDetailScreen";
import { renderTree, textOf, pressText } from "../test-utils";

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

const mockGetDisponibilidadAuto = jest.fn();
jest.mock("@rentacar/mobile-shared", () => {
  const real = jest.requireActual("@rentacar/mobile-shared");
  return {
    ...real,
    ApiClient: { ...real.ApiClient, getDisponibilidadAuto: (...a) => mockGetDisponibilidadAuto(...a) },
  };
});

const car = {
  id: "c1",
  marca: "Suzuki",
  modelo: "Swift",
  anio: 2023,
  tarifa_dia: 40000,
  ubicacion_base: "Los Ángeles",
  fotos: ["https://example.com/1.jpg"],
};

const asentar = async () => {
  await act(async () => {
    await Promise.resolve();
  });
};

beforeEach(() => {
  mockGetDisponibilidadAuto.mockReset();
});

describe("CarDetailScreen · disponibilidad no verificada", () => {
  it("si falla la consulta, avisa y no deja avanzar a pagar", async () => {
    mockGetDisponibilidadAuto.mockRejectedValue(new Error("network"));
    const onProceedToPayment = jest.fn();
    const tr = renderTree(<CarDetailScreen car={car} onBack={() => {}} onProceedToPayment={onProceedToPayment} />);
    await asentar();

    expect(textOf(tr)).toContain("No pudimos verificar disponibilidad");

    pressText(tr, "Ver resumen");
    await asentar();

    expect(textOf(tr)).toContain("No pudimos verificar qué días están disponibles");
    expect(onProceedToPayment).not.toHaveBeenCalled();
  });

  it("si la consulta funciona, no muestra ningún aviso y deja avanzar", async () => {
    mockGetDisponibilidadAuto.mockResolvedValue({ rangos_ocupados: [] });
    const tr = renderTree(<CarDetailScreen car={car} onBack={() => {}} onProceedToPayment={() => {}} />);
    await asentar();

    expect(textOf(tr)).not.toContain("No pudimos verificar disponibilidad");

    pressText(tr, "Ver resumen");
    await asentar();

    expect(textOf(tr)).toContain("Resumen de la reserva");
  });
});
