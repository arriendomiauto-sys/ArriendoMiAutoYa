/**
 * Calificaciones y reseñas en la ficha del auto.
 *
 * Es la reputación del DUEÑO, no del vehículo — no hay reseñas por auto en
 * el modelo, solo por persona. Dos autos del mismo dueño muestran las mismas
 * reseñas a propósito.
 */
import React from "react";
import { act } from "react-test-renderer";
import { CarDetailScreen } from "../src/renter/screens/CarDetailScreen";
import { renderTree, textOf } from "../test-utils";

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

const mockGetCalificaciones = jest.fn();
jest.mock("@rentacar/mobile-shared", () => {
  const real = jest.requireActual("@rentacar/mobile-shared");
  return { ...real, ApiClient: { ...real.ApiClient, getCalificaciones: (...a) => mockGetCalificaciones(...a) } };
});

const car = {
  id: "c1",
  dueno_id: "dueno-1",
  marca: "Suzuki",
  modelo: "Swift",
  anio: 2023,
  tarifa_dia: 40000,
  ubicacion_base: "Los Ángeles",
  fotos: ["https://example.com/1.jpg"],
};

const asentar = async () => {
  await act(async () => {
    await Promise.resolve();
  });
};

beforeEach(() => {
  mockGetCalificaciones.mockReset();
});

describe("CarDetailScreen · calificaciones", () => {
  it("pide las calificaciones del dueño del auto, no del auto mismo", async () => {
    mockGetCalificaciones.mockResolvedValue([]);
    renderTree(<CarDetailScreen car={car} onBack={() => {}} onProceedToPayment={() => {}} />);
    await asentar();

    expect(mockGetCalificaciones).toHaveBeenCalledWith("dueno-1");
  });

  it("muestra el promedio, la cantidad de opiniones y cada reseña", async () => {
    mockGetCalificaciones.mockResolvedValue([
      { id: "r1", puntaje: 5, comentario: "Auto impecable, dueño muy amable.", autor_nombre: "Camila Soto", timestamp: "2026-08-01T10:00:00Z" },
      { id: "r2", puntaje: 3, comentario: "Bien, aunque llegó con poco combustible.", autor_nombre: "Pedro Rojas", timestamp: "2026-07-15T10:00:00Z" },
    ]);
    const tr = renderTree(<CarDetailScreen car={car} onBack={() => {}} onProceedToPayment={() => {}} />);
    await asentar();

    const t = textOf(tr);
    expect(t).toContain("4.0"); // promedio de 5 y 3
    expect(t).toContain("2 opiniones");
    expect(t).toContain("Auto impecable, dueño muy amable.");
    expect(t).toContain("Camila Soto");
    expect(t).toContain("Bien, aunque llegó con poco combustible.");
    expect(t).toContain("Pedro Rojas");
  });

  it("sin reseñas no muestra la sección, en vez de un bloque vacío", async () => {
    mockGetCalificaciones.mockResolvedValue([]);
    const tr = renderTree(<CarDetailScreen car={car} onBack={() => {}} onProceedToPayment={() => {}} />);
    await asentar();

    expect(textOf(tr)).not.toContain("opiniones");
  });

  it("una reseña sin nombre de autor no rompe: cae a un texto genérico", async () => {
    mockGetCalificaciones.mockResolvedValue([
      { id: "r1", puntaje: 4, comentario: "Todo bien.", autor_nombre: null, timestamp: "2026-08-01T10:00:00Z" },
    ]);
    const tr = renderTree(<CarDetailScreen car={car} onBack={() => {}} onProceedToPayment={() => {}} />);
    await asentar();

    expect(textOf(tr)).toContain("Arrendatario");
  });

  it("un auto sin dueno_id no intenta pedir calificaciones", async () => {
    const sinDueno = { ...car, dueno_id: undefined };
    renderTree(<CarDetailScreen car={sinDueno} onBack={() => {}} onProceedToPayment={() => {}} />);
    await asentar();

    expect(mockGetCalificaciones).not.toHaveBeenCalled();
  });
});
