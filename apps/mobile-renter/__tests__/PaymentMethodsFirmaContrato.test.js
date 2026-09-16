/**
 * Al firmar el contrato para reservar, el usuario no tenía forma de leerlo
 * completo antes de aceptar, ni el nombre venía precargado en la firma
 * manuscrita.
 */
import React from "react";
import { act } from "react-test-renderer";
import { PaymentMethodsScreen } from "../src/renter/screens/PaymentMethodsScreen";
import { renderTree, textOf, pressText } from "../test-utils";

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock("@rentacar/mobile-shared/context/AppContext", () => ({
  useApp: () => ({ currentUser: { nombre: "Camila Soto", rut: "11.111.111-1" } }),
}));

const tarjetaDebito = { id: "deb-1", tipo: "debito", predeterminada_cobro: true };
const tarjetaCredito = { id: "cred-1", tipo: "credito", predeterminada_garantia: true };
jest.mock("@rentacar/mobile-shared/hooks/useTarjetas", () => ({
  useTarjetas: () => ({
    tarjetasDebito: [tarjetaDebito],
    tarjetasCredito: [tarjetaCredito],
    agregar: jest.fn(),
    recargar: jest.fn(),
  }),
}));

const mockCrearReserva = jest.fn();
const mockGetConfiguracionPagos = jest.fn(() => Promise.resolve({ simulado: false }));
jest.mock("@rentacar/mobile-shared/api/client", () => {
  const real = jest.requireActual("@rentacar/mobile-shared/api/client");
  return {
    ApiClient: {
      ...real.ApiClient,
      crearReserva: (...a) => mockCrearReserva(...a),
      getConfiguracionPagos: (...a) => mockGetConfiguracionPagos(...a),
    },
  };
});

// SignaturePad depende del motor táctil nativo (PanResponder) que no corre
// en este entorno de test — no hace falta para este test, que no llega a
// dibujar nada.
jest.mock("@rentacar/mobile-shared/components/SignaturePad", () => ({
  SignaturePad: () => null,
}));
// tipoBiometriaDisponible corre en un useEffect al abrir el modal; sin
// mockearlo la promesa real (expo-local-authentication) no resuelve nunca
// en este entorno.
jest.mock("@rentacar/mobile-shared/hooks/biometria", () => ({
  tipoBiometriaDisponible: jest.fn(() => Promise.resolve(null)),
  autenticarParaFirmar: jest.fn(() => Promise.resolve(false)),
}));

const asentar = () => act(() => new Promise((r) => setTimeout(r, 0)));

let arbolActual = null;
afterEach(() => {
  if (arbolActual) arbolActual.unmount();
  arbolActual = null;
});

const car = { id: "auto-1", marca: "Suzuki", modelo: "Swift", anio: 2023, tarifa_dia: 30000, ubicacion_base: "Los Ángeles", monto_garantia: 100000, fotos: [] };
const booking = { fechaInicio: "2026-09-10T10:00:00", fechaFin: "2026-09-13T18:00:00", dias: 3, montoCobro: 90000, montoHold: 100000 };

beforeEach(() => {
  jest.clearAllMocks();
  mockGetConfiguracionPagos.mockResolvedValue({ simulado: false });
});

describe("PaymentMethodsScreen · leer el contrato y nombre precargado al firmar", () => {
  it("ofrece leer el contrato completo antes de firmar", async () => {
    mockCrearReserva.mockResolvedValue({ id: "res-nueva", firmas: [], cobro: { monto: 90000, neto: 75630, iva: 14370 }, garantia: { monto: 100000 } });
    const tr = renderTree(<PaymentMethodsScreen car={car} booking={booking} onBack={() => {}} onPaymentSuccess={() => {}} />);
    arbolActual = tr;
    await asentar();

    await act(async () => {
      pressText(tr, "Firmar y reservar");
      await asentar();
    });

    expect(textOf(tr)).toContain("Leer el contrato completo");

    await act(async () => {
      pressText(tr, "Leer el contrato completo");
      await asentar();
    });

    expect(textOf(tr)).toContain("Contrato digital de arriendo");
  });

  it("precarga el nombre del usuario en la firma manuscrita", async () => {
    mockCrearReserva.mockResolvedValue({ id: "res-nueva", firmas: [], cobro: { monto: 90000, neto: 75630, iva: 14370 }, garantia: { monto: 100000 } });
    const tr = renderTree(<PaymentMethodsScreen car={car} booking={booking} onBack={() => {}} onPaymentSuccess={() => {}} />);
    arbolActual = tr;
    await asentar();

    await act(async () => {
      pressText(tr, "Firmar y reservar");
      await asentar();
    });
    // Sin biometría disponible (mockeada a null), el modal va directo al modo manual.
    await act(async () => {
      await asentar();
    });

    const inputNombre = tr.root.findAll((n) => n.props?.placeholder === "Como aparece en tu cédula")[0];
    expect(inputNombre.props.value).toBe("Camila Soto");
  });
});
