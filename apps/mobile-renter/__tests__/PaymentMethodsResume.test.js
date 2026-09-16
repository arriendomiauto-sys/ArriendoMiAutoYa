/**
 * Reanudar el pago de una reserva pendiente_pago ya existente (desde la
 * pestaña "Pendientes" o el reintento en el arriendo activo) no debe crear
 * una reserva duplicada — la reserva ya existe, solo falta cobrarla.
 */
import React from "react";
import { act } from "react-test-renderer";
import { PaymentMethodsScreen } from "../src/renter/screens/PaymentMethodsScreen";
import { renderTree, textOf, pressText } from "../test-utils";

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock("@rentacar/mobile-shared/context/AppContext", () => ({
  useApp: () => ({ currentUser: { nombre: "Cliente Test", rut: "11.111.111-1" } }),
}));

const tarjetaDebito = { id: "deb-1", tipo: "debito", predeterminada_cobro: true };
const tarjetaCredito = { id: "cred-1", tipo: "credito", predeterminada_garantia: true };
jest.mock("@rentacar/mobile-shared/hooks/useTarjetas", () => ({
  useTarjetas: () => ({
    validadas: [tarjetaDebito, tarjetaCredito],
    tarjetasDebito: [tarjetaDebito],
    tarjetasCredito: [tarjetaCredito],
    agregar: jest.fn(),
    recargar: jest.fn(),
  }),
}));

const mockCrearReserva = jest.fn();
const mockPagarReserva = jest.fn();
const mockGetConfiguracionPagos = jest.fn(() => Promise.resolve({ simulado: false }));
jest.mock("@rentacar/mobile-shared/api/client", () => {
  const real = jest.requireActual("@rentacar/mobile-shared/api/client");
  return {
    ApiClient: {
      ...real.ApiClient,
      crearReserva: (...a) => mockCrearReserva(...a),
      pagarReserva: (...a) => mockPagarReserva(...a),
      getConfiguracionPagos: (...a) => mockGetConfiguracionPagos(...a),
    },
  };
});

const asentar = () => act(() => new Promise((r) => setTimeout(r, 0)));

// PaymentMethodsScreen usa useCuentaRegresiva sobre reserva.expira_en, que
// arma un setInterval real de 1s — sin desmontar entre tests esos timers se
// acumulan y el proceso de Jest no termina de cerrar solo.
let arbolActual = null;
afterEach(() => {
  if (arbolActual) arbolActual.unmount();
  arbolActual = null;
});

const reservaPendiente = {
  id: "res-pend-1",
  estado: "pendiente_pago",
  expira_en: new Date(Date.now() + 600000).toISOString(),
  fecha_inicio: "2026-09-10T10:00:00",
  fecha_fin: "2026-09-13T18:00:00",
  monto_hold: 100000,
  cobro: { monto: 90000, neto: 75630, iva: 14370 },
  garantia: { monto: 100000 },
  // Ya firmó al intentar pagar la primera vez: el reintento va directo al cobro.
  firmas: [{ rol: "arrendatario", metodo: "escrita" }],
  auto: { id: "auto-1", marca: "Suzuki", modelo: "Swift", anio: 2023, tarifa_dia: 30000, ubicacion_base: "Los Ángeles", fotos: [] },
};

beforeEach(() => {
  jest.clearAllMocks();
  mockGetConfiguracionPagos.mockResolvedValue({ simulado: false });
});

describe("PaymentMethodsScreen · reanudar una reserva pendiente_pago", () => {
  it("muestra el auto y los días sin necesitar car/booking por separado", async () => {
    const tr = renderTree(
      <PaymentMethodsScreen existingReservation={reservaPendiente} onBack={() => {}} onPaymentSuccess={() => {}} />
    );
    arbolActual = tr;
    await asentar();

    const t = textOf(tr);
    expect(t).toContain("Suzuki Swift 2023");
    // 3 días y 8 horas redondeadas hacia arriba, mismo criterio que el backend.
    expect(t).toContain("4 días");
  });

  it("al continuar, cobra la reserva existente sin crear una nueva", async () => {
    mockPagarReserva.mockResolvedValue({ estado: "confirmada" });
    const onPaymentSuccess = jest.fn();
    const tr = renderTree(
      <PaymentMethodsScreen existingReservation={reservaPendiente} onBack={() => {}} onPaymentSuccess={onPaymentSuccess} />
    );
    arbolActual = tr;
    await asentar();

    // Ya firmó (reservaPendiente trae la firma del arrendatario): el botón
    // pasa directo al cobro, sin volver a pedir la firma.
    await act(async () => {
      pressText(tr, "Pagar y reservar");
      await asentar();
    });

    expect(mockCrearReserva).not.toHaveBeenCalled();
    expect(mockPagarReserva).toHaveBeenCalledWith("res-pend-1", {
      tarjeta_cobro_id: "deb-1",
      tarjeta_garantia_id: "cred-1",
    });
    expect(onPaymentSuccess).toHaveBeenCalled();
  });
});
