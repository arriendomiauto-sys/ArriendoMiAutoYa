/**
 * Extender el arriendo tiene un techo: el inicio de la próxima reserva del
 * auto. Antes el usuario subía los días libremente y recién al mandar se comía
 * el 400 del backend ("no disponible para esas fechas"). Ahora la pantalla
 * pre-consulta `/autos/{id}/disponibilidad` y capa el stepper.
 */
import React from "react";
import { act } from "react-test-renderer";
import { ExtendRentalScreen } from "../src/renter/screens/ExtendRentalScreen";
import { renderTree, textOf, pressText } from "../test-utils";

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

const mockGetDisponibilidad = jest.fn(async () => ({ rangos_ocupados: [] }));
const mockExtender = jest.fn(async () => ({ fecha_fin: "2027-03-13T18:00:00" }));
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
      getDisponibilidadAuto: (...a) => mockGetDisponibilidad(...a),
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

// El "+" del stepper: el TouchableOpacity cuyo hijo Text dice "+".
const botonMas = (tr) =>
  tr.root.findAll((n) => {
    if (typeof n.props?.onPress !== "function") return false;
    const hijos = React.Children.toArray(n.props.children);
    return hijos.some((h) => h?.props?.children === "+");
  })[0];

beforeEach(() => {
  mockGetDisponibilidad.mockReset().mockResolvedValue({ rangos_ocupados: [] });
  mockExtender.mockReset().mockResolvedValue({ fecha_fin: "2027-03-13T18:00:00" });
  mockShowAlert.mockClear();
});

describe("ExtendRentalScreen · tope por la próxima reserva", () => {
  it("sin próxima reserva se puede subir sin límite", async () => {
    const tr = await montar();
    const mas = botonMas(tr);
    for (let i = 0; i < 6; i++) act(() => mas.props.onPress());
    expect(textOf(tr)).toContain("+7 días");
    expect(mas.props.disabled).toBeFalsy();
  });

  it("capa el stepper en el día de inicio de la próxima reserva", async () => {
    // Próxima reserva 3 días exactos después del fin actual -> tope 3.
    mockGetDisponibilidad.mockResolvedValue({
      rangos_ocupados: [{ fecha_inicio: "2027-03-13T18:00:00", fecha_fin: "2027-03-16T18:00:00" }],
    });
    const tr = await montar();

    for (let i = 0; i < 6; i++) act(() => botonMas(tr).props.onPress());

    expect(textOf(tr)).toContain("+3 días");
    expect(textOf(tr)).toContain("Máximo hasta el");
    expect(botonMas(tr).props.disabled).toBe(true);
  });

  it("si la próxima reserva arranca justo al terminar, no deja extender", async () => {
    mockGetDisponibilidad.mockResolvedValue({
      rangos_ocupados: [{ fecha_inicio: "2027-03-10T18:00:00", fecha_fin: "2027-03-12T18:00:00" }],
    });
    const tr = await montar();

    expect(textOf(tr)).toContain("No se puede extender");

    pressText(tr, "No disponible para esas fechas"); // botón deshabilitado: no dispara
    expect(mockExtender).not.toHaveBeenCalled();
  });

  it("dentro del tope, la extensión se manda normal", async () => {
    mockGetDisponibilidad.mockResolvedValue({
      rangos_ocupados: [{ fecha_inicio: "2027-03-15T18:00:00", fecha_fin: "2027-03-18T18:00:00" }],
    });
    const tr = await montar();

    act(() => botonMas(tr).props.onPress()); // 2 días, tope 5

    pressText(tr, "Solicitar extensión");
    await asentar();

    expect(mockExtender).toHaveBeenCalledWith("r-1", 2);
  });
});
