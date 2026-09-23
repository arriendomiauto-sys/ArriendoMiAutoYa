/**
 * El calendario del dueño tiene que ver como "ocupado" un día con una reserva
 * `pendiente_pago` vigente (mismo criterio que el backend: ESTADOS_OCUPAN_AUTO),
 * no solo `confirmada`/`en_curso`. Si no, el dueño puede bloquear como "uso
 * personal" un día en pleno checkout de un arrendatario y el backend después
 * lo rechaza al confirmar.
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

// El calendario ya no deja tocar días pasados, así que estas pruebas se
// corren sobre el MES SIGUIENTE: todos sus días son futuros y el resultado no
// depende del día del mes en que se ejecute la suite.
const irAlMesSiguiente = (tr) => {
  const btn = tr.root.findAll((n) => n.props?.accessibilityLabel === "Mes siguiente")[0];
  act(() => btn.props.onPress());
};

const montar = async () => {
  const tr = renderTree(<CarCalendarScreen car={{ id: "auto-1" }} onBack={() => {}} />);
  await asentar();
  irAlMesSiguiente(tr);
  return tr;
};

const celdaDia = (tr, n) =>
  tr.root.findAll((node) => {
    if (typeof node.props?.onPress !== "function") return false;
    return React.Children.toArray(node.props.children).some((h) => h?.props?.children === n);
  })[0];

// Un día del mes que el calendario muestra (parte en el mes actual).
const diaDelMesVisible = (n) => {
  const hoy = new Date();
  return new Date(hoy.getFullYear(), hoy.getMonth() + 1, n, 10, 0, 0);
};

const reservaPendiente = (dia, expiraEnMs) => ({
  id: `r-${dia.getDate()}`,
  auto_id: "auto-1",
  estado: "pendiente_pago",
  fecha_inicio: dia.toISOString(),
  fecha_fin: new Date(dia.getTime() + 2 * 86400000).toISOString(),
  expira_en: new Date(Date.now() + expiraEnMs).toISOString(),
});

beforeEach(() => {
  mockGetReservas.mockReset().mockResolvedValue([]);
  mockGetBloqueos.mockReset().mockResolvedValue([]);
  mockCrearBloqueo.mockReset();
  mockShowAlert.mockClear();
});

describe("Calendario del dueño · reservas pendiente_pago", () => {
  it("una pendiente_pago vigente ocupa el día: no se puede bloquear", async () => {
    mockGetReservas.mockResolvedValue([reservaPendiente(diaDelMesVisible(12), 20 * 60000)]);
    const tr = await montar();

    act(() => celdaDia(tr, 12).props.onPress());

    expect(mockShowAlert).toHaveBeenCalledWith("Día con reserva", expect.any(String));
    expect(mockCrearBloqueo).not.toHaveBeenCalled();
  });

  it("una pendiente_pago ya expirada NO ocupa el día: se puede bloquear", async () => {
    mockGetReservas.mockResolvedValue([reservaPendiente(diaDelMesVisible(13), -60000)]);
    mockCrearBloqueo.mockReturnValue(new Promise(() => {})); // queda colgada; el update es optimista
    const tr = await montar();

    act(() => celdaDia(tr, 13).props.onPress());

    expect(mockCrearBloqueo).toHaveBeenCalledTimes(1);
    expect(mockShowAlert).not.toHaveBeenCalled();
  });
});
