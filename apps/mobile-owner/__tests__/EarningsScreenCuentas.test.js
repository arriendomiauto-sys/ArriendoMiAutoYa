import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { EarningsScreen } from "../src/owner/screens/EarningsScreen";
import { textOf, pressText } from "../test-utils";

// Render que además deja asentar los efectos async (carga de ganancias y de
// cuentas) dentro del mismo act, para no interleavear scopes de act.
async function montar(element) {
  let tr;
  await act(async () => {
    tr = TestRenderer.create(element);
  });
  return tr;
}

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

const mockGanancias = jest.fn(() =>
  Promise.resolve({
    saldo_disponible_clp: 0,
    total_pagado_clp: 0,
    historial: [],
    por_auto: [],
  })
);
const mockCuentas = jest.fn(() =>
  Promise.resolve([
    { id: "c1", banco: "BancoEstado", tipo_cuenta: "CuentaRUT", numero: "••••5432", predeterminada: true },
  ])
);
const mockPredeterminada = jest.fn(() => Promise.resolve({}));
const mockEliminar = jest.fn(() => Promise.resolve({}));
const mockShowAlert = jest.fn();

jest.mock("@rentacar/mobile-shared", () => {
  const real = jest.requireActual("@rentacar/mobile-shared");
  return {
    ...real,
    showAlert: (...a) => mockShowAlert(...a),
    ApiClient: {
      ...real.ApiClient,
      getMisGanancias: (...a) => mockGanancias(...a),
      getCuentasCobro: (...a) => mockCuentas(...a),
      marcarCuentaCobroPredeterminada: (...a) => mockPredeterminada(...a),
      eliminarCuentaCobro: (...a) => mockEliminar(...a),
    },
  };
});

const DOS_CUENTAS = [
  { id: "c1", banco: "BancoEstado", tipo_cuenta: "CuentaRUT", numero: "••••5432", predeterminada: true },
  { id: "c2", banco: "Banco de Chile", tipo_cuenta: "Corriente", numero: "••••1111", predeterminada: false },
];

beforeEach(() => {
  jest.clearAllMocks();
  mockCuentas.mockImplementation(() =>
    Promise.resolve([
      { id: "c1", banco: "BancoEstado", tipo_cuenta: "CuentaRUT", numero: "••••5432", predeterminada: true },
    ])
  );
  mockPredeterminada.mockImplementation(() => Promise.resolve({}));
  mockEliminar.mockImplementation(() => Promise.resolve({}));
});

it("muestra las cuentas de cobro guardadas y el botón agregar", async () => {
  const tr = await montar(<EarningsScreen />);
  const t = textOf(tr);
  expect(t).toContain("••••5432");
  expect(t).toContain("Predeterminada");
  expect(t).toContain("Agregar cuenta");
});

it("un fallo al cambiar la cuenta predeterminada se le avisa al dueño", async () => {
  mockCuentas.mockImplementation(() => Promise.resolve(DOS_CUENTAS));
  mockPredeterminada.mockImplementation(() => Promise.reject(new Error("Sin conexión")));

  const tr = await montar(<EarningsScreen />);
  await act(async () => {
    pressText(tr, "Usar esta");
  });

  expect(mockPredeterminada).toHaveBeenCalledWith("c2");
  expect(mockShowAlert).toHaveBeenCalledWith("No se pudo actualizar", "Sin conexión");
});

it("eliminar una cuenta pide confirmación antes de borrarla", async () => {
  const tr = await montar(<EarningsScreen />);

  // El icono de basurero es el único onPress sin texto propio de la fila.
  const basurero = tr.root
    .findAll((n) => typeof n.props?.onPress === "function" && n.props?.hitSlop)
    .pop();
  act(() => basurero.props.onPress());

  expect(mockEliminar).not.toHaveBeenCalled();
  const [titulo, , botones] = mockShowAlert.mock.calls[0];
  expect(titulo).toBe("Eliminar cuenta");
  expect(botones.map((b) => b.style)).toEqual(["cancel", "destructive"]);

  // Recién al confirmar se borra.
  await act(async () => {
    await botones[1].onPress();
  });
  expect(mockEliminar).toHaveBeenCalledWith("c1");
});
