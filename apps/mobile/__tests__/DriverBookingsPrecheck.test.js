/**
 * El pre-checkin 24h antes solo estaba cableado del lado del arrendatario
 * (ActiveRentalScreen). El dueño no tenía forma de confirmar su parte, así
 * que `ambos_confirmados` nunca llegaba a ser true.
 */
import React from "react";
import { act } from "react-test-renderer";
import { DriverBookingsScreen } from "../src/owner/screens/DriverBookingsScreen";
import { renderTree, textOf, pressText } from "../test-utils";

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

const mockGetReservas = jest.fn();
const mockGetCalificacionesDeReserva = jest.fn(() => Promise.resolve([]));
jest.mock("@rentacar/mobile-shared/api/client", () => {
  const real = jest.requireActual("@rentacar/mobile-shared/api/client");
  return {
    ApiClient: {
      ...real.ApiClient,
      getReservas: (...a) => mockGetReservas(...a),
      getCalificacionesDeReserva: (...a) => mockGetCalificacionesDeReserva(...a),
    },
  };
});

const asentar = () => act(() => new Promise((resolve) => setTimeout(resolve, 0)));

const reservaBase = {
  id: "res-1",
  estado: "confirmada",
  lugar_entrega_acordado: "Plaza de Armas",
  monto_hold: 100000,
  auto: { id: "auto-1", marca: "Kia", modelo: "Rio", anio: 2022 },
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe("DriverBookingsScreen · pre-checkin del dueño", () => {
  it("con el retiro a menos de 24h y sin confirmar, muestra el botón", async () => {
    mockGetReservas.mockResolvedValue([
      { ...reservaBase, fecha_inicio: new Date(Date.now() + 12 * 3600000).toISOString() },
    ]);
    const tr = renderTree(<DriverBookingsScreen />);
    await asentar();

    expect(textOf(tr)).toContain("Confirmar entrega de mañana");
  });

  it("tocarlo abre el modal con role='dueno'", async () => {
    mockGetReservas.mockResolvedValue([
      { ...reservaBase, fecha_inicio: new Date(Date.now() + 12 * 3600000).toISOString() },
    ]);
    const tr = renderTree(<DriverBookingsScreen />);
    await asentar();

    await act(async () => {
      pressText(tr, "Confirmar entrega de mañana");
      await Promise.resolve();
    });

    expect(textOf(tr)).toContain("Confirma que el vehículo está listo para entrega");
  });

  it("con el retiro a más de 24h, no muestra el botón todavía", async () => {
    mockGetReservas.mockResolvedValue([
      { ...reservaBase, fecha_inicio: new Date(Date.now() + 3 * 86400000).toISOString() },
    ]);
    const tr = renderTree(<DriverBookingsScreen />);
    await asentar();

    expect(textOf(tr)).not.toContain("Confirmar entrega de mañana");
  });

  it("ya confirmado por el dueño, no vuelve a mostrar el botón", async () => {
    mockGetReservas.mockResolvedValue([
      {
        ...reservaBase,
        fecha_inicio: new Date(Date.now() + 12 * 3600000).toISOString(),
        precheck_dueno_confirmado: true,
      },
    ]);
    const tr = renderTree(<DriverBookingsScreen />);
    await asentar();

    expect(textOf(tr)).not.toContain("Confirmar entrega de mañana");
  });
});
