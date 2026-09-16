/**
 * "Mis reclamos" con datos reales del backend, no en memoria del componente.
 *
 * Antes `enviados` era un useState local: cerrar la app (o solo salir de la
 * pantalla) borraba el historial completo de reclamos. El estado real que
 * soporte le va asignando al ticket (en revisión, cerrado, escalado a
 * disputa) tampoco se veía nunca, porque nada volvía a preguntarle al
 * backend.
 */
import React from "react";
import { act } from "react-test-renderer";
import { DisputesScreen } from "../src/owner/screens/DisputesScreen";
import { renderTree, textOf, pressText } from "../test-utils";

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

const mockGetMisTickets = jest.fn();
const mockCrearTicket = jest.fn();
jest.mock("@rentacar/mobile-shared", () => {
  const real = jest.requireActual("@rentacar/mobile-shared");
  return {
    ...real,
    ApiClient: {
      ...real.ApiClient,
      getMisTicketsSoporte: (...a) => mockGetMisTickets(...a),
      crearTicketSoporte: (...a) => mockCrearTicket(...a),
    },
  };
});

const asentar = async () => {
  await act(async () => {
    await Promise.resolve();
  });
};

const montar = async () => {
  const tr = renderTree(<DisputesScreen onBack={() => {}} />);
  await asentar();
  return tr;
};

beforeEach(() => {
  mockGetMisTickets.mockReset();
  mockCrearTicket.mockReset();
});

describe("Disputas del dueño · persistencia real", () => {
  it("al abrir la pantalla trae los tickets reales, no arranca vacía", async () => {
    mockGetMisTickets.mockResolvedValue([
      {
        id: "ticket-1",
        asunto: "Reclamo de garantía (Dueño)",
        descripcion: "Peaje no pagado en Autopista del Sol.",
        estado: "abierto",
        timestamp: "2026-08-01T10:00:00Z",
      },
    ]);

    const tr = await montar();
    const t = textOf(tr);
    expect(t).toContain("Mis reclamos (1)");
    expect(t).toContain("Peaje no pagado en Autopista del Sol.");
  });

  it("traduce cada estado real del ticket a un badge distinto", async () => {
    mockGetMisTickets.mockResolvedValue([
      { id: "t1", asunto: "A", descripcion: "d1", estado: "abierto", timestamp: "2026-08-01T10:00:00Z" },
      { id: "t2", asunto: "B", descripcion: "d2", estado: "en_revision", timestamp: "2026-08-01T10:00:00Z" },
      { id: "t3", asunto: "C", descripcion: "d3", estado: "cerrado", timestamp: "2026-08-01T10:00:00Z" },
      { id: "t4", asunto: "D", descripcion: "d4", estado: "escalado_a_disputa", timestamp: "2026-08-01T10:00:00Z" },
    ]);

    const t = textOf(await montar());
    expect(t).toContain("Recibido");
    expect(t).toContain("En revisión");
    expect(t).toContain("Cerrado");
    expect(t).toContain("Escalado a disputa");
  });

  it("un reclamo nuevo aparece de inmediato y queda respaldado en el backend", async () => {
    mockGetMisTickets.mockResolvedValue([]);
    mockCrearTicket.mockResolvedValue({
      id: "ticket-nuevo",
      asunto: "Reclamo de garantía (Dueño)",
      descripcion: "Tipo de cobro: Peaje / TAG\nMonto: $15.000\nDetalle: cobro pendiente",
      estado: "abierto",
      timestamp: "2026-08-10T10:00:00Z",
    });

    const tr = await montar();
    pressText(tr, "Ingresar disputa");

    const montoInput = tr.root.findAll(
      (n) => n.props?.placeholder === "25000" && typeof n.props?.onChangeText === "function"
    )[0];
    act(() => montoInput.props.onChangeText("15000"));
    const descInput = tr.root.findAll(
      (n) => typeof n.props?.multiline !== "undefined" && typeof n.props?.onChangeText === "function"
    )[0];
    act(() => descInput.props.onChangeText("cobro pendiente"));

    await act(async () => {
      pressText(tr, "Enviar a mediación");
      await Promise.resolve();
    });

    expect(mockCrearTicket).toHaveBeenCalled();

    // El ticket que acaba de crear el backend ya está en la lista (no hace
    // falta cerrar y volver a abrir la pantalla para verlo).
    pressText(tr, "Mis reclamos (1)");
    expect(textOf(tr)).toContain("cobro pendiente");
  });

  it("un error al cargar muestra reintentar, no una lista vacía silenciosa", async () => {
    mockGetMisTickets.mockRejectedValue(new Error("Sin conexión"));

    const t = textOf(await montar());
    expect(t).toContain("No pudimos cargar tus reclamos");
    expect(t).toContain("Reintentar");
  });

  it("reintentar vuelve a pedir los tickets", async () => {
    mockGetMisTickets.mockRejectedValueOnce(new Error("Sin conexión"));
    mockGetMisTickets.mockResolvedValueOnce([
      { id: "t1", asunto: "A", descripcion: "recuperado", estado: "abierto", timestamp: "2026-08-01T10:00:00Z" },
    ]);

    const tr = await montar();
    await act(async () => {
      pressText(tr, "Reintentar");
      await Promise.resolve();
    });

    expect(textOf(tr)).toContain("recuperado");
    expect(mockGetMisTickets).toHaveBeenCalledTimes(2);
  });
});
