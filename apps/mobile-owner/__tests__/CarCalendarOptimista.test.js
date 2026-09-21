/**
 * Bloquear/desbloquear un día en el calendario del dueño es un update
 * optimista: la celda cambia al instante y la API va en segundo plano. Antes
 * `toggleDay` hacía `await` de la red ANTES de tocar el estado — con el
 * backend de Render dormido, apretar una fecha tardaba 10-40s en responder.
 */
import React from "react";
import { act } from "react-test-renderer";
import { CarCalendarScreen } from "../src/owner/screens/CarCalendarScreen";
import { renderTree } from "../test-utils";

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

const mockGetReservas = jest.fn(async () => []);
const mockGetBloqueos = jest.fn(async () => []);
const mockCrearBloqueo = jest.fn();
const mockEliminarBloqueo = jest.fn();
const mockShowAlert = jest.fn();
jest.mock("@rentacar/mobile-shared", () => {
  const real = jest.requireActual("@rentacar/mobile-shared");
  return {
    ...real,
    useApp: () => ({ cars: [{ id: "auto-1", marca: "Kia", modelo: "Rio" }] }),
    showAlert: (...a) => mockShowAlert(...a),
    ApiClient: {
      ...real.ApiClient,
      getReservas: (...a) => mockGetReservas(...a),
      getBloqueosCalendario: (...a) => mockGetBloqueos(...a),
      crearBloqueoCalendario: (...a) => mockCrearBloqueo(...a),
      eliminarBloqueoCalendario: (...a) => mockEliminarBloqueo(...a),
    },
  };
});

const asentar = async () => {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
};

const montar = async () => {
  const tr = renderTree(<CarCalendarScreen car={{ id: "auto-1" }} onBack={() => {}} />);
  await asentar();
  return tr;
};

// Celda del día `n`: el TouchableOpacity cuyo hijo <Text> tiene `children === n`.
const celdaDia = (tr, n) =>
  tr.root.findAll((node) => {
    if (typeof node.props?.onPress !== "function") return false;
    return React.Children.toArray(node.props.children).some((h) => h?.props?.children === n);
  })[0];

const estaBloqueada = (celda) => {
  if (!celda) return false;
  const texto = React.Children.toArray(celda.props.children)[0];
  const estilos = Array.isArray(texto.props.style) ? texto.props.style : [texto.props.style];
  return (
    estilos.some((s) => s && s.textDecorationLine === "line-through") ||
    String(texto.props?.className || "").includes("line-through")
  );
};

beforeEach(() => {
  mockGetReservas.mockReset().mockResolvedValue([]);
  mockGetBloqueos.mockReset().mockResolvedValue([]);
  mockCrearBloqueo.mockReset();
  mockEliminarBloqueo.mockReset();
  mockShowAlert.mockClear();
});

describe("Calendario del dueño · bloqueo optimista", () => {
  it("bloquear un día lo marca al instante, sin esperar a la API", async () => {
    // La API queda pendiente para siempre: si el update fuera bloqueante, la
    // celda no cambiaría.
    mockCrearBloqueo.mockReturnValue(new Promise(() => {}));
    const tr = await montar();

    const dia = celdaDia(tr, 15);
    expect(estaBloqueada(dia)).toBe(false);

    act(() => dia.props.onPress());

    expect(mockCrearBloqueo).toHaveBeenCalledTimes(1);
    expect(estaBloqueada(celdaDia(tr, 15))).toBe(true);
  });

  it("si crear el bloqueo falla, la celda vuelve a estar libre y avisa", async () => {
    mockCrearBloqueo.mockRejectedValue(new Error("Sin conexión"));
    const tr = await montar();

    await act(async () => {
      celdaDia(tr, 15).props.onPress();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(estaBloqueada(celdaDia(tr, 15))).toBe(false);
    expect(mockShowAlert).toHaveBeenCalled();
  });

  it("desbloquear un día ya bloqueado también es optimista + rollback", async () => {
    // Un bloqueo existente en el día 1 del mes visible.
    const hoy = new Date();
    const primero = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    mockGetBloqueos.mockResolvedValue([{ id: "b-1", fecha: primero.toISOString() }]);
    mockEliminarBloqueo.mockRejectedValue(new Error("timeout"));

    const tr = await montar();
    expect(estaBloqueada(celdaDia(tr, 1))).toBe(true);

    await act(async () => {
      celdaDia(tr, 1).props.onPress();
      await Promise.resolve();
      await Promise.resolve();
    });

    // Falló el DELETE: el bloqueo vuelve.
    expect(mockEliminarBloqueo).toHaveBeenCalledWith("b-1");
    expect(estaBloqueada(celdaDia(tr, 1))).toBe(true);
    expect(mockShowAlert).toHaveBeenCalled();
  });
});
