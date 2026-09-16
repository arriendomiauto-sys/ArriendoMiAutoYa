/**
 * Chat de coordinación: cola optimista. El mensaje aparece al instante como
 * "Enviando…" y se concilia con el real (por el ACK del socket o por REST) sin
 * duplicarse. Si el envío no se resuelve, queda "No se envió · toca para
 * reintentar".
 */
import React from "react";
import { act } from "react-test-renderer";
import { RentalChatScreen } from "@rentacar/mobile-shared/screens/RentalChatScreen";
import { renderTree, textOf } from "../test-utils";

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

// Canal en vivo controlable desde el test.
let mockCanal;
const mockEnviar = jest.fn(() => true);
jest.mock("@rentacar/mobile-shared/api/chatSocket", () => ({
  conectarChat: (reservaId, cbs) => {
    mockCanal = {
      cbs,
      enviar: (...a) => mockEnviar(...a),
      escribir: jest.fn(),
      conectado: () => true,
      cerrar: jest.fn(),
    };
    // Arranca "conectado" como lo haría el socket real.
    setTimeout(() => cbs.onEstado && cbs.onEstado("conectado"), 0);
    return mockCanal;
  },
}));

const mockGetMensajes = jest.fn(async () => []);
const mockEnviarMensajeREST = jest.fn(async () => ({}));
jest.mock("@rentacar/mobile-shared/api/client", () => {
  const real = jest.requireActual("@rentacar/mobile-shared/api/client");
  real.ApiClient.getMensajes = (...a) => mockGetMensajes(...a);
  real.ApiClient.enviarMensaje = (...a) => mockEnviarMensajeREST(...a);
  return { ...real, ApiClient: real.ApiClient };
});

jest.mock("@rentacar/mobile-shared/context/AppContext", () => ({
  useApp: () => ({ currentUser: { id: "u-yo" } }),
}));

const AsyncStorage = require("@react-native-async-storage/async-storage");
const limpiarStorage = () => (AsyncStorage.default || AsyncStorage).clear();

const asentar = () => new Promise((r) => setTimeout(r, 0));
const reserva = { id: "res-12345678", auto: { marca: "Kia", modelo: "Rio" } };

const escribirYEnviar = async (tr, texto) => {
  const input = tr.root.findAll((n) => typeof n.props?.onChangeText === "function")[0];
  await act(async () => {
    input.props.onChangeText(texto);
    await asentar();
  });
  await act(async () => {
    input.props.onSubmitEditing();
    await asentar();
  });
};

beforeEach(async () => {
  mockEnviar.mockReset().mockReturnValue(true);
  mockGetMensajes.mockReset().mockResolvedValue([]);
  mockEnviarMensajeREST.mockReset().mockResolvedValue({});
  mockCanal = null;
  await limpiarStorage();
});

describe("RentalChatScreen · cola optimista", () => {
  it("el mensaje aparece al instante como 'Enviando…' antes de cualquier red", async () => {
    let tr;
    await act(async () => {
      tr = renderTree(<RentalChatScreen reservation={reserva} onBack={() => {}} />);
      await asentar();
    });

    await escribirYEnviar(tr, "Voy llegando");

    const t = textOf(tr);
    expect(t).toContain("Voy llegando");
    expect(t).toContain("Enviando…");
    expect(mockEnviar).toHaveBeenCalledWith("Voy llegando", expect.any(String));
  });

  it("al llegar el mensaje real (ACK/broadcast) se concilia sin duplicar", async () => {
    let tr;
    await act(async () => {
      tr = renderTree(<RentalChatScreen reservation={reserva} onBack={() => {}} />);
      await asentar();
    });
    await escribirYEnviar(tr, "Hola");

    const clientId = mockEnviar.mock.calls[0][1];
    await act(async () => {
      mockCanal.cbs.onMensaje({
        id: "real-1",
        reserva_id: reserva.id,
        autor_id: "u-yo",
        texto: "Hola",
        timestamp: "2026-09-06T12:00:00Z",
        _clientId: clientId,
      });
      await asentar();
    });

    const t = textOf(tr);
    expect(t.match(/Hola/g)).toHaveLength(1); // una sola burbuja
    expect(t).not.toContain("Enviando…");
  });

  it("si el envío no se resuelve, queda 'No se envió' y se puede reintentar", async () => {
    let tr;
    await act(async () => {
      tr = renderTree(<RentalChatScreen reservation={reserva} onBack={() => {}} />);
      await asentar();
    });
    await escribirYEnviar(tr, "¿Hay señal?");

    const clientId = mockEnviar.mock.calls[0][1];
    await act(async () => {
      mockCanal.cbs.onEnvioResuelto({ clientId, ok: false, error: "timeout" });
      await asentar();
    });

    expect(textOf(tr)).toContain("No se envió");

    // Tocar la burbuja reintenta.
    mockEnviar.mockClear();
    const burbuja = tr.root.findAll(
      (n) => n.props?.accessibilityLabel === "Reintentar enviar el mensaje"
    )[0];
    await act(async () => {
      burbuja.props.onPress();
      await asentar();
    });
    expect(mockEnviar).toHaveBeenCalledWith("¿Hay señal?", clientId);
  });

  it("un ACK que llega tarde no marca 'No se envió' un mensaje que ya se concilió", async () => {
    let tr;
    await act(async () => {
      tr = renderTree(<RentalChatScreen reservation={reserva} onBack={() => {}} />);
      await asentar();
    });
    await escribirYEnviar(tr, "Confirmado");

    const clientId = mockEnviar.mock.calls[0][1];
    // El broadcast concilia el optimista como "enviado"…
    await act(async () => {
      mockCanal.cbs.onMensaje({
        id: "real-9",
        reserva_id: reserva.id,
        autor_id: "u-yo",
        texto: "Confirmado",
        timestamp: "2026-09-06T12:00:00Z",
      });
      await asentar();
    });
    // …y recién después el envío "se resuelve" como no-ACK (timeout de 12 s).
    await act(async () => {
      mockCanal.cbs.onEnvioResuelto({ clientId, ok: false, error: "timeout" });
      await asentar();
    });

    const t = textOf(tr);
    expect(t).not.toContain("No se envió");
    expect(t).not.toContain("Enviando…");
    expect(t.match(/Confirmado/g)).toHaveLength(1);
  });

  it("un mensaje sin enviar sobrevive a cerrar y reabrir la conversación", async () => {
    // Primera sesión: se envía algo y el envío nunca se resuelve → "fallido".
    let tr1;
    await act(async () => {
      tr1 = renderTree(<RentalChatScreen reservation={reserva} onBack={() => {}} />);
      await asentar();
    });
    await escribirYEnviar(tr1, "Voy en camino");
    const clientId = mockEnviar.mock.calls[0][1];
    await act(async () => {
      mockCanal.cbs.onEnvioResuelto({ clientId, ok: false });
      await asentar();
    });
    expect(textOf(tr1)).toContain("No se envió");

    // Se cierra la pantalla.
    await act(async () => {
      tr1.unmount();
      await asentar();
    });

    // Segunda sesión (misma reserva): el mensaje pendiente se rehidrata del
    // outbox aunque el historial del servidor venga vacío.
    mockEnviar.mockClear();
    let tr2;
    await act(async () => {
      tr2 = renderTree(<RentalChatScreen reservation={reserva} onBack={() => {}} />);
      await asentar();
      await asentar();
    });

    expect(textOf(tr2)).toContain("Voy en camino");
    // Y al haber canal en vivo, se reintenta solo.
    expect(mockEnviar).toHaveBeenCalledWith("Voy en camino", expect.any(String));
  });

  it("con el canal caído manda por REST sin bloquear la interfaz", async () => {
    mockEnviar.mockReturnValue(false); // canal no disponible
    mockEnviarMensajeREST.mockResolvedValue({
      id: "real-rest",
      reserva_id: reserva.id,
      autor_id: "u-yo",
      texto: "Por REST",
      timestamp: "2026-09-06T12:01:00Z",
    });

    let tr;
    await act(async () => {
      tr = renderTree(<RentalChatScreen reservation={reserva} onBack={() => {}} />);
      await asentar();
    });
    await escribirYEnviar(tr, "Por REST");

    expect(mockEnviarMensajeREST).toHaveBeenCalledWith(reserva.id, "Por REST");
    await act(async () => {
      await asentar();
    });
    const t = textOf(tr);
    expect(t.match(/Por REST/g)).toHaveLength(1);
    expect(t).not.toContain("Enviando…");
  });
});
