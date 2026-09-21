/**
 * Política de reservas (2026-09-20): pagar NO confirma la reserva; el dueño tiene 24 h para hacerlo.
 * El backend deja la reserva en "pendiente" y `POST /reservas/{id}/pagar` responde
 * `{estado: "esperando_dueno", confirmar_antes_de}`.
 *
 * Antes la app leía "pendiente" como "falta pagar" y cualquier respuesta distinta de "confirmada" como
 * "el banco revisa tu cobro": una reserva ya pagada se mostraba como impaga.
 */
import React from "react";
import { act } from "react-test-renderer";
import { PaymentMethodsScreen } from "../src/renter/screens/PaymentMethodsScreen";
import { ActiveRentalScreen } from "../src/renter/screens/ActiveRentalScreen";
import { RentalHistoryScreen } from "../src/renter/screens/RentalHistoryScreen";
import { renderTree, textOf, pressText } from "../test-utils";

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock("@rentacar/mobile-shared/context/AppContext", () => ({
  useApp: () => ({ currentUser: { nombre: "Cliente Test", rut: "11.111.111-1" } }),
}));

const tarjetaDebito = { id: "deb-1", tipo: "debito", predeterminada_cobro: true, marca: "visa", ultimos4: "4242" };
const tarjetaCredito = { id: "cred-1", tipo: "credito", predeterminada_garantia: true, marca: "visa", ultimos4: "1111" };

jest.mock("@rentacar/mobile-shared/hooks/useTarjetas", () => ({
  useTarjetas: () => ({
    validadas: [tarjetaDebito, tarjetaCredito],
    tarjetasDebito: [tarjetaDebito],
    tarjetasCredito: [tarjetaCredito],
    agregar: jest.fn(),
    recargar: jest.fn(),
  }),
}));

jest.mock("expo-location", () => ({
  Accuracy: { Balanced: 3 },
  getForegroundPermissionsAsync: jest.fn(() => Promise.resolve({ status: "granted" })),
  requestForegroundPermissionsAsync: jest.fn(() => Promise.resolve({ status: "granted" })),
  getCurrentPositionAsync: jest.fn(() =>
    Promise.resolve({
      coords: { latitude: -33.4372, longitude: -70.6506, accuracy: 15 },
    })
  ),
  hasStartedLocationUpdatesAsync: jest.fn(() => Promise.resolve(false)),
  stopLocationUpdatesAsync: jest.fn(() => Promise.resolve()),
}));

const mockPagarReserva = jest.fn();
const mockGetReservas = jest.fn();
const mockAvisarLlegada = jest.fn();
jest.mock("@rentacar/mobile-shared/api/client", () => {
  const real = jest.requireActual("@rentacar/mobile-shared/api/client");
  return {
    ApiClient: {
      ...real.ApiClient,
      pagarReserva: (...a) => mockPagarReserva(...a),
      getReservas: (...a) => mockGetReservas(...a),
      avisarLlegada: (...a) => mockAvisarLlegada(...a),
      getConfiguracionPagos: jest.fn(() => Promise.resolve({ simulado: false })),
      actualizarTelemetria: jest.fn(() => Promise.resolve({})),
      reportarUbicacion: jest.fn(() => Promise.resolve({})),
    },
  };
});

const asentar = () => act(() => new Promise((r) => setTimeout(r, 0)));

let arbolActual = null;
afterEach(() => {
  if (arbolActual) arbolActual.unmount();
  arbolActual = null;
});
beforeEach(() => jest.clearAllMocks());

const auto = { id: "auto-1", marca: "Toyota", modelo: "Corolla", anio: 2024, tarifa_dia: 35000, ubicacion_base: "Los Ángeles", fotos: [] };
const reservaSinPagar = {
  id: "res-1",
  estado: "pendiente_pago",
  expira_en: new Date(Date.now() + 600000).toISOString(),
  fecha_inicio: "2026-09-20T10:00:00",
  fecha_fin: "2026-09-23T18:00:00",
  monto_hold: 100000,
  cobro: { monto: 90000, neto: 75630, iva: 14370 },
  garantia: { monto: 100000 },
  firmas: [{ rol: "arrendatario", metodo: "escrita" }],
  auto,
};

describe("PaymentMethodsScreen · respuesta del pago", () => {
  it("'esperando_dueno' es un pago exitoso: entrega la reserva como pendiente de confirmación", async () => {
    mockPagarReserva.mockResolvedValue({ estado: "esperando_dueno", confirmar_antes_de: "2026-09-21T10:00:00" });
    const onPaymentSuccess = jest.fn();
    const tr = renderTree(
      <PaymentMethodsScreen existingReservation={reservaSinPagar} onBack={() => {}} onPaymentSuccess={onPaymentSuccess} />
    );
    arbolActual = tr;
    await asentar();

    await act(async () => {
      pressText(tr, "Pagar y reservar");
      await asentar();
    });

    expect(onPaymentSuccess).toHaveBeenCalledTimes(1);
    expect(onPaymentSuccess.mock.calls[0][0]).toMatchObject({
      id: "res-1",
      estado: "pendiente",
      confirmar_dueno_antes_de: "2026-09-21T10:00:00",
    });
  });

  it("un cobro en revisión del banco sigue sin entregar la reserva como pagada", async () => {
    mockPagarReserva.mockResolvedValue({ estado: "pendiente", motivo: "El cobro quedó en revisión de tu banco." });
    const onPaymentSuccess = jest.fn();
    const tr = renderTree(
      <PaymentMethodsScreen existingReservation={reservaSinPagar} onBack={() => {}} onPaymentSuccess={onPaymentSuccess} />
    );
    arbolActual = tr;
    await asentar();

    await act(async () => {
      pressText(tr, "Pagar y reservar");
      await asentar();
    });
    expect(onPaymentSuccess).not.toHaveBeenCalled();

    // "Ver mis reservas" sale con la reserva SIN pagar: no debe hacerse pasar por "esperando al dueño".
    await act(async () => {
      pressText(tr, "Ver mis reservas");
    });
    expect(onPaymentSuccess.mock.calls[0][0].estado).toBe("pendiente_pago");
  });
});

describe("ActiveRentalScreen · reserva pagada esperando al dueño", () => {
  const montar = async (estado, extra = {}) => {
    const reservation = {
      id: "res-1",
      estado,
      auto,
      fecha_inicio: new Date(Date.now() + 5 * 86400000).toISOString(),
      fecha_fin: new Date(Date.now() + 8 * 86400000).toISOString(),
      monto_hold: 100000,
      ...extra,
    };
    const tr = renderTree(<ActiveRentalScreen reservation={reservation} onBack={() => {}} />);
    arbolActual = tr;
    await asentar();
    return tr;
  };

  it("'pendiente' se explica como espera del dueño, con el plazo y la devolución si no confirma", async () => {
    const tr = await montar("pendiente", { confirmar_dueno_antes_de: new Date(Date.now() + 20 * 3600000).toISOString() });
    const t = textOf(tr);
    expect(t).toMatch(/Esperando la confirmación del dueño/i);
    expect(t).toMatch(/para confirmar/i);
    expect(t).toMatch(/te devolvemos todo/i);
    expect(t).not.toContain("Reserva pendiente de pago");
    expect(t).not.toContain("Elegir tarjetas y pagar");
  });

  it("'pendiente_pago' sigue pidiendo pagar", async () => {
    const tr = await montar("pendiente_pago");
    expect(textOf(tr)).toContain("Reserva pendiente de pago");
  });

  it("una reserva cancelada porque el dueño no confirmó lo dice", async () => {
    const tr = await montar("cancelada", { motivo_cancelacion: "dueno_no_confirmo" });
    expect(textOf(tr)).toMatch(/dueño no confirmó/i);
  });

  it.each([
    ["dueno_no_presentacion", /dueño no se presentó.*te devolvimos todo/i],
    ["ninguno_se_presento", /nadie se presentó.*sin multas/i],
    ["no_presentacion", /no te presentaste.*multa/i],
  ])("una reserva cancelada por %s explica qué pasó", async (motivo, patron) => {
    const tr = await montar("cancelada", { motivo_cancelacion: motivo });
    expect(textOf(tr)).toMatch(patron);
  });
});

describe("ActiveRentalScreen · avisar que llegaste (base de la multa por no presentación)", () => {
  const horas = (h) => new Date(Date.now() + h * 3600000).toISOString();
  const montarConfirmada = async (extra = {}) => {
    const reservation = {
      id: "res-1", estado: "confirmada", auto, fecha_inicio: horas(1), fecha_fin: horas(72), monto_hold: 100000, ...extra,
    };
    const onUpdateReservation = jest.fn();
    const tr = renderTree(<ActiveRentalScreen reservation={reservation} onBack={() => {}} onUpdateReservation={onUpdateReservation} />);
    arbolActual = tr;
    await asentar();
    return { tr, onUpdateReservation };
  };

  it("desde 2 h antes aparece 'Ya llegué' y se avisa de la multa", async () => {
    const { tr } = await montarConfirmada();
    const t = textOf(tr);
    expect(t).toContain("Ya llegué al punto de encuentro");
    expect(t).toMatch(/multa/i);
  });

  it("con horas de anticipación no aparece", async () => {
    const { tr } = await montarConfirmada({ fecha_inicio: horas(6) });
    expect(textOf(tr)).not.toContain("Ya llegué al punto de encuentro");
  });

  it("tocarlo avisa a la API y deja constancia en pantalla", async () => {
    mockAvisarLlegada.mockResolvedValue({ id: "res-1", estado: "confirmada", llegada_cliente_en: horas(0) });
    const { tr, onUpdateReservation } = await montarConfirmada();

    await act(async () => {
      pressText(tr, "Ya llegué al punto de encuentro");
    });
    await asentar();

    expect(mockAvisarLlegada).toHaveBeenCalledWith(
      "res-1",
      expect.objectContaining({ latitud: -33.4372, longitud: -70.6506 })
    );
    expect(onUpdateReservation).toHaveBeenCalled();
    expect(textOf(tr)).toContain("Avisaste que llegaste");
    expect(textOf(tr)).not.toContain("Ya llegué al punto de encuentro");
  });

  it("si el backend lo rechaza muestra el motivo", async () => {
    mockAvisarLlegada.mockRejectedValue(Object.assign(new Error("Todavía es muy pronto."), { status: 409 }));
    const { tr } = await montarConfirmada();

    await act(async () => {
      pressText(tr, "Ya llegué al punto de encuentro");
    });
    await asentar();

    expect(textOf(tr)).toMatch(/Todavía es muy pronto/);
  });

  it("si el dueño ya avisó que llegó, el arrendatario lo ve", async () => {
    const { tr } = await montarConfirmada({ llegada_dueno_en: horas(-0.1) });
    expect(textOf(tr)).toContain("El dueño ya llegó");
  });
});

describe("RentalHistoryScreen · reservas esperando al dueño", () => {
  it("aparecen en 'Próximas' con la etiqueta 'Esperando al dueño'", async () => {
    mockGetReservas.mockResolvedValue([{ id: "r-esp", estado: "pendiente", auto: { marca: "Suzuki", modelo: "Swift", anio: 2023 } }]);
    const tr = renderTree(<RentalHistoryScreen onSelectReservation={() => {}} onBack={() => {}} />);
    arbolActual = tr;
    await asentar();

    act(() => pressText(tr, "Próximas"));
    await asentar();

    expect(textOf(tr)).toContain("Swift");
    expect(textOf(tr)).toContain("Esperando al dueño");
  });
});
