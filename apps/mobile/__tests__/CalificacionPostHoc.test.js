/**
 * Calificar un arriendo ya finalizado desde el historial, para cuando no se
 * calificó en el momento. El backend ya soportaba POST /calificaciones para
 * cualquier reserva finalizada — lo nuevo es la entrada desde el historial y
 * que se oculta el botón si ya se calificó.
 */
import React from "react";
import { act } from "react-test-renderer";
import { RentalHistoryScreen } from "../src/renter/screens/RentalHistoryScreen";
import { renderTree, textOf, pressText } from "../test-utils";

const mockGetReservas = jest.fn();
const mockGetCalificacionesDeReserva = jest.fn();
const mockCrearCalificacion = jest.fn();

// RatingModal vive dentro de mobile-shared e importa ApiClient por su
// propia ruta relativa, no por el barrel — igual que GPSMapModal.
jest.mock("@rentacar/mobile-shared/api/client", () => {
  const real = jest.requireActual("@rentacar/mobile-shared/api/client");
  return {
    ApiClient: {
      ...real.ApiClient,
      getReservas: (...a) => mockGetReservas(...a),
      getCalificacionesDeReserva: (...a) => mockGetCalificacionesDeReserva(...a),
      crearCalificacion: (...a) => mockCrearCalificacion(...a),
    },
  };
});
jest.mock("@rentacar/mobile-shared", () => {
  const real = jest.requireActual("@rentacar/mobile-shared");
  return {
    ...real,
    ApiClient: {
      ...real.ApiClient,
      getReservas: (...a) => mockGetReservas(...a),
      getCalificacionesDeReserva: (...a) => mockGetCalificacionesDeReserva(...a),
      crearCalificacion: (...a) => mockCrearCalificacion(...a),
    },
  };
});

const RESERVA = {
  id: "res-fin-1",
  estado: "finalizada",
  fecha_inicio: "2026-01-01T10:00:00Z",
  fecha_fin: "2026-01-03T10:00:00Z",
  lugar_entrega_acordado: "Plaza de Armas",
  auto: { marca: "Kia", modelo: "Rio", anio: 2022, dueno_id: "dueno-1" },
};

const asentar = () => new Promise((resolve) => setTimeout(resolve, 0));

const montarEnPasadas = async () => {
  let tr;
  await act(async () => {
    tr = renderTree(<RentalHistoryScreen onSelectReservation={() => {}} onBack={() => {}} />);
    await asentar();
  });
  await act(async () => {
    pressText(tr, "Pasadas");
    await asentar();
  });
  return tr;
};

beforeEach(() => {
  mockGetReservas.mockReset();
  mockGetCalificacionesDeReserva.mockReset();
  mockCrearCalificacion.mockReset();
});

describe("Historial de arriendos · calificación post-hoc", () => {
  it("una reserva finalizada sin calificar muestra el botón de calificar", async () => {
    mockGetReservas.mockResolvedValue([RESERVA]);
    mockGetCalificacionesDeReserva.mockResolvedValue([]);

    const tr = await montarEnPasadas();
    expect(textOf(tr)).toContain("Calificar este arriendo");
  });

  it("una reserva ya calificada por el cliente no muestra el botón", async () => {
    mockGetReservas.mockResolvedValue([RESERVA]);
    mockGetCalificacionesDeReserva.mockResolvedValue([
      { id: "cal-1", autor_rol: "cliente", puntaje: 5 },
    ]);

    const tr = await montarEnPasadas();
    expect(textOf(tr)).not.toContain("Calificar este arriendo");
  });

  it("calificar envía la puntuación al dueño del auto y oculta el botón", async () => {
    mockGetReservas.mockResolvedValue([RESERVA]);
    mockGetCalificacionesDeReserva.mockResolvedValue([]);
    mockCrearCalificacion.mockResolvedValue({ id: "cal-nueva", puntaje: 5 });

    const tr = await montarEnPasadas();

    await act(async () => {
      pressText(tr, "Calificar este arriendo");
      await asentar();
    });
    expect(textOf(tr)).toContain("Califica tu arriendo");

    await act(async () => {
      pressText(tr, "Enviar calificación");
      await asentar();
    });

    expect(mockCrearCalificacion).toHaveBeenCalledWith(
      expect.objectContaining({
        reserva_id: "res-fin-1",
        autor_rol: "cliente",
        destinatario_id: "dueno-1",
        puntaje: 5,
      })
    );
    expect(textOf(tr)).not.toContain("Calificar este arriendo");
  });
});
