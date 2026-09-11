/**
 * El cliente se queda mirando la pantalla del código QR esperando que el
 * dueño lo escanee, sin ninguna señal en vivo de que ya lo verificaron.
 * `conectarChat` ahora expone `onEntregaConfirmada`, que se dispara con el
 * evento de socket homónimo (misma sala `reserva_{id}` que usa el chat).
 */
jest.mock("@rentacar/mobile-shared/api/supabase", () => ({
  getAccessToken: jest.fn(async () => "token-de-prueba"),
}));

const listeners = {};
const mockSocket = {
  on: jest.fn((evento, cb) => {
    listeners[evento] = cb;
  }),
  emit: jest.fn(),
  disconnect: jest.fn(),
  connected: true,
};
const mockIo = jest.fn(() => mockSocket);
jest.mock("socket.io-client", () => ({ io: (...a) => mockIo(...a) }));

const { conectarChat } = require("@rentacar/mobile-shared/api/chatSocket");

const asentar = () => new Promise((resolve) => setTimeout(resolve, 0));

beforeEach(() => {
  jest.clearAllMocks();
  for (const k of Object.keys(listeners)) delete listeners[k];
});

describe("chatSocket · entrega_confirmada", () => {
  it("dispara onEntregaConfirmada cuando llega el evento de socket", async () => {
    const onEntregaConfirmada = jest.fn();
    const canal = conectarChat("res-1", { onEntregaConfirmada });
    await asentar();

    expect(typeof listeners.entrega_confirmada).toBe("function");

    listeners.entrega_confirmada({ reserva_id: "res-1", tipo: "entrega", resultado: "checklist_fotos" });

    expect(onEntregaConfirmada).toHaveBeenCalledWith({
      reserva_id: "res-1",
      tipo: "entrega",
      resultado: "checklist_fotos",
    });

    canal.cerrar();
  });

  it("no explota si no se pasa onEntregaConfirmada", async () => {
    const canal = conectarChat("res-1", {});
    await asentar();

    expect(() =>
      listeners.entrega_confirmada({ reserva_id: "res-1", tipo: "devolucion", resultado: "cerrada" })
    ).not.toThrow();

    canal.cerrar();
  });
});
