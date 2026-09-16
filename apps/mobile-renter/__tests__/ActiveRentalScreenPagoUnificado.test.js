/**
 * El reintento de pago de una reserva pendiente_pago usaba un flujo viejo
 * (Checkout Pro vía WebBrowser, solo autorizaba el hold) distinto del que
 * usa PaymentMethodsScreen al reservar por primera vez (cobro a débito +
 * hold a crédito con la bóveda de tarjetas). Ahora los dos caminos son el
 * mismo: "Elegir tarjetas y pagar" delega a quien monta la pantalla.
 */
import React from "react";
import { act } from "react-test-renderer";
import { ActiveRentalScreen } from "../src/renter/screens/ActiveRentalScreen";
import { renderTree, textOf, pressText } from "../test-utils";

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

const mockIniciarPago = jest.fn();
jest.mock("@rentacar/mobile-shared/api/client", () => {
  const real = jest.requireActual("@rentacar/mobile-shared/api/client");
  return {
    ApiClient: { ...real.ApiClient, iniciarPago: (...a) => mockIniciarPago(...a) },
  };
});

const reservaPendiente = {
  id: "res-1",
  estado: "pendiente_pago",
  monto_hold: 100000,
  fecha_inicio: "2026-09-10T10:00:00",
  fecha_fin: "2026-09-13T18:00:00",
  auto: { marca: "Kia", modelo: "Rio", anio: 2022 },
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe("ActiveRentalScreen · reserva pendiente de pago", () => {
  it("el botón dice 'Elegir tarjetas y pagar' y no toca Mercado Pago directamente", () => {
    const tr = renderTree(<ActiveRentalScreen reservation={reservaPendiente} onBack={() => {}} />);
    const t = textOf(tr);
    expect(t).toContain("Elegir tarjetas y pagar");
    expect(t).not.toContain("Mercado Pago");
  });

  it("tocarlo llama a onResumirPago con la reserva, sin llamar a iniciarPago", () => {
    const onResumirPago = jest.fn();
    const tr = renderTree(
      <ActiveRentalScreen reservation={reservaPendiente} onBack={() => {}} onResumirPago={onResumirPago} />
    );

    act(() => pressText(tr, "Elegir tarjetas y pagar"));

    expect(onResumirPago).toHaveBeenCalledWith(reservaPendiente);
    expect(mockIniciarPago).not.toHaveBeenCalled();
  });
});
