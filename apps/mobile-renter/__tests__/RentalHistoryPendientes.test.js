/**
 * Reservas pendiente_pago no aparecían en ningún tab de "Mis reservas" — el
 * usuario que salía del checkout sin pagar creía que la reserva se había
 * perdido, cuando en realidad seguía ocupando el auto hasta expirar.
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

const reservaPendiente = {
  id: "res-pend-1",
  estado: "pendiente_pago",
  expira_en: new Date(Date.now() + 8 * 60000 + 30000).toISOString(),
  auto: { marca: "Suzuki", modelo: "Swift", anio: 2023 },
};

// useCuentaRegresiva arma un setInterval real de 1s mientras el componente
// está montado — sin desmontar entre tests, ese timer sigue disparando
// setState después de que Jest ya tiró el entorno del test anterior.
let arbolActual = null;

beforeEach(() => {
  jest.clearAllMocks();
});

afterEach(() => {
  if (arbolActual) arbolActual.unmount();
  arbolActual = null;
});

describe("RentalHistoryScreen · pestaña Pendientes", () => {
  it("una reserva pendiente_pago aparece en la pestaña Pendientes, no en Activas", async () => {
    mockGetReservas.mockResolvedValue([reservaPendiente]);
    const tr = renderTree(<RentalHistoryScreen onSelectReservation={() => {}} onBack={() => {}} />);
    arbolActual = tr;
    await asentar();

    // En la pestaña "Activas" no debería verse: esa reserva está pendiente de pago.
    act(() => pressText(tr, "Activas"));
    await asentar();
    expect(textOf(tr)).not.toContain("Swift");

    act(() => pressText(tr, "Pendientes"));
    await asentar();

    expect(textOf(tr)).toContain("Swift");
    expect(textOf(tr)).toContain("Expira en");
  });

  it("tocar 'Continuar pago' llama a onContinuarPago con esa reserva", async () => {
    mockGetReservas.mockResolvedValue([reservaPendiente]);
    const onContinuarPago = jest.fn();
    const tr = renderTree(
      <RentalHistoryScreen onSelectReservation={() => {}} onBack={() => {}} onContinuarPago={onContinuarPago} />
    );
    arbolActual = tr;
    await asentar();
    act(() => pressText(tr, "Pendientes"));
    await asentar();

    act(() => pressText(tr, "Continuar pago"));

    expect(onContinuarPago).toHaveBeenCalledWith(reservaPendiente);
  });

  it("una reserva ya expirada no ofrece 'Continuar pago'", async () => {
    mockGetReservas.mockResolvedValue([
      { ...reservaPendiente, expira_en: new Date(Date.now() - 60000).toISOString() },
    ]);
    const tr = renderTree(<RentalHistoryScreen onSelectReservation={() => {}} onBack={() => {}} />);
    arbolActual = tr;
    await asentar();
    act(() => pressText(tr, "Pendientes"));
    await asentar();

    expect(textOf(tr)).toContain("Expiró");
    expect(textOf(tr)).not.toContain("Continuar pago");
  });

  it("sin reservas pendientes, la pestaña muestra el estado vacío", async () => {
    mockGetReservas.mockResolvedValue([]);
    const tr = renderTree(<RentalHistoryScreen onSelectReservation={() => {}} onBack={() => {}} />);
    arbolActual = tr;
    await asentar();
    act(() => pressText(tr, "Pendientes"));
    await asentar();

    expect(textOf(tr)).toContain("Nada por aquí");
  });
});
