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

const tarjetaDebito = { id: "deb-1", tipo: "debito", predeterminada_cobro: true, marca: "visa", ultimos4: "4242" };
const tarjetaCreditoSinCupo = { id: "cred-sin-cupo", tipo: "credito", predeterminada_garantia: true, marca: "mastercard", ultimos4: "1111" };
const tarjetaCreditoNueva = { id: "cred-nueva", tipo: "credito", marca: "visa", ultimos4: "9999" };

let mockValidadas = [tarjetaDebito, tarjetaCreditoSinCupo];
let mockTarjetasCredito = [tarjetaCreditoSinCupo];
const mockAgregarTarjetaHook = jest.fn();

jest.mock("@rentacar/mobile-shared/hooks/useTarjetas", () => ({
  useTarjetas: () => ({
    validadas: mockValidadas,
    tarjetasDebito: [tarjetaDebito],
    tarjetasCredito: mockTarjetasCredito,
    agregar: (...args) => mockAgregarTarjetaHook(...args),
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

let arbolActual = null;
afterEach(() => {
  if (arbolActual) arbolActual.unmount();
  arbolActual = null;
});

const reservaPendiente = {
  id: "res-hold-cupo-1",
  estado: "pendiente_pago",
  expira_en: new Date(Date.now() + 600000).toISOString(),
  fecha_inicio: "2026-09-20T10:00:00",
  fecha_fin: "2026-09-23T18:00:00",
  monto_hold: 100000,
  cobro: { monto: 90000, neto: 75630, iva: 14370 },
  garantia: { monto: 100000 },
  firmas: [{ rol: "arrendatario", metodo: "escrita" }],
  auto: { id: "auto-1", marca: "Toyota", modelo: "Corolla", anio: 2024, tarifa_dia: 35000, ubicacion_base: "Los Ángeles", fotos: [] },
};

beforeEach(() => {
  jest.clearAllMocks();
  mockValidadas = [tarjetaDebito, tarjetaCreditoSinCupo];
  mockTarjetasCredito = [tarjetaCreditoSinCupo];
  mockGetConfiguracionPagos.mockResolvedValue({ simulado: false });
});

describe("PaymentMethodsScreen · Manejo de garantía hold y falta de cupo (SIN_CUPO)", () => {
  it("muestra error claro y botón directo para agregar otra tarjeta ante SIN_CUPO", async () => {
    // Simular error 402 SIN_CUPO en el backend al intentar cobrar/retener
    const errorSinCupo = new Error("Tu tarjeta de crédito no tiene cupo para la garantía.");
    errorSinCupo.status = 402;
    errorSinCupo.detail = {
      codigo: "SIN_CUPO",
      campo: "garantia",
      mensaje: "Tu tarjeta de crédito no tiene cupo para la garantía.",
    };
    mockPagarReserva.mockRejectedValue(errorSinCupo);

    const tr = renderTree(
      <PaymentMethodsScreen existingReservation={reservaPendiente} onBack={() => {}} onPaymentSuccess={() => {}} />
    );
    arbolActual = tr;
    await asentar();

    // Intentar pagar con tarjeta sin cupo
    await act(async () => {
      pressText(tr, "Pagar y reservar");
      await asentar();
    });

    const t = textOf(tr);
    // Verifica que el error amigable de garantía aparece en pantalla
    expect(t).toMatch(/cupo/i);
    // Verifica que el botón de recuperación contextual aparece
    expect(t).toMatch(/Agregar otra tarjeta de crédito con cupo/i);
  });

  it("permite agregar otra tarjeta de crédito tras SIN_CUPO y reintentar con éxito", async () => {
    // 1. Primer intento: falla con SIN_CUPO
    const errorSinCupo = new Error("Tu tarjeta de crédito no tiene cupo para la garantía.");
    errorSinCupo.status = 402;
    errorSinCupo.detail = {
      codigo: "SIN_CUPO",
      campo: "garantia",
      mensaje: "Tu tarjeta de crédito no tiene cupo para la garantía.",
    };
    mockPagarReserva.mockRejectedValueOnce(errorSinCupo);

    const onPaymentSuccess = jest.fn();
    const tr = renderTree(
      <PaymentMethodsScreen existingReservation={reservaPendiente} onBack={() => {}} onPaymentSuccess={onPaymentSuccess} />
    );
    arbolActual = tr;
    await asentar();

    // Fallo en primer intento
    await act(async () => {
      pressText(tr, "Pagar y reservar");
      await asentar();
    });

    expect(textOf(tr)).toMatch(/cupo/i);

    // 2. Simular que el usuario abre modal y agrega la nueva tarjeta de crédito
    mockValidadas = [tarjetaDebito, tarjetaCreditoSinCupo, tarjetaCreditoNueva];
    mockTarjetasCredito = [tarjetaCreditoSinCupo, tarjetaCreditoNueva];

    // Encontrar el componente AgregarTarjetaModal en el árbol y simular onAgregada
    const modal = tr.root.findByProps({ nombreTitular: "Cliente Test" });
    await act(async () => {
      modal.props.onAgregada(tarjetaCreditoNueva);
      await asentar();
    });

    // El error de cupo debe haberse limpiado
    expect(textOf(tr)).not.toMatch(/Esta tarjeta no tiene cupo disponible/i);

    // 3. Segundo intento: backend responde exitoso
    mockPagarReserva.mockResolvedValueOnce({ estado: "confirmada" });

    await act(async () => {
      pressText(tr, "Pagar y reservar");
      await asentar();
    });

    // Se debió llamar con la nueva tarjeta de crédito para la garantía
    expect(mockPagarReserva).toHaveBeenLastCalledWith("res-hold-cupo-1", {
      tarjeta_cobro_id: "deb-1",
      tarjeta_garantia_id: "cred-nueva",
    });
    expect(onPaymentSuccess).toHaveBeenCalled();
  });
});
