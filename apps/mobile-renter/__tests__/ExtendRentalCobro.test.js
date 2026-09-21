/**
 * Extender el arriendo ahora COBRA los días adicionales a la tarjeta del pago
 * (BUG-024): antes el backend no cobraba nada y la pantalla decía "se retuvo un
 * hold adicional". La garantía es fija por categoría y no cambia al extender.
 */
import React from "react";
import { act } from "react-test-renderer";
import { ExtendRentalScreen } from "../src/renter/screens/ExtendRentalScreen";
import { renderTree, textOf, pressText } from "../test-utils";

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

const mockExtender = jest.fn();
const mockShowAlert = jest.fn();

const reserva = {
  id: "r-1",
  fecha_fin: "2027-03-10T18:00:00",
  auto: { id: "auto-1", marca: "Kia", modelo: "Rio", tarifa_dia: 20000, patente: "AA-11" },
};

jest.mock("@rentacar/mobile-shared", () => {
  const real = jest.requireActual("@rentacar/mobile-shared");
  return {
    ...real,
    useApp: () => ({ activeReservation: reserva, setActiveReservation: jest.fn() }),
    showAlert: (...a) => mockShowAlert(...a),
    ApiClient: {
      ...real.ApiClient,
      getDisponibilidadAuto: jest.fn(async () => ({ rangos_ocupados: [] })),
      extenderReserva: (...a) => mockExtender(...a),
    },
  };
});

const asentar = async () => {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
};

const montar = async () => {
  const tr = renderTree(<ExtendRentalScreen onBack={() => {}} onComplete={() => {}} />);
  await asentar();
  return tr;
};

beforeEach(() => {
  mockExtender.mockReset().mockResolvedValue({ fecha_fin: "2027-03-11T18:00:00" });
  mockShowAlert.mockClear();
});

describe("ExtendRentalScreen · el monto adicional se cobra", () => {
  it("la pantalla dice que se cobra ahora y no habla de un hold adicional", async () => {
    const t = textOf(await montar());
    expect(t).toMatch(/se cobra de inmediato/i);
    expect(t).not.toMatch(/hold/i);
  });

  it("al extender avisa cuánto se cobró, sin decir que se retuvo", async () => {
    const tr = await montar();
    await act(async () => {
      pressText(tr, "Solicitar extensión");
    });
    await asentar();

    expect(mockExtender).toHaveBeenCalledWith("r-1", 1);
    const [titulo, mensaje] = mockShowAlert.mock.calls[0];
    expect(titulo).toBe("Arriendo extendido");
    expect(mensaje).toContain("$20.000");
    expect(mensaje).toMatch(/cobr/i);
    expect(mensaje).not.toMatch(/hold|retuvo/i);
  });

  it("si el banco rechaza el cobro, muestra el motivo y no da el arriendo por extendido", async () => {
    mockExtender.mockRejectedValue(
      Object.assign(new Error("El banco no aprobó el cobro de los días adicionales."), { status: 402 })
    );
    const tr = await montar();
    await act(async () => {
      pressText(tr, "Solicitar extensión");
    });
    await asentar();

    const [titulo, mensaje] = mockShowAlert.mock.calls[0];
    expect(titulo).toBe("No se pudo extender");
    expect(mensaje).toContain("El banco no aprobó el cobro");
  });
});
