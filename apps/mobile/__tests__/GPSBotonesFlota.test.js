/**
 * El botón "Ver ubicación GPS en vivo" solo aparece donde tiene sentido:
 * arriendo activo (el auto está fuera, es cuando importa saber dónde está) y
 * con GPS autorizado por el dueño — nunca para un auto sin consentimiento.
 */
import React from "react";
import { act } from "react-test-renderer";
import { DriverBookingsScreen } from "../src/owner/screens/DriverBookingsScreen";
import { MyCarsScreen } from "../src/owner/screens/MyCarsScreen";
import { renderTree, textOf, pressText } from "../test-utils";

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

const mockGetReservas = jest.fn();
const mockGetPosicionGPS = jest.fn();

// GPSMapModal vive dentro de mobile-shared e importa ApiClient por su propia
// ruta relativa ("../api/client"), no por el barrel — mockear solo el barrel
// (como abajo, para DriverBookingsScreen/MyCarsScreen) no le llega. Hacen
// falta los dos mocks.
jest.mock("@rentacar/mobile-shared/api/client", () => {
  const real = jest.requireActual("@rentacar/mobile-shared/api/client");
  return { ApiClient: { ...real.ApiClient, getPosicionGPS: (...a) => mockGetPosicionGPS(...a) } };
});

jest.mock("@rentacar/mobile-shared", () => {
  const real = jest.requireActual("@rentacar/mobile-shared");
  return {
    ...real,
    ApiClient: {
      ...real.ApiClient,
      getReservas: (...a) => mockGetReservas(...a),
      getPosicionGPS: (...a) => mockGetPosicionGPS(...a),
    },
  };
});

const asentar = async () => {
  await act(async () => {
    await Promise.resolve();
  });
};

beforeEach(() => {
  mockGetReservas.mockReset();
  mockGetPosicionGPS.mockReset();
  mockGetPosicionGPS.mockResolvedValue({ posicion: { latitud: -37.47, longitud: -72.35, timestamp: "2026-08-01T10:00:00Z" } });
});

describe("Botón de GPS en vivo · Reservas del dueño", () => {
  it("aparece en un arriendo en curso con GPS autorizado", async () => {
    mockGetReservas.mockResolvedValue([
      {
        id: "r1", estado: "en_curso", fecha_inicio: "2026-08-01", fecha_fin: "2026-08-05",
        auto: { id: "auto-1", marca: "Kia", modelo: "Rio", gps_consentimiento: true },
      },
    ]);
    const tr = renderTree(<DriverBookingsScreen onOpenDelivery={() => {}} onOpenContract={() => {}} />);
    await asentar();
    // El filtro por defecto es "Por entregar" (confirmada); hay que pasar a "Por devolver".
    pressText(tr, "Por devolver");

    expect(textOf(tr)).toContain("Ver ubicación GPS en vivo");
  });

  it("no aparece si el dueño no autorizó GPS en ese auto", async () => {
    mockGetReservas.mockResolvedValue([
      {
        id: "r1", estado: "en_curso", fecha_inicio: "2026-08-01", fecha_fin: "2026-08-05",
        auto: { id: "auto-1", marca: "Kia", modelo: "Rio", gps_consentimiento: false },
      },
    ]);
    const tr = renderTree(<DriverBookingsScreen onOpenDelivery={() => {}} onOpenContract={() => {}} />);
    await asentar();
    pressText(tr, "Por devolver");

    expect(textOf(tr)).not.toContain("Ver ubicación GPS en vivo");
  });

  it("no aparece para una reserva que todavía no se entrega", async () => {
    mockGetReservas.mockResolvedValue([
      {
        id: "r1", estado: "confirmada", fecha_inicio: "2026-08-01", fecha_fin: "2026-08-05",
        auto: { id: "auto-1", marca: "Kia", modelo: "Rio", gps_consentimiento: true },
      },
    ]);
    const tr = renderTree(<DriverBookingsScreen onOpenDelivery={() => {}} onOpenContract={() => {}} />);
    await asentar();

    expect(textOf(tr)).not.toContain("Ver ubicación GPS en vivo");
  });

  it("tocarlo abre el modal y pide la posición del auto correcto", async () => {
    mockGetReservas.mockResolvedValue([
      {
        id: "r1", estado: "en_curso", fecha_inicio: "2026-08-01", fecha_fin: "2026-08-05",
        auto: { id: "auto-1", marca: "Kia", modelo: "Rio", gps_consentimiento: true },
      },
    ]);
    const tr = renderTree(<DriverBookingsScreen onOpenDelivery={() => {}} onOpenContract={() => {}} />);
    await asentar();
    pressText(tr, "Por devolver");

    await act(async () => {
      pressText(tr, "Ver ubicación GPS en vivo");
      await Promise.resolve();
    });

    expect(mockGetPosicionGPS).toHaveBeenCalledWith("auto-1");
  });
});

describe("Botón de GPS en vivo · Mi Flota", () => {
  const auto = {
    id: "auto-2", marca: "Toyota", modelo: "Yaris", anio: 2023, tarifa_dia: 30000,
    estado: "activo", documentos_verificados: true, fotos: [],
  };

  it("aparece en la tarjeta de un auto con GPS autorizado", () => {
    const t = textOf(
      renderTree(
        <MyCarsScreen
          cars={[{ ...auto, gps_consentimiento: true }]}
          setCars={() => {}}
          onAddNewCar={() => {}}
          identidadVerificada
        />
      )
    );
    expect(t).toContain("GPS");
  });

  it("no aparece si el auto no tiene consentimiento GPS", () => {
    const t = textOf(
      renderTree(
        <MyCarsScreen
          cars={[{ ...auto, gps_consentimiento: false }]}
          setCars={() => {}}
          onAddNewCar={() => {}}
          identidadVerificada
        />
      )
    );
    expect(t).not.toContain("GPS");
  });
});
