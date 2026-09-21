/**
 * BUG-045: "Tu ganancia" se calculaba sobre `monto_hold` (la garantía que se
 * retiene al arrendatario) en vez de sobre `monto_cobro` (lo que paga por el
 * arriendo), así que el dueño veía una cifra que no le correspondía.
 */
import React from "react";
import { act } from "react-test-renderer";
import { DriverBookingsScreen } from "../src/owner/screens/DriverBookingsScreen";
import { renderTree, textOf, pressText } from "../test-utils";

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

const mockGetReservas = jest.fn();
jest.mock("@rentacar/mobile-shared/api/client", () => {
  const real = jest.requireActual("@rentacar/mobile-shared/api/client");
  return {
    ApiClient: {
      ...real.ApiClient,
      getReservas: (...a) => mockGetReservas(...a),
      getCalificacionesDeReserva: jest.fn(() => Promise.resolve([])),
    },
  };
});

const asentar = () => act(() => new Promise((resolve) => setTimeout(resolve, 0)));

const reserva = (extra) => ({
  id: "res-1",
  estado: "confirmada",
  lugar_entrega_acordado: "Plaza de Armas",
  fecha_inicio: new Date(Date.now() + 72 * 3600000).toISOString(),
  monto_hold: 250000, // garantía: NO es ingreso del dueño
  auto: { id: "auto-1", marca: "Kia", modelo: "Soluto", anio: 2022 },
  ...extra,
});

const montar = async (r, pestana) => {
  mockGetReservas.mockResolvedValue([r]);
  const tr = renderTree(<DriverBookingsScreen />);
  await asentar();
  if (pestana) {
    act(() => pressText(tr, pestana));
    await asentar();
  }
  return tr;
};

describe("DriverBookingsScreen · ganancia del dueño", () => {
  beforeEach(() => jest.clearAllMocks());

  it("se calcula sobre lo que paga el arrendatario por el arriendo, no sobre la garantía", async () => {
    const t = textOf(await montar(reserva({ monto_cobro: 66000 })));
    expect(t).toContain("Tu ganancia");
    expect(t).toContain("$56.100"); // 85 % de 66.000
    expect(t).not.toContain("$212.500"); // 85 % de la garantía de 250.000
  });

  it("una vez liquidada, muestra lo que de verdad se le abonó", async () => {
    const t = textOf(
      await montar(
        reserva({ estado: "finalizada", monto_cobro: 66000, liquidacion_dueno_clp: 52800 }),
        "Todas"
      )
    );
    expect(t).toContain("$52.800");
    expect(t).not.toContain("$56.100");
  });

  it("si la reserva no trae el monto del arriendo, no inventa una ganancia", async () => {
    const t = textOf(await montar(reserva({ monto_cobro: 0 })));
    expect(t).not.toContain("Tu ganancia");
    expect(t).not.toContain("$212.500");
  });
});
