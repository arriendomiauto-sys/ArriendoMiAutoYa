/**
 * Rendimiento de flota en Ganancias: cuánto generó cada auto y su tasa de
 * ocupación, para que un dueño con varios vehículos vea cuál le conviene
 * mantener publicado.
 */
import React from "react";
import { act } from "react-test-renderer";
import { EarningsScreen } from "../src/owner/screens/EarningsScreen";
import { renderTree, textOf } from "../test-utils";

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

const GANANCIAS = {
  saldo_disponible_clp: 100000,
  total_pagado_clp: 50000,
  cantidad_liquidaciones: 2,
  historial: [],
  por_auto: [
    {
      auto_id: "auto-1",
      marca: "Kia",
      modelo: "Rio",
      patente: "RIOX12",
      ganancia_total_clp: 144000,
      reservas_finalizadas: 3,
      dias_arrendado: 18,
      tasa_ocupacion_pct: 60.0,
    },
    {
      auto_id: "auto-2",
      marca: "Suzuki",
      modelo: "Alto",
      patente: "ALTO34",
      ganancia_total_clp: 0,
      reservas_finalizadas: 0,
      dias_arrendado: 0,
      tasa_ocupacion_pct: 0,
    },
  ],
};

const mockContexto = { bankAccount: null, updateBankAccount: jest.fn() };
jest.mock("@rentacar/mobile-shared", () => {
  const real = jest.requireActual("@rentacar/mobile-shared");
  return {
    ...real,
    useApp: () => mockContexto,
    ApiClient: { ...real.ApiClient, getMisGanancias: jest.fn(() => Promise.resolve(GANANCIAS)) },
  };
});

const asentar = async () => {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
};

describe("Ganancias · rendimiento de flota", () => {
  it("muestra cada auto con su ganancia y ocupación", async () => {
    const tr = renderTree(<EarningsScreen onBack={() => {}} />);
    await asentar();

    const t = textOf(tr);
    expect(t).toContain("Rendimiento de tu flota");
    expect(t).toContain("Kia Rio · RIOX12");
    expect(t).toContain("60% de ocupación");
    expect(t).toContain("3 arriendos finalizados");
    expect(t).toContain("Suzuki Alto · ALTO34");
    expect(t).toContain("0% de ocupación");
  });

  it("sin autos con datos, no muestra la sección", async () => {
    const { ApiClient } = require("@rentacar/mobile-shared");
    ApiClient.getMisGanancias.mockResolvedValueOnce({ ...GANANCIAS, por_auto: [] });

    const tr = renderTree(<EarningsScreen onBack={() => {}} />);
    await asentar();

    expect(textOf(tr)).not.toContain("Rendimiento de tu flota");
  });
});
