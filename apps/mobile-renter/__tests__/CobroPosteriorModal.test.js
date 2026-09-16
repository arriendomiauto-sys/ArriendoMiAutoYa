/**
 * Peajes, TAG y fotomultas llegan semanas después del arriendo y no tienen
 * nada que verificar en el momento de la devolución — antes ReportFineModal
 * los mezclaba con faltas simples bajo el mismo formulario. Ahora tienen su
 * propio modal, que cobra contra la tarjeta de crédito de garantía
 * (POST /reservas/{id}/cobro-posterior, tipo: "tag"|"peaje"|"multa"|"otro").
 */
import React from "react";
import { act } from "react-test-renderer";
import { CobroPosteriorModal } from "@rentacar/mobile-shared/screens/CobroPosteriorModal";
import { renderTree, pressText } from "../test-utils";

const mockCobrarPosterior = jest.fn();
jest.mock("@rentacar/mobile-shared/api/client", () => {
  const real = jest.requireActual("@rentacar/mobile-shared/api/client");
  return {
    ApiClient: { ...real.ApiClient, cobrarPosterior: (...a) => mockCobrarPosterior(...a) },
  };
});

const mockElegirYSubirImagen = jest.fn();
jest.mock("@rentacar/mobile-shared/utils/imagenes", () => ({
  elegirYSubirImagen: (...a) => mockElegirYSubirImagen(...a),
  AJUSTES_DOCUMENTO: {},
}));

const mockShowAlert = jest.fn();
jest.mock("@rentacar/mobile-shared/utils/alert", () => ({
  showAlert: (...a) => mockShowAlert(...a),
}));

const reserva = { id: "res-1", estado: "finalizada" };

let arbolActual = null;
afterEach(() => {
  if (arbolActual) arbolActual.unmount();
  arbolActual = null;
});

beforeEach(() => {
  jest.clearAllMocks();
  mockElegirYSubirImagen.mockResolvedValue({ url: "https://cdn.example/boleta.jpg", cancelado: false });
});

const llenarMontoYDescripcion = (tr, monto, descripcion) => {
  const inputMonto = tr.root.findAll((n) => n.props?.placeholder === "ej. 3200")[0];
  act(() => inputMonto.props.onChangeText(monto));
  const inputDesc = tr.root.findAll(
    (n) => n.props?.placeholder === "Pórtico, fecha y hora del pase o de la infracción..."
  )[0];
  act(() => inputDesc.props.onChangeText(descripcion));
};

const adjuntarComprobante = async (tr) => {
  await act(async () => {
    pressText(tr, "Tomar foto");
    await new Promise((r) => setTimeout(r, 0));
  });
};

const enviar = async (tr) => {
  await act(async () => {
    pressText(tr, "Cobrar y notificar al arrendatario");
    await new Promise((r) => setTimeout(r, 0));
  });
};

describe("CobroPosteriorModal · peajes, TAG y fotomultas", () => {
  it("cobra un TAG con el payload exacto que espera el backend", async () => {
    mockCobrarPosterior.mockResolvedValue({ id: "cobro-1", estado: "capturado" });
    const tr = renderTree(<CobroPosteriorModal visible reserva={reserva} onClose={() => {}} />);
    arbolActual = tr;

    // "TAG" ya viene seleccionado por defecto.
    llenarMontoYDescripcion(tr, "3200", "Pórtico Vespucio Norte, 12/09 08:14.");
    await adjuntarComprobante(tr);
    await enviar(tr);

    expect(mockCobrarPosterior).toHaveBeenCalledWith("res-1", {
      tipo: "tag",
      monto: 3200,
      descripcion: "Pórtico Vespucio Norte, 12/09 08:14.",
      comprobante_url: "https://cdn.example/boleta.jpg",
    });
  });

  it("permite elegir 'Multa / Fotomulta' en vez de TAG", async () => {
    mockCobrarPosterior.mockResolvedValue({ id: "cobro-2" });
    const tr = renderTree(<CobroPosteriorModal visible reserva={reserva} onClose={() => {}} />);
    arbolActual = tr;

    act(() => pressText(tr, "Multa / Fotomulta"));
    llenarMontoYDescripcion(tr, "45000", "Exceso de velocidad, av. Kennedy.");
    await adjuntarComprobante(tr);
    await enviar(tr);

    expect(mockCobrarPosterior).toHaveBeenCalledWith(
      "res-1",
      expect.objectContaining({ tipo: "multa", monto: 45000 })
    );
  });

  it("no cobra sin comprobante adjunto", async () => {
    const tr = renderTree(<CobroPosteriorModal visible reserva={reserva} onClose={() => {}} />);
    arbolActual = tr;

    llenarMontoYDescripcion(tr, "3200", "Pórtico Vespucio Norte.");
    await enviar(tr);

    expect(mockCobrarPosterior).not.toHaveBeenCalled();
    expect(mockShowAlert).toHaveBeenCalledWith("Falta el comprobante", expect.any(String));
  });

  it("muestra el mensaje de error del backend si el cobro es rechazado", async () => {
    mockCobrarPosterior.mockRejectedValue(
      new Error("No se pudo procesar el cobro posterior en la tarjeta de crédito (fondos insuficientes).")
    );
    const tr = renderTree(<CobroPosteriorModal visible reserva={reserva} onClose={() => {}} />);
    arbolActual = tr;

    llenarMontoYDescripcion(tr, "3200", "Pórtico Vespucio Norte.");
    await adjuntarComprobante(tr);
    await enviar(tr);

    expect(mockShowAlert).toHaveBeenCalledWith(
      "No se pudo realizar el cobro",
      expect.stringContaining("fondos insuficientes")
    );
  });
});
