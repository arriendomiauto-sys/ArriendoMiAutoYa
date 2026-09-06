/**
 * Lista de mensajes del dueño: cruza el resumen de conversaciones (última
 * línea + no leídos, de `useConversaciones`) con sus reservas. Antes solo
 * listaba reservas sin ninguna señal de qué conversación tenía algo nuevo.
 */
import React from "react";
import { act } from "react-test-renderer";
import { ChatListScreen } from "../src/owner/screens/ChatListScreen";
import { renderTree, textOf } from "../test-utils";

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

const mockGetReservas = jest.fn();
const mockConversaciones = { conversaciones: [], refrescar: jest.fn() };
jest.mock("@rentacar/mobile-shared", () => {
  const real = jest.requireActual("@rentacar/mobile-shared");
  return {
    ...real,
    ApiClient: { ...real.ApiClient, getReservas: (...a) => mockGetReservas(...a) },
    useConversaciones: () => mockConversaciones,
  };
});

const asentar = () => new Promise((r) => setTimeout(r, 0));

const montar = async () => {
  let tr;
  await act(async () => {
    tr = renderTree(<ChatListScreen onSelectReserva={() => {}} onBack={() => {}} />);
    await asentar();
  });
  return tr;
};

const ahora = Date.now();
const reservas = [
  { id: "r-vieja", estado: "finalizada", cliente_id: "cli-1", fecha_inicio: "2026-08-01T00:00:00Z", auto: { marca: "Kia", modelo: "Rio" } },
  { id: "r-nueva", estado: "en_curso", cliente_id: "cli-2", fecha_inicio: "2026-09-05T00:00:00Z", auto: { marca: "Suzuki", modelo: "Swift" } },
  { id: "r-sin-msgs", estado: "confirmada", cliente_id: "cli-3", fecha_inicio: "2026-09-10T00:00:00Z", auto: { marca: "Toyota", modelo: "Yaris" } },
];

beforeEach(() => {
  mockGetReservas.mockReset().mockResolvedValue(reservas);
  mockConversaciones.conversaciones = [
    { reserva_id: "r-vieja", ultimo_mensaje: "Gracias por todo", ultimo_timestamp: new Date(ahora - 3600_000).toISOString(), ultimo_autor_id: "cli-1", no_leidos: 0 },
    { reserva_id: "r-nueva", ultimo_mensaje: "¿A qué hora llegas?", ultimo_timestamp: new Date(ahora - 60_000).toISOString(), ultimo_autor_id: "cli-2", no_leidos: 2 },
  ];
});

describe("ChatListScreen · lista de conversaciones", () => {
  it("muestra la última línea y el contador de no leídos", async () => {
    const tr = await montar();
    const t = textOf(tr);
    expect(t).toContain("¿A qué hora llegas?");
    expect(t).toContain("Gracias por todo");
    expect(t).toContain("Sin mensajes aún"); // la reserva sin conversación
    // 2 no leídos en r-nueva
    expect(t).toContain("2");
  });

  it("ordena por mensaje más reciente y deja al final las reservas sin mensajes", async () => {
    const tr = await montar();
    // Orden de aparición de los autos en el árbol.
    const t = textOf(tr);
    const iNueva = t.indexOf("Suzuki Swift");
    const iVieja = t.indexOf("Kia Rio");
    const iSin = t.indexOf("Toyota Yaris");
    expect(iNueva).toBeGreaterThanOrEqual(0);
    expect(iNueva).toBeLessThan(iVieja);
    expect(iVieja).toBeLessThan(iSin);
  });

  it("prefija 'Tú:' cuando el último mensaje lo escribió el dueño", async () => {
    mockConversaciones.conversaciones = [
      { reserva_id: "r-nueva", ultimo_mensaje: "Voy en camino", ultimo_timestamp: new Date(ahora).toISOString(), ultimo_autor_id: "dueno-x", no_leidos: 0 },
    ];
    const tr = await montar();
    expect(textOf(tr)).toContain("Tú: Voy en camino");
  });
});
