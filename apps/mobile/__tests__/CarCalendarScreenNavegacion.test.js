/**
 * Navegación mensual en el calendario del dueño.
 *
 * Antes el calendario solo mostraba el mes actual: un dueño no podía
 * adelantarse a bloquear vacaciones o feriados de un mes futuro. No se
 * navega hacia atrás — no tiene sentido bloquear un día que ya pasó.
 */
import React from "react";
import { act } from "react-test-renderer";
import { CarCalendarScreen } from "../src/owner/screens/CarCalendarScreen";
import { renderTree, textOf, pressText } from "../test-utils";

const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

const mockGetReservas = jest.fn(async () => []);
const mockGetBloqueos = jest.fn(async () => []);
jest.mock("@rentacar/mobile-shared", () => {
  const real = jest.requireActual("@rentacar/mobile-shared");
  return {
    ...real,
    useApp: () => ({ cars: [{ id: "auto-1", marca: "Kia", modelo: "Rio" }] }),
    ApiClient: {
      ...real.ApiClient,
      getReservas: (...a) => mockGetReservas(...a),
      getBloqueosCalendario: (...a) => mockGetBloqueos(...a),
    },
  };
});

const asentar = async () => {
  await act(async () => {
    await Promise.resolve();
  });
};

const montar = async () => {
  const tr = renderTree(<CarCalendarScreen car={{ id: "auto-1" }} onBack={() => {}} />);
  await asentar();
  return tr;
};

beforeEach(() => {
  mockGetReservas.mockClear();
  mockGetBloqueos.mockClear();
});

describe("Calendario del dueño · navegación mensual", () => {
  it("abre mostrando el mes actual", async () => {
    const tr = await montar();
    const hoy = new Date();
    const t = textOf(tr);
    expect(t).toContain(MESES[hoy.getMonth()]);
    expect(t).toContain(String(hoy.getFullYear()));
  });

  it("el botón de mes anterior está deshabilitado en el mes actual y no retrocede", async () => {
    const tr = await montar();
    const boton = tr.root.findAll((n) => n.props?.accessibilityLabel === "Mes anterior")[0];
    expect(boton.props.disabled).toBe(true);
    expect(boton.props.accessibilityState.disabled).toBe(true);

    // El clamp vive también en el propio manejador (no solo en la UI): aun
    // llamándolo directo, no hay mes anterior al actual al que retroceder.
    const antes = textOf(tr);
    act(() => boton.props.onPress());
    expect(textOf(tr)).toBe(antes);
  });

  it("avanza al mes siguiente y dejar de estarlo habilita 'mes anterior'", async () => {
    const tr = await montar();
    const hoy = new Date();
    const siguiente = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 1);

    const botonSiguiente = tr.root.findAll((n) => n.props?.accessibilityLabel === "Mes siguiente")[0];
    act(() => botonSiguiente.props.onPress());

    const t = textOf(tr);
    expect(t).toContain(MESES[siguiente.getMonth()]);
    expect(t).toContain(String(siguiente.getFullYear()));

    const botonAnterior = tr.root.findAll((n) => n.props?.accessibilityLabel === "Mes anterior")[0];
    expect(botonAnterior.props.accessibilityState.disabled).toBe(false);
  });

  it("avanzar varios meses no deja volver más atrás que el mes actual", async () => {
    const tr = await montar();
    const botonSiguiente = () => tr.root.findAll((n) => n.props?.accessibilityLabel === "Mes siguiente")[0];
    const botonAnterior = () => tr.root.findAll((n) => n.props?.accessibilityLabel === "Mes anterior")[0];

    act(() => botonSiguiente().props.onPress());
    act(() => botonSiguiente().props.onPress());
    act(() => botonAnterior().props.onPress());
    act(() => botonAnterior().props.onPress());
    act(() => botonAnterior().props.onPress()); // un intento de más: no debe pasar del mes actual

    const hoy = new Date();
    const t = textOf(tr);
    expect(t).toContain(MESES[hoy.getMonth()]);
    expect(botonAnterior().props.accessibilityState.disabled).toBe(true);
  });

  it("cambiar de mes no dispara una nueva carga: los datos ya cubren cualquier mes", async () => {
    const tr = await montar();
    mockGetReservas.mockClear();
    mockGetBloqueos.mockClear();

    const botonSiguiente = tr.root.findAll((n) => n.props?.accessibilityLabel === "Mes siguiente")[0];
    act(() => botonSiguiente.props.onPress());
    await asentar();

    expect(mockGetReservas).not.toHaveBeenCalled();
    expect(mockGetBloqueos).not.toHaveBeenCalled();
  });
});
