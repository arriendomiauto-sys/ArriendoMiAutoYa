/**
 * Lista de conversaciones por reserva: cruza el resumen (última línea + no
 * leídos, de `useConversaciones`) con las reservas del usuario. La usan
 * tanto el dueño como el arrendatario — antes solo existía para el dueño y
 * el arrendatario solo podía entrar a su reserva activa, sin lista.
 */
import React from "react";
import { act } from "react-test-renderer";
import { ChatListScreen } from "@rentacar/mobile-shared/screens/ChatListScreen";
import { renderTree, textOf } from "../test-utils";

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

const mockGetReservas = jest.fn();
jest.mock("@rentacar/mobile-shared/api/client", () => {
  const real = jest.requireActual("@rentacar/mobile-shared/api/client");
  return {
    ApiClient: { ...real.ApiClient, getReservas: (...a) => mockGetReservas(...a) },
  };
});

const mockConversaciones = { conversaciones: [], refrescar: jest.fn() };
jest.mock("@rentacar/mobile-shared/hooks/useConversaciones", () => ({
  useConversaciones: () => mockConversaciones,
}));

const asentar = () => new Promise((r) => setTimeout(r, 0));

const montar = async (rol = "owner") => {
  let tr;
  await act(async () => {
    tr = renderTree(<ChatListScreen rol={rol} onSelectReserva={() => {}} onBack={() => {}} />);
    await asentar();
  });
  return tr;
};

const ahora = Date.now();
const reservasDueño = [
  { id: "r-vieja", estado: "finalizada", cliente_id: "cli-1", fecha_inicio: "2026-08-01T00:00:00Z", auto: { marca: "Kia", modelo: "Rio" } },
  { id: "r-nueva", estado: "en_curso", cliente_id: "cli-2", fecha_inicio: "2026-09-05T00:00:00Z", auto: { marca: "Suzuki", modelo: "Swift" } },
  { id: "r-sin-msgs", estado: "confirmada", cliente_id: "cli-3", fecha_inicio: "2026-09-10T00:00:00Z", auto: { marca: "Toyota", modelo: "Yaris" } },
];

beforeEach(() => {
  mockGetReservas.mockReset().mockResolvedValue(reservasDueño);
  mockConversaciones.conversaciones = [
    { reserva_id: "r-vieja", ultimo_mensaje: "Gracias por todo", ultimo_timestamp: new Date(ahora - 3600_000).toISOString(), ultimo_autor_id: "cli-1", no_leidos: 0 },
    { reserva_id: "r-nueva", ultimo_mensaje: "¿A qué hora llegas?", ultimo_timestamp: new Date(ahora - 60_000).toISOString(), ultimo_autor_id: "cli-2", no_leidos: 2 },
  ];
});

describe("ChatListScreen · dueño", () => {
  it("pide las reservas como dueño y muestra la última línea y el contador de no leídos", async () => {
    const tr = await montar("owner");
    expect(mockGetReservas).toHaveBeenCalledWith("dueno");
    const t = textOf(tr);
    expect(t).toContain("¿A qué hora llegas?");
    expect(t).toContain("Gracias por todo");
    expect(t).toContain("Sin mensajes aún"); // la reserva sin conversación
    expect(t).toContain("2");
  });

  it("ordena por mensaje más reciente y deja al final las reservas sin mensajes", async () => {
    const tr = await montar("owner");
    const t = textOf(tr);
    const iNueva = t.indexOf("Suzuki Swift");
    const iVieja = t.indexOf("Kia Rio");
    const iSin = t.indexOf("Toyota Yaris");
    expect(iNueva).toBeGreaterThanOrEqual(0);
    expect(iNueva).toBeLessThan(iVieja);
    expect(iVieja).toBeLessThan(iSin);
  });

  it("prefija 'Tú:' cuando el último mensaje lo escribió el dueño (no el cliente de esa reserva)", async () => {
    mockConversaciones.conversaciones = [
      { reserva_id: "r-nueva", ultimo_mensaje: "Voy en camino", ultimo_timestamp: new Date(ahora).toISOString(), ultimo_autor_id: "dueno-x", no_leidos: 0 },
    ];
    const tr = await montar("owner");
    expect(textOf(tr)).toContain("Tú: Voy en camino");
  });
});

describe("ChatListScreen · arrendatario", () => {
  const reservasCliente = [
    { id: "r1", estado: "en_curso", auto: { marca: "Kia", modelo: "Rio", dueno_id: "dueno-1" } },
  ];

  it("pide las reservas como cliente, no como dueño", async () => {
    mockGetReservas.mockResolvedValue(reservasCliente);
    await montar("renter");
    expect(mockGetReservas).toHaveBeenCalledWith("cliente");
  });

  it("sin conversaciones, muestra el mensaje vacío propio del arrendatario", async () => {
    mockGetReservas.mockResolvedValue([]);
    const tr = await montar("renter");
    expect(textOf(tr)).toContain("Cuando tengas un arriendo activo o confirmado");
  });

  it("prefija 'Tú:' cuando el último mensaje lo escribió el propio arrendatario (no el dueño del auto)", async () => {
    mockGetReservas.mockResolvedValue(reservasCliente);
    mockConversaciones.conversaciones = [
      { reserva_id: "r1", ultimo_mensaje: "Ya llegué", ultimo_timestamp: new Date(ahora).toISOString(), ultimo_autor_id: "yo-arrendatario", no_leidos: 0 },
    ];
    const tr = await montar("renter");
    expect(textOf(tr)).toContain("Tú: Ya llegué");
  });

  it("no antepone 'Tú:' cuando el último mensaje lo escribió el dueño del auto", async () => {
    mockGetReservas.mockResolvedValue(reservasCliente);
    mockConversaciones.conversaciones = [
      { reserva_id: "r1", ultimo_mensaje: "Te espero en la entrada", ultimo_timestamp: new Date(ahora).toISOString(), ultimo_autor_id: "dueno-1", no_leidos: 0 },
    ];
    const tr = await montar("renter");
    const t = textOf(tr);
    expect(t).toContain("Te espero en la entrada");
    expect(t).not.toContain("Tú: Te espero en la entrada");
  });
});
