import React from "react";
import { act } from "react-test-renderer";
import { PaymentMethodsScreen } from "../src/renter/screens/PaymentMethodsScreen";
import { SelectorTarjeta } from "../src/renter/components/SelectorTarjeta";
import { renderTree, textOf, pressText } from "../test-utils";

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock("@rentacar/mobile-shared/context/AppContext", () => ({
  useApp: () => ({ currentUser: { nombre: "Camila Rojas", rut: "11.111.111-1" } }),
}));

const debito = { id: "deb-1", tipo: "debito", marca: "visa", ultimos4: "4821", vencimiento: "08/28", predeterminada_cobro: true };
const credito = { id: "cred-1", tipo: "credito", marca: "mastercard", ultimos4: "1093", vencimiento: "02/29", predeterminada_garantia: true };

jest.mock("@rentacar/mobile-shared/hooks/useTarjetas", () => ({
  useTarjetas: () => ({
    validadas: [debito, credito],
    tarjetasDebito: [debito],
    tarjetasCredito: [credito],
    agregar: jest.fn(),
    recargar: jest.fn(),
  }),
}));

const mockPagarReserva = jest.fn();
const mockGetConfiguracionPagos = jest.fn();

jest.mock("@rentacar/mobile-shared/api/client", () => {
  const real = jest.requireActual("@rentacar/mobile-shared/api/client");
  return {
    ApiClient: {
      ...real.ApiClient,
      pagarReserva: (...a) => mockPagarReserva(...a),
      getConfiguracionPagos: (...a) => mockGetConfiguracionPagos(...a),
    },
  };
});

const asentar = () => act(() => new Promise((r) => setTimeout(r, 0)));

const reserva = () => ({
  id: "res-1",
  estado: "pendiente_pago",
  expira_en: new Date(Date.now() + 25 * 60000).toISOString(),
  fecha_inicio: "2026-09-23T10:00:00",
  fecha_fin: "2026-09-26T10:00:00",
  cobro: { monto: 66000, neto: 55462, iva: 10538 },
  garantia: { monto: 250000 },
  firmas: [{ rol: "arrendatario", metodo: "escrita" }],
  auto: { id: "a-1", marca: "Kia", modelo: "Soluto", anio: 2022, tarifa_dia: 22000, ubicacion_base: "Los Ángeles", fotos: [] },
});

let arbol = null;
afterEach(() => {
  if (arbol) arbol.unmount();
  arbol = null;
});

describe("SelectorTarjeta · filas más legibles", () => {
  const render = (props) =>
    renderTree(
      <SelectorTarjeta
        titulo="Cobro del arriendo"
        tarjetas={[debito, credito]}
        seleccionadaId="deb-1"
        onSeleccionar={() => {}}
        onAgregar={() => {}}
        tipoVacio="débito o crédito"
        {...props}
      />
    );

  it("cada tarjeta muestra su marca, los últimos dígitos, el vencimiento y si es débito o crédito", () => {
    const t = textOf(render());
    expect(t).toContain("VISA");
    expect(t).toContain("•••• 4821");
    expect(t).toContain("Vence 08/28");
    expect(t).toContain("Débito");
    expect(t).toContain("MC");
    expect(t).toContain("•••• 1093");
    expect(t).toContain("Crédito");
  });

  it("muestra la insignia que le pase la pantalla junto al título", () => {
    expect(textOf(render({ insignia: "Mercado Pago" }))).toContain("Mercado Pago");
    expect(textOf(render())).not.toContain("Mercado Pago");
  });

  it("sigue eligiendo por toque y conserva los ids de prueba", () => {
    const onSeleccionar = jest.fn();
    const tr = render({ onSeleccionar });
    const fila = tr.root.find((n) => n.props?.testID === "tarjeta-debito-1" && typeof n.type === "function");
    act(() => fila.props.onPress());
    expect(onSeleccionar).toHaveBeenCalledWith("cred-1");
  });
});

describe("PaymentMethodsScreen · resumen y confianza", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetConfiguracionPagos.mockResolvedValue({ simulado: false });
  });

  it("separa lo que se cobra hoy de la garantía, que no es un cobro", async () => {
    arbol = renderTree(<PaymentMethodsScreen existingReservation={reserva()} onBack={() => {}} onPaymentSuccess={() => {}} />);
    await asentar();
    const t = textOf(arbol);
    expect(t).toContain("Se cobra hoy");
    expect(t).toContain("$66.000");
    expect(t).toContain("Garantía (no es un cobro)");
    expect(t).toContain("$250.000");
  });

  it("dice quién procesa el pago y lo destaca en el bloque del cobro", async () => {
    arbol = renderTree(<PaymentMethodsScreen existingReservation={reserva()} onBack={() => {}} onPaymentSuccess={() => {}} />);
    await asentar();
    const t = textOf(arbol);
    expect(t).toContain("Pago procesado por Mercado Pago");
    expect(t).toContain("Solo crédito");
  });

  it("en modo de prueba no dice que Mercado Pago procesa nada", async () => {
    mockGetConfiguracionPagos.mockResolvedValue({ simulado: true });
    arbol = renderTree(<PaymentMethodsScreen existingReservation={reserva()} onBack={() => {}} onPaymentSuccess={() => {}} />);
    await asentar();
    expect(textOf(arbol)).not.toContain("Pago procesado por Mercado Pago");
  });

  it("si la garantía no tiene cupo, recuerda cuánto tiempo queda de la reserva", async () => {
    const sinCupo = new Error("Sin cupo");
    sinCupo.detail = { codigo: "SIN_CUPO", campo: "garantia", mensaje: "Sin cupo" };
    mockPagarReserva.mockRejectedValue(sinCupo);

    arbol = renderTree(<PaymentMethodsScreen existingReservation={reserva()} onBack={() => {}} onPaymentSuccess={() => {}} />);
    await asentar();
    expect(textOf(arbol)).not.toMatch(/Tu reserva vence en/);

    await act(async () => {
      pressText(arbol, "Pagar y reservar");
      await asentar();
    });

    expect(textOf(arbol)).toMatch(/Tu reserva vence en \d/);
    expect(textOf(arbol)).toMatch(/Agregar otra tarjeta de crédito con cupo/i);
  });
});
