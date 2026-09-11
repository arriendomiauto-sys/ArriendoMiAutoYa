/**
 * El cliente se quedaba mirando la pantalla del código QR sin ninguna señal
 * en vivo de que el dueño ya lo escaneó y confirmó su identidad — tenía que
 * salir y volver a entrar a la app para enterarse. Ahora la pantalla abre
 * (solo para escuchar, nunca para enviar) el canal de la reserva.
 */
import React from "react";
import { act } from "react-test-renderer";
import { MyQRCodeScreen } from "../src/renter/screens/MyQRCodeScreen";
import { renderTree, textOf } from "../test-utils";

const mockGenerarCodigoQR = jest.fn();
jest.mock("@rentacar/mobile-shared/api/client", () => {
  const real = jest.requireActual("@rentacar/mobile-shared/api/client");
  return {
    ApiClient: { ...real.ApiClient, generarCodigoQR: (...a) => mockGenerarCodigoQR(...a) },
  };
});

const mockShowAlert = jest.fn();
jest.mock("@rentacar/mobile-shared", () => {
  const real = jest.requireActual("@rentacar/mobile-shared");
  return { ...real, showAlert: (...a) => mockShowAlert(...a) };
});

const mockCerrar = jest.fn();
let capturedCbs = null;
const mockConectarChat = jest.fn((reservaId, cbs) => {
  capturedCbs = cbs;
  return { cerrar: mockCerrar };
});
jest.mock("@rentacar/mobile-shared/api/chatSocket", () => ({
  conectarChat: (...a) => mockConectarChat(...a),
}));

const asentar = () => act(() => new Promise((r) => setTimeout(r, 0)));

const reservation = { id: "res-1", estado: "confirmada", auto: { marca: "Kia", modelo: "Rio" } };

let arbolActual = null;
afterEach(() => {
  if (arbolActual) arbolActual.unmount();
  arbolActual = null;
  capturedCbs = null;
});

beforeEach(() => {
  jest.clearAllMocks();
  mockGenerarCodigoQR.mockResolvedValue({ codigo_qr_hash: "ABCD1234EFGH", validez_segundos: 120 });
});

describe("MyQRCodeScreen · escucha entrega_confirmada", () => {
  it("abre el canal de la reserva solo para escuchar mientras el código está en pantalla", async () => {
    const tr = renderTree(<MyQRCodeScreen reservation={reservation} onBack={() => {}} />);
    arbolActual = tr;
    await asentar();

    expect(mockConectarChat).toHaveBeenCalledWith("res-1", expect.objectContaining({ onEntregaConfirmada: expect.any(Function) }));
  });

  it("al confirmarse la entrega, avisa y ofrece volver al arriendo", async () => {
    const onBack = jest.fn();
    const tr = renderTree(<MyQRCodeScreen reservation={reservation} onBack={onBack} />);
    arbolActual = tr;
    await asentar();

    act(() => {
      capturedCbs.onEntregaConfirmada({ reserva_id: "res-1", tipo: "entrega", resultado: "checklist_fotos" });
    });

    expect(mockShowAlert).toHaveBeenCalledWith(
      "Entrega confirmada",
      expect.any(String),
      expect.arrayContaining([expect.objectContaining({ onPress: onBack })])
    );
  });

  it("cierra el canal al desmontar", async () => {
    const tr = renderTree(<MyQRCodeScreen reservation={reservation} onBack={() => {}} />);
    arbolActual = tr;
    await asentar();

    tr.unmount();
    arbolActual = null;

    expect(mockCerrar).toHaveBeenCalled();
  });

  it("en devolución (estado en_curso), el aviso dice 'Devolución confirmada'", async () => {
    const tr = renderTree(
      <MyQRCodeScreen reservation={{ ...reservation, estado: "en_curso" }} onBack={() => {}} />
    );
    arbolActual = tr;
    await asentar();

    act(() => {
      capturedCbs.onEntregaConfirmada({ reserva_id: "res-1", tipo: "devolucion", resultado: "cerrada" });
    });

    expect(mockShowAlert).toHaveBeenCalledWith("Devolución confirmada", expect.any(String), expect.any(Array));
  });
});
