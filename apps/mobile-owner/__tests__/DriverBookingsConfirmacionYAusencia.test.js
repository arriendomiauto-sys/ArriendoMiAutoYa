/**
 * Política de reservas (2026-09-20):
 *  · el dueño tiene 24 h para confirmar una solicitud pagada; si no, se cancela y se devuelve todo;
 *  · quien no se presente a la entrega paga una multa (el arrendatario al dueño, el dueño al arrendatario).
 *    El sistema decide solo con el aviso "ya llegué" de cada parte, así que aquí ya no se reporta a mano.
 */
import React from "react";
import { Alert } from "react-native";
import { act } from "react-test-renderer";
import { DriverBookingsScreen } from "../src/owner/screens/DriverBookingsScreen";
import { ApiClient } from "@rentacar/mobile-shared/api/client";
import { renderTree, textOf, pressText } from "../test-utils";

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock("expo-location", () => ({
  Accuracy: { Balanced: 3 },
  getForegroundPermissionsAsync: jest.fn(() => Promise.resolve({ status: "granted" })),
  requestForegroundPermissionsAsync: jest.fn(() => Promise.resolve({ status: "granted" })),
  getCurrentPositionAsync: jest.fn(() =>
    Promise.resolve({
      coords: { latitude: -33.4372, longitude: -70.6506, accuracy: 15 },
    })
  ),
}));

const mockGetReservas = jest.fn();
const mockAvisarLlegada = jest.fn(() => Promise.resolve({ estado: "confirmada" }));
jest.mock("@rentacar/mobile-shared/api/client", () => {
  const real = jest.requireActual("@rentacar/mobile-shared/api/client");
  return {
    ApiClient: {
      ...real.ApiClient,
      getReservas: (...a) => mockGetReservas(...a),
      getCalificacionesDeReserva: jest.fn(() => Promise.resolve([])),
      avisarLlegada: (...a) => mockAvisarLlegada(...a),
    },
  };
});

const asentar = () => act(() => new Promise((resolve) => setTimeout(resolve, 0)));
const horas = (h) => new Date(Date.now() + h * 3600000).toISOString();

const base = {
  id: "res-1",
  lugar_entrega_acordado: "Plaza de Armas",
  monto_hold: 100000,
  auto: { id: "auto-1", marca: "Kia", modelo: "Rio", anio: 2022 },
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Alert, "alert").mockImplementation(() => {});
});

const montar = async (reserva) => {
  mockGetReservas.mockResolvedValue([{ ...base, ...reserva }]);
  const tr = renderTree(<DriverBookingsScreen />);
  await asentar();
  return tr;
};

describe("DriverBookingsScreen · plazo para confirmar", () => {
  it("una solicitud pendiente muestra hasta cuándo confirmar y qué pasa si no", async () => {
    const tr = await montar({ estado: "pendiente", fecha_inicio: horas(72), confirmar_dueno_antes_de: horas(20) });
    act(() => pressText(tr, "Solicitudes"));
    await asentar();

    const t = textOf(tr);
    expect(t).toMatch(/Confirma antes de/i);
    expect(t).toMatch(/se cancela y se devuelve todo/i);
  });

  it("una solicitud anterior a la política (sin plazo) no inventa uno", async () => {
    const tr = await montar({ estado: "pendiente", fecha_inicio: horas(72), confirmar_dueno_antes_de: null });
    act(() => pressText(tr, "Solicitudes"));
    await asentar();

    expect(textOf(tr)).not.toMatch(/Confirma antes de/i);
  });
});

describe("DriverBookingsScreen · avisar que llegaste (base de la multa por no presentación)", () => {
  it("desde 2 h antes de la entrega aparece 'Ya llegué' y avisa la multa", async () => {
    const tr = await montar({ estado: "confirmada", fecha_inicio: horas(1) });
    const t = textOf(tr);
    expect(t).toContain("Ya llegué al punto de encuentro");
    expect(t).toMatch(/multa/i);
  });

  it.each([
    ["con horas de anticipación", { estado: "confirmada", fecha_inicio: horas(5) }],
    ["si la reserva ya está en curso", { estado: "en_curso", fecha_inicio: horas(-3) }],
  ])("no aparece %s", async (_n, reserva) => {
    const tr = await montar(reserva);
    if (reserva.estado === "en_curso") {
      act(() => pressText(tr, "Por devolver"));
      await asentar();
    }
    expect(textOf(tr)).not.toContain("Ya llegué al punto de encuentro");
  });

  it("ya avisada, en vez del botón se ve la confirmación", async () => {
    const tr = await montar({ estado: "confirmada", fecha_inicio: horas(-1), llegada_dueno_en: horas(-0.5) });
    const t = textOf(tr);
    expect(t).not.toContain("Ya llegué al punto de encuentro");
    expect(t).toContain("Avisaste que llegaste");
  });

  it("si el arrendatario ya avisó que llegó, el dueño lo ve", async () => {
    const tr = await montar({ estado: "confirmada", fecha_inicio: horas(-1), llegada_cliente_en: horas(-0.5) });
    expect(textOf(tr)).toContain("El arrendatario ya llegó");
  });

  it("tocarlo avisa a la API con esa reserva y recarga", async () => {
    const tr = await montar({ estado: "confirmada", fecha_inicio: horas(1) });
    mockGetReservas.mockClear();

    await act(async () => {
      pressText(tr, "Ya llegué al punto de encuentro");
    });
    await asentar();

    expect(mockAvisarLlegada).toHaveBeenCalledWith(
      "res-1",
      expect.objectContaining({ latitud: -33.4372, longitud: -70.6506 })
    );
    expect(mockGetReservas).toHaveBeenCalled();
  });

  it("si el backend lo rechaza (409) muestra el motivo", async () => {
    mockAvisarLlegada.mockRejectedValueOnce(Object.assign(new Error("Todavía es muy pronto."), { status: 409 }));
    const tr = await montar({ estado: "confirmada", fecha_inicio: horas(1) });

    await act(async () => {
      pressText(tr, "Ya llegué al punto de encuentro");
    });
    await asentar();

    expect(textOf(tr)).toMatch(/Todavía es muy pronto/);
  });

  it("el dueño ya no puede reportar la ausencia del arrendatario a mano", async () => {
    const tr = await montar({ estado: "confirmada", fecha_inicio: horas(-3) });
    expect(textOf(tr)).not.toContain("El arrendatario no se presentó");
  });
});

describe("ApiClient.avisarLlegada", () => {
  it("hace POST a /reservas/{id}/llegada", async () => {
    const real = jest.requireActual("@rentacar/mobile-shared/api/client").ApiClient;
    const espia = jest.spyOn(real, "request").mockResolvedValue({ estado: "confirmada" });

    await real.avisarLlegada("res-9");

    expect(espia).toHaveBeenCalledWith("/reservas/res-9/llegada", { method: "POST" });
    espia.mockRestore();
  });
});
