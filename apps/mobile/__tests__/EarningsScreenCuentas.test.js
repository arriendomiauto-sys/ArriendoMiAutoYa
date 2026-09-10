import React from "react";
import { EarningsScreen } from "../src/owner/screens/EarningsScreen";
import { renderTree, textOf } from "../test-utils";

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
jest.mock("@rentacar/mobile-shared", () => {
  const real = jest.requireActual("@rentacar/mobile-shared");
  return {
    ...real,
    ApiClient: {
      ...real.ApiClient,
      getMisGanancias: (...a) => mockGanancias(...a),
      getCuentasCobro: (...a) => mockCuentas(...a),
    },
  };
});

const asentar = () => new Promise((r) => setTimeout(r, 0));

it("muestra las cuentas de cobro guardadas y el botón agregar", async () => {
  const tr = renderTree(<EarningsScreen />);
  await asentar();
  const t = textOf(tr);
  expect(t).toContain("••••5432");
  expect(t).toContain("Predeterminada");
  expect(t).toContain("Agregar cuenta");
});
