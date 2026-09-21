import React from "react";
import { act } from "react-test-renderer";
import { PreCheckinModal } from "@rentacar/mobile-shared/screens/PreCheckinModal";
import { renderTree, textOf, pressText } from "../test-utils";

const mockRealizarPreCheckin = jest.fn();
jest.mock("@rentacar/mobile-shared/api/client", () => {
  const real = jest.requireActual("@rentacar/mobile-shared/api/client");
  return {
    ApiClient: {
      ...real.ApiClient,
      realizarPreCheckin: (...args) => mockRealizarPreCheckin(...args),
    },
  };
});

const asentar = () => act(() => new Promise((resolve) => setTimeout(resolve, 0)));

let arbolActual = null;
afterEach(() => {
  if (arbolActual) {
    arbolActual.unmount();
    arbolActual = null;
  }
});

const reservaDentro24h = {
  id: "res-precheck-1",
  estado: "confirmada",
  fecha_inicio: new Date(Date.now() + 10 * 3600000).toISOString(), // 10 horas en el futuro
  lugar_entrega_acordado: "Mall Plaza Los Ángeles",
  auto: { marca: "Toyota", modelo: "Yaris", anio: 2021, patente: "KLMN99" },
};

const reservaMasDe24h = {
  id: "res-precheck-2",
  estado: "confirmada",
  fecha_inicio: new Date(Date.now() + 48 * 3600000).toISOString(), // 48 horas en el futuro
  lugar_entrega_acordado: "Mall Plaza Los Ángeles",
  auto: { marca: "Toyota", modelo: "Yaris", anio: 2021, patente: "KLMN99" },
};

describe("PreCheckinModal · Checklist y regla 24h", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("inicia con casillas desmarcadas (0/4) y botón deshabilitado", async () => {
    const tr = renderTree(
      <PreCheckinModal
        visible={true}
        reserva={reservaDentro24h}
        role="cliente"
        onClose={() => {}}
      />
    );
    arbolActual = tr;
    await asentar();

    const texto = textOf(tr);
    expect(texto).toContain("0/4");
    expect(texto).toContain("Debes marcar las 4 casillas del checklist para poder confirmar.");

    // Intentar presionar el botón deshabilitado no debe llamar a la API
    pressText(tr, "Confirmar viaje para mañana");
    expect(mockRealizarPreCheckin).not.toHaveBeenCalled();
  });

  it("al marcar las 4 casillas, muestra 4/4 y permite confirmar", async () => {
    mockRealizarPreCheckin.mockResolvedValue({ ambos_confirmados: false });
    const tr = renderTree(
      <PreCheckinModal
        visible={true}
        reserva={reservaDentro24h}
        role="cliente"
        onClose={() => {}}
      />
    );
    arbolActual = tr;
    await asentar();

    // Marcar las 4 casillas
    pressText(tr, "Asistiré puntualmente a recibir el auto");
    pressText(tr, "Confirmo que revisé la dirección");
    pressText(tr, "Mi cédula y licencia de conducir física");
    pressText(tr, "Acepto las normas de arriendo");
    await asentar();

    const texto = textOf(tr);
    expect(texto).toContain("4/4");
    expect(texto).not.toContain("Debes marcar las 4 casillas");

    // Ahora el botón debe estar habilitado y llamar a la API
    await act(async () => {
      pressText(tr, "Confirmar viaje para mañana");
      await Promise.resolve();
    });
    await asentar();

    expect(mockRealizarPreCheckin).toHaveBeenCalledWith(
      "res-precheck-1",
      expect.objectContaining({
        rol: "cliente",
        confirma_asistencia: true,
        confirma_lugar_hora: true,
        confirma_licencia_vigente: true,
      })
    );
  });

  it("si faltan más de 24 horas para la entrega, muestra advertencia y bloquea confirmación", async () => {
    const tr = renderTree(
      <PreCheckinModal
        visible={true}
        reserva={reservaMasDe24h}
        role="cliente"
        onClose={() => {}}
      />
    );
    arbolActual = tr;
    await asentar();

    const texto = textOf(tr);
    expect(texto).toContain("Este pre-checkin estará disponible 24 horas antes de la entrega acordada.");

    // Aunque marque las casillas, sigue deshabilitado por estar fuera de las 24 horas
    pressText(tr, "Asistiré puntualmente a recibir el auto");
    pressText(tr, "Confirmo que revisé la dirección");
    pressText(tr, "Mi cédula y licencia de conducir física");
    pressText(tr, "Acepto las normas de arriendo");
    await asentar();

    pressText(tr, "Confirmar viaje para mañana");
    expect(mockRealizarPreCheckin).not.toHaveBeenCalled();
  });
});
