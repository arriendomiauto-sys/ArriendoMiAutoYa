/**
 * Ubicación GPS en vivo del auto.
 *
 * "En vivo" es la última lectura que el proveedor GPS reportó, pedida de
 * nuevo cada vez que se abre el modal — no hay tracking continuo. Sin equipo
 * instalado o sin consentimiento, el backend ya manda el motivo exacto
 * (403/404): acá se muestra tal cual, sin inventar nada.
 */
import React from "react";
import { act } from "react-test-renderer";
import { GPSMapModal } from "@rentacar/mobile-shared/components/GPSMapModal";
import { renderTree, textOf } from "../test-utils";

const mockGetPosicionGPS = jest.fn();
jest.mock("@rentacar/mobile-shared/api/client", () => {
  const real = jest.requireActual("@rentacar/mobile-shared/api/client");
  return { ApiClient: { ...real.ApiClient, getPosicionGPS: (...a) => mockGetPosicionGPS(...a) } };
});

const asentar = async () => {
  await act(async () => {
    await Promise.resolve();
  });
};

beforeEach(() => {
  mockGetPosicionGPS.mockReset();
});

describe("GPSMapModal", () => {
  it("pide la posición del auto correcto al abrirse", async () => {
    mockGetPosicionGPS.mockResolvedValue({
      posicion: { latitud: -37.47, longitud: -72.35, velocidad_kmh: 40, timestamp: "2026-08-01T10:00:00Z" },
    });
    renderTree(<GPSMapModal visible autoId="auto-1" onClose={() => {}} />);
    await asentar();

    expect(mockGetPosicionGPS).toHaveBeenCalledWith("auto-1");
  });

  it("no pide nada mientras está cerrado", async () => {
    renderTree(<GPSMapModal visible={false} autoId="auto-1" onClose={() => {}} />);
    await asentar();

    expect(mockGetPosicionGPS).not.toHaveBeenCalled();
  });

  it("muestra la velocidad cuando el proveedor la reporta", async () => {
    mockGetPosicionGPS.mockResolvedValue({
      posicion: { latitud: -37.47, longitud: -72.35, velocidad_kmh: 42, timestamp: "2026-08-01T10:00:00Z" },
    });
    const tr = renderTree(<GPSMapModal visible autoId="auto-1" onClose={() => {}} />);
    await asentar();

    expect(textOf(tr)).toContain("42 km/h");
  });

  it("un auto sin equipo instalado muestra el motivo del backend, con reintentar", async () => {
    const err = new Error("Este vehículo aún no tiene un equipo GPS instalado.");
    mockGetPosicionGPS.mockRejectedValue(err);
    const tr = renderTree(<GPSMapModal visible autoId="auto-1" onClose={() => {}} />);
    await asentar();

    const t = textOf(tr);
    expect(t).toContain("no tiene un equipo GPS instalado");
    expect(t).toContain("Reintentar");
  });

  it("sin consentimiento GPS muestra el 403 del backend tal cual", async () => {
    mockGetPosicionGPS.mockRejectedValue(new Error("El dueño no ha autorizado el monitoreo GPS de este vehículo."));
    const tr = renderTree(<GPSMapModal visible autoId="auto-1" onClose={() => {}} />);
    await asentar();

    expect(textOf(tr)).toContain("no ha autorizado el monitoreo GPS");
  });
});
