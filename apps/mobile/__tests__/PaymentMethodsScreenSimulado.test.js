/**
 * BLOQUE TEMPORAL — borrar junto con el bypass de pagos del backend.
 *
 * Verifica que la pantalla de pago de la reserva avance el proceso cuando la
 * pasarela está simulada, y que lo diga de frente en vez de fingir un cobro.
 *
 * El camino con pasarela real vive en PaymentMethodsScreenPasarelaReal.test.js: montar la misma
 * pantalla con dos configuraciones distintas en un mismo archivo deja trabajo
 * asíncrono cruzado entre tests y el segundo render sale vacío.
 */
import React from "react";
import { act } from "react-test-renderer";
import { PaymentMethodsScreen } from "../src/renter/screens/PaymentMethodsScreen";
import { renderTree, textOf, pressText } from "../test-utils";

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

// El factory de jest.mock se iza sobre los imports, así que los jest.fn() se
// crean adentro y recién después se toma la referencia para configurarlos.
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
const booking = {
  montoHold: 126000,
  dias: 3,
  fechaInicio: "2026-09-10T10:00:00",
  fechaFin: "2026-09-13T10:00:00",
};

// Deja correr las promesas pendientes del render.
const asentar = async () => {
  await act(async () => {
    await Promise.resolve();
  });
};

describe("Pantalla de pago · pasarela simulada", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockApi.getConfiguracionPagos.mockResolvedValue({ simulado: true });
    mockApi.crearReserva.mockResolvedValue({ id: "res-1" });
    mockApi.iniciarPago.mockResolvedValue({
      pago_id: "pago-1",
      preferencia_id: "SIMULADO-ABC123",
      url: "http://localhost:3000/pago/retorno?payment_id=SIMULADO-ABC123&status=approved&simulado=1",
      simulado: true,
    });
    mockApi.confirmarPago.mockResolvedValue({ autorizada: true, simulado: true });
  });

  it("avisa que es modo de prueba y que no se cobra nada", async () => {
    const tr = renderTree(
      <PaymentMethodsScreen car={car} booking={booking} onBack={() => {}} onPaymentSuccess={() => {}} />
    );
    await asentar();

    const t = textOf(tr);
    expect(t).toContain("Modo de prueba");
    expect(t).toContain("no se cobra ni se retiene nada");
    expect(t).toContain("Simular pago exitoso y confirmar reserva");
    // El copy de la pasarela real no debe aparecer prometiendo un cobro.
    expect(t).not.toContain("Pagar con Mercado Pago");
  });

  it("el botón avanza el proceso: reserva confirmada sin abrir el checkout", async () => {
    const onPaymentSuccess = jest.fn();
    const tr = renderTree(
      <PaymentMethodsScreen
        car={car}
        booking={booking}
        onBack={() => {}}
        onPaymentSuccess={onPaymentSuccess}
      />
    );
    await asentar();

    pressText(tr, "Simular pago exitoso");
    await asentar();
    await asentar();

    expect(mockApi.crearReserva).toHaveBeenCalled();
    expect(mockApi.confirmarPago).toHaveBeenCalledWith("SIMULADO-ABC123", "pago-1");
    expect(onPaymentSuccess).toHaveBeenCalledWith(
      expect.objectContaining({ id: "res-1", estado: "confirmada", pagoSimulado: true })
    );

    // No se abrió el checkout de Mercado Pago: no hay pasarela a la que ir.
    const WebBrowser = require("expo-web-browser");
    expect(WebBrowser.openAuthSessionAsync).not.toHaveBeenCalled();
  });
});
