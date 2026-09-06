/**
 * Firma exclusiva de contratos: la huella/Face ID ya no bloquea el acceso a la
 * app; se pide SOLO al confirmar y firmar el arriendo de un vehículo, justo
 * antes de crear la reserva. Si el usuario cancela la biometría, no se reserva.
 */
import React from "react";
import { act } from "react-test-renderer";
import { PaymentMethodsScreen } from "../src/renter/screens/PaymentMethodsScreen";
import { renderTree, pressText } from "../test-utils";

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

const mockAuthenticate = jest.fn();
jest.mock("expo-local-authentication", () => ({
  hasHardwareAsync: jest.fn(async () => true),
  isEnrolledAsync: jest.fn(async () => true),
  authenticateAsync: (...a) => mockAuthenticate(...a),
}));

const mockShowAlert = jest.fn();
jest.mock("@rentacar/mobile-shared", () => {
  const real = jest.requireActual("@rentacar/mobile-shared");
  return {
    ...real,
    showAlert: (...a) => mockShowAlert(...a),
    ApiClient: {
      getConfiguracionPagos: jest.fn(async () => ({ simulado: true })),
      crearReserva: jest.fn(async () => ({ id: "res-1" })),
      iniciarPago: jest.fn(async () => ({ pago_id: "p1", preferencia_id: "S1", simulado: true })),
      confirmarPago: jest.fn(async () => ({ autorizada: true, simulado: true })),
    },
  };
});

const { ApiClient: mockApi } = require("@rentacar/mobile-shared");

const car = { id: "auto-1", marca: "Toyota", modelo: "RAV4", anio: 2023, ubicacion_base: "Los Ángeles", fotos: [] };
const booking = { montoHold: 126000, dias: 3, fechaInicio: "2026-09-10T10:00:00", fechaFin: "2026-09-13T10:00:00" };

const asentar = async () => {
  await act(async () => {
    await Promise.resolve();
  });
};

const montar = async (onPaymentSuccess = () => {}) => {
  let tr;
  await act(async () => {
    tr = renderTree(
      <PaymentMethodsScreen car={car} booking={booking} onBack={() => {}} onPaymentSuccess={onPaymentSuccess} />
    );
    await Promise.resolve();
  });
  return tr;
};

describe("Pantalla de pago · sin solicitud biométrica", () => {
  it("crea la reserva y avanza al pago directamente sin pedir huella/biometría", async () => {
    const onPaymentSuccess = jest.fn();
    const tr = await montar(onPaymentSuccess);

    await act(async () => {
      pressText(tr, "Simular pago exitoso");
    });
    await asentar();
    await asentar();
    await asentar();

    expect(mockAuthenticate).not.toHaveBeenCalled();
    expect(mockApi.crearReserva).toHaveBeenCalled();
    expect(onPaymentSuccess).toHaveBeenCalledWith(
      expect.objectContaining({ id: "res-1", estado: "confirmada" })
    );
  });
});
