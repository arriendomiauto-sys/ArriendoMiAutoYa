/**
 * BUG-012: "Mis reservas" vacío decía "Nada por aquí" y dejaba al usuario sin
 * salida. Ahora ofrece ir directo a buscar autos.
 */
import React from "react";
import { act } from "react-test-renderer";
import { RentalHistoryScreen } from "../src/renter/screens/RentalHistoryScreen";
import { renderTree, textOf, pressText } from "../test-utils";

const mockGetReservas = jest.fn();
jest.mock("@rentacar/mobile-shared/api/client", () => {
  const real = jest.requireActual("@rentacar/mobile-shared/api/client");
  return {
    ApiClient: { ...real.ApiClient, getReservas: (...a) => mockGetReservas(...a) },
  };
});

const asentar = () => act(() => new Promise((r) => setTimeout(r, 0)));

let arbolActual = null;
afterEach(() => {
  if (arbolActual) arbolActual.unmount();
  arbolActual = null;
});

describe("RentalHistoryScreen · estado vacío", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetReservas.mockResolvedValue([]);
  });

  it("sin reservas ofrece 'Explorar autos' y lleva a buscar", async () => {
    const onExplorar = jest.fn();
    const tr = renderTree(
      <RentalHistoryScreen onSelectReservation={() => {}} onBack={() => {}} onExplorar={onExplorar} />
    );
    arbolActual = tr;
    await asentar();

    expect(textOf(tr)).toContain("Nada por aquí");
    expect(textOf(tr)).toContain("Explorar autos");

    act(() => pressText(tr, "Explorar autos"));

    expect(onExplorar).toHaveBeenCalledTimes(1);
  });

  it("sin destino no muestra un botón que no lleva a ninguna parte", async () => {
    const tr = renderTree(<RentalHistoryScreen onSelectReservation={() => {}} onBack={() => {}} />);
    arbolActual = tr;
    await asentar();

    expect(textOf(tr)).toContain("Nada por aquí");
    expect(textOf(tr)).not.toContain("Explorar autos");
  });
});
