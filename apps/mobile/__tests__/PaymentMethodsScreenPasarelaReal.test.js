/**
 * Camino con pasarela real en la pantalla de pago de la reserva.
 *
 * Es el comportamiento que debe quedar cuando se borre el bypass temporal:
 * botón de Mercado Pago, aviso de la tarjeta y ninguna mención a modo de prueba.
 * Vive en su propio archivo porque montar la misma pantalla con las dos
 * configuraciones seguidas cruza el trabajo asíncrono entre tests.
 */
import React from "react";
import { act } from "react-test-renderer";
import { PaymentMethodsScreen } from "../src/renter/screens/PaymentMethodsScreen";
import { renderTree, textOf } from "../test-utils";

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock("@rentacar/mobile-shared", () => {
  const real = jest.requireActual("@rentacar/mobile-shared");
  return {
    ...real,
    ApiClient: {
      getConfiguracionPagos: jest.fn(),
      crearReserva: jest.fn(),
      iniciarPago: jest.fn(),
      confirmarPago: jest.fn(),
    },
  };
});

const { ApiClient: mockApi } = require("@rentacar/mobile-shared");

const car = {
  id: "auto-1",
  marca: "Toyota",
  modelo: "RAV4",
  anio: 2023,
  ubicacion_base: "Los Ángeles",
  fotos: [],
};
const booking = { montoHold: 126000, dias: 3 };

const asentar = async () => {
  await act(async () => {
    await Promise.resolve();
  });
};

it("con pasarela real muestra el botón y el copy de Mercado Pago", async () => {
  mockApi.getConfiguracionPagos.mockResolvedValue({ simulado: false });

  const tr = renderTree(
    <PaymentMethodsScreen car={car} booking={booking} onBack={() => {}} onPaymentSuccess={() => {}} />
  );
  await asentar();

  const t = textOf(tr);
  expect(t).toContain("Pagar con Mercado Pago");
  expect(t).toContain("No guardamos los datos de tu tarjeta");
  expect(t).not.toContain("Modo de prueba");
});
