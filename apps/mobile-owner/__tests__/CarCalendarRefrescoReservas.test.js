/**
 * BUG-003: el calendario cargaba las reservas una sola vez al abrirse. Si un
 * arrendatario reservaba mientras el dueño lo tenía abierto, esos días seguían
 * viéndose libres y el dueño podía intentar bloquearlos.
 *
 * Ahora las reservas se refrescan cada 30 s y al volver la app a primer plano.
 */
import React from "react";
import { AppState } from "react-native";
import { act } from "react-test-renderer";
import { CarCalendarScreen } from "../src/owner/screens/CarCalendarScreen";
import { renderTree } from "../test-utils";

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

const mockGetReservas = jest.fn(async () => []);
const mockGetBloqueos = jest.fn(async () => []);
const mockCrearBloqueo = jest.fn();
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
      eliminarBloqueoCalendario: jest.fn(),
    },
  };
});

const asentar = async () => {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
};

const celdaDia = (tr, n) =>
  tr.root.findAll((node) => {
    if (typeof node.props?.onPress !== "function") return false;
    return React.Children.toArray(node.props.children).some((h) => h?.props?.children === n);
  })[0];

const reservaConfirmadaEl12 = () => {
  const hoy = new Date();
  const inicio = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 12, 10, 0, 0);
  return {
    id: "r-12",
    auto_id: "auto-1",
    estado: "confirmada",
    fecha_inicio: inicio.toISOString(),
    fecha_fin: new Date(inicio.getTime() + 86400000).toISOString(),
  };
};

// Tocar el día 12: si está reservado avisa; si está libre intenta bloquearlo.
const tocarDia12 = async (tr) => {
  await act(async () => {
    celdaDia(tr, 12).props.onPress();
    await Promise.resolve();
  });
};

let arbol = null;
let cambioDeEstadoApp = null;

beforeEach(() => {
  jest.useFakeTimers();
  mockGetReservas.mockReset().mockResolvedValue([]);
  mockGetBloqueos.mockReset().mockResolvedValue([]);
  mockCrearBloqueo.mockReset().mockResolvedValue({ id: "b-1", fecha: new Date().toISOString() });
  mockShowAlert.mockClear();
  cambioDeEstadoApp = null;
  jest.spyOn(AppState, "addEventListener").mockImplementation((evento, cb) => {
    if (evento === "change") cambioDeEstadoApp = cb;
    return { remove: jest.fn() };
  });
});

afterEach(() => {
  if (arbol) arbol.unmount();
  arbol = null;
  jest.clearAllTimers();
  jest.useRealTimers();
  jest.restoreAllMocks();
});

// El calendario ya no deja tocar días pasados, así que estas pruebas se
// corren sobre el MES SIGUIENTE: todos sus días son futuros y el resultado no
// depende del día del mes en que se ejecute la suite.
const irAlMesSiguiente = (tr) => {
  const btn = tr.root.findAll((n) => n.props?.accessibilityLabel === "Mes siguiente")[0];
  act(() => btn.props.onPress());
};

const montar = async () => {
  arbol = renderTree(<CarCalendarScreen car={{ id: "auto-1" }} onBack={() => {}} />);
  await asentar();
  irAlMesSiguiente(arbol);
  return arbol;
};

describe("Calendario del dueño · reservas nuevas con la pantalla abierta", () => {
  it("una reserva que llega mientras está abierto bloquea el día a los 30 s", async () => {
    const tr = await montar();
    mockGetReservas.mockResolvedValue([reservaConfirmadaEl12()]);

    await act(async () => {
      jest.advanceTimersByTime(30000);
    });
    await asentar();
    await tocarDia12(tr);

    expect(mockShowAlert).toHaveBeenCalledWith("Día con reserva", expect.any(String));
    expect(mockCrearBloqueo).not.toHaveBeenCalled();
  });

  it("al volver la app a primer plano se refrescan las reservas", async () => {
    const tr = await montar();
    mockGetReservas.mockResolvedValue([reservaConfirmadaEl12()]);

    await act(async () => {
      cambioDeEstadoApp("active");
    });
    await asentar();
    await tocarDia12(tr);

    expect(mockShowAlert).toHaveBeenCalledWith("Día con reserva", expect.any(String));
  });

  it("una solicitud pagada que espera tu confirmación también ocupa el día", async () => {
    // Estado "pendiente" = pagada y esperando al dueño (24 h): el auto ya no está libre para nadie más.
    mockGetReservas.mockResolvedValue([{ ...reservaConfirmadaEl12(), estado: "pendiente" }]);
    const tr = await montar();

    await tocarDia12(tr);

    expect(mockShowAlert).toHaveBeenCalledWith("Día con reserva", expect.any(String));
    expect(mockCrearBloqueo).not.toHaveBeenCalled();
  });

  it("al cerrar la pantalla deja de consultar", async () => {
    await montar();
    const llamadas = mockGetReservas.mock.calls.length;

    act(() => {
      arbol.unmount();
    });
    arbol = null;
    await act(async () => {
      jest.advanceTimersByTime(120000);
    });

    expect(mockGetReservas.mock.calls.length).toBe(llamadas);
  });
});
