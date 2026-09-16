/**
 * `useConversaciones` alimenta el globo de "Mensajes" y la vista previa de la
 * lista. Un poll fallido (sin señal, backend despertando) NO debe tumbar el
 * hook ni dejar `cargando` pegado en true.
 */
import React from "react";
import { Text } from "react-native";
import { act } from "react-test-renderer";
import { useConversaciones } from "@rentacar/mobile-shared/hooks/useConversaciones";
import { renderTree } from "../test-utils";

const mockGetResumen = jest.fn();
jest.mock("@rentacar/mobile-shared/api/client", () => ({
  ApiClient: { getResumenConversaciones: (...a) => mockGetResumen(...a) },
}));

const mockContexto = { notifications: [] };
jest.mock("@rentacar/mobile-shared/context/AppContext", () => ({
  useApp: () => mockContexto,
}));

const asentar = () => new Promise((r) => setTimeout(r, 0));

let ultimo;
function Sonda() {
  ultimo = useConversaciones();
  return <Text>{String(ultimo.noLeidos)}</Text>;
}

beforeEach(() => {
  mockGetResumen.mockReset();
  mockContexto.notifications = [];
  ultimo = undefined;
});

describe("useConversaciones", () => {
  it("suma los no leídos de todas las conversaciones", async () => {
    mockGetResumen.mockResolvedValue([
      { reserva_id: "r1", no_leidos: 2 },
      { reserva_id: "r2", no_leidos: 3 },
      { reserva_id: "r3", no_leidos: 0 },
    ]);

    await act(async () => {
      renderTree(<Sonda />);
      await asentar();
    });

    expect(ultimo.cargando).toBe(false);
    expect(ultimo.noLeidos).toBe(5);
    expect(ultimo.conversaciones).toHaveLength(3);
  });

  it("un fetch que falla no lanza y libera `cargando`", async () => {
    const err = new Error("No se pudo conectar con el servidor");
    err.esFalloDeConexion = true;
    mockGetResumen.mockRejectedValue(err);

    await act(async () => {
      renderTree(<Sonda />);
      await asentar();
    });

    expect(ultimo.cargando).toBe(false);
    expect(ultimo.noLeidos).toBe(0);
    expect(ultimo.conversaciones).toEqual([]);
  });

  it("conserva el último resumen si un refresco posterior falla", async () => {
    mockGetResumen.mockResolvedValue([{ reserva_id: "r1", no_leidos: 4 }]);

    await act(async () => {
      renderTree(<Sonda />);
      await asentar();
    });
    expect(ultimo.noLeidos).toBe(4);

    // Un refresco manual que falla no debe borrar lo que ya se mostraba.
    mockGetResumen.mockRejectedValueOnce(new Error("timeout"));
    await act(async () => {
      await ultimo.refrescar();
      await asentar();
    });

    expect(ultimo.noLeidos).toBe(4);
    expect(ultimo.conversaciones).toHaveLength(1);
  });

  it("ignora una respuesta que no sea lista (no rompe el reduce de noLeidos)", async () => {
    mockGetResumen.mockResolvedValue(undefined);

    await act(async () => {
      renderTree(<Sonda />);
      await asentar();
    });

    expect(ultimo.cargando).toBe(false);
    expect(ultimo.conversaciones).toEqual([]);
    expect(ultimo.noLeidos).toBe(0);
  });
});
