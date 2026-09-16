/**
 * ReportFineModal mezclaba dos cosas distintas bajo un mismo formulario:
 * faltas simples (fumar, mascotas, limpieza) que se ven en la devolución, y
 * "cobros que llegan después" (peajes/fotomultas) que llegan semanas
 * después y no tienen nada que verificar en el momento. Se separan: este
 * modal ahora solo reporta faltas simples; los cobros posteriores usan
 * CobroPosteriorModal + ApiClient.cobrarPosterior.
 */
import React from "react";
import { act } from "react-test-renderer";
import { ReportFineModal } from "@rentacar/mobile-shared/screens/ReportFineModal";
import { renderTree, textOf, pressText } from "../test-utils";

const mockAplicarMultaReserva = jest.fn();
jest.mock("@rentacar/mobile-shared/api/client", () => {
  const real = jest.requireActual("@rentacar/mobile-shared/api/client");
  return {
    ApiClient: { ...real.ApiClient, aplicarMultaReserva: (...a) => mockAplicarMultaReserva(...a) },
  };
});

const reserva = { id: "res-1", fecha_inicio: "2026-01-01T00:00:00Z", fecha_fin: "2026-01-05T00:00:00Z" };

let arbolActual = null;
afterEach(() => {
  if (arbolActual) arbolActual.unmount();
  arbolActual = null;
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe("ReportFineModal · solo faltas simples", () => {
  it("ya no muestra la sección de cobros que llegan después (peajes/fotomulta)", () => {
    const tr = renderTree(
      <ReportFineModal visible reserva={reserva} onClose={() => {}} onApplied={() => {}} />
    );
    arbolActual = tr;

    const texto = textOf(tr);
    expect(texto).not.toContain("Cobros que llegan después");
    expect(texto).not.toContain("Peajes / TAG");
    expect(texto).not.toContain("Fotomulta");
  });

  it("aplica la multa con el payload recortado (sin fecha_evento ni documento_url)", async () => {
    mockAplicarMultaReserva.mockResolvedValue({ id: "multa-1" });
    const onApplied = jest.fn();
    const tr = renderTree(
      <ReportFineModal visible reserva={reserva} onClose={() => {}} onApplied={onApplied} />
    );
    arbolActual = tr;

    act(() => {
      pressText(tr, "Mascotas sin canil");
    });

    const inputMotivo = tr.root.findAll(
      (n) => n.props?.placeholder === "Describe la falta observada en la entrega/devolución..."
    )[0];
    act(() => inputMotivo.props.onChangeText("Pelos de perro en todos los asientos traseros."));

    await act(async () => {
      pressText(tr, "Aplicar cargo y notificar");
      await new Promise((r) => setTimeout(r, 0));
    });

    expect(mockAplicarMultaReserva).toHaveBeenCalledTimes(1);
    const [reservaId, payload] = mockAplicarMultaReserva.mock.calls[0];
    expect(reservaId).toBe("res-1");
    expect(payload).toEqual({
      tipo: "mascotas",
      monto_clp: 25000,
      motivo: "Pelos de perro en todos los asientos traseros.",
      fotos: [],
    });
    expect(payload).not.toHaveProperty("fecha_evento");
    expect(payload).not.toHaveProperty("documento_url");
  });
});
