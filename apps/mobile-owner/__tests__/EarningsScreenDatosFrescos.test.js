/**
 * BUG-006: tras liquidarse un arriendo, Ganancias seguía mostrando el saldo
 * anterior. El cliente HTTP guarda un caché de 30 s y la pantalla lo devolvía
 * tal cual al abrirse, sin consultar de nuevo.
 *
 * Ahora se muestra el caché al instante (sin spinner) y se revalida en
 * segundo plano, así que el saldo nuevo aparece solo.
 */
import React from "react";
import { act } from "react-test-renderer";
import { EarningsScreen } from "../src/owner/screens/EarningsScreen";
import { renderTree, textOf } from "../test-utils";

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

const VIEJO = { saldo_disponible_clp: 100000, total_ganado_clp: 100000, historial: [], por_auto: [] };
const NUEVO = { saldo_disponible_clp: 250000, total_ganado_clp: 250000, historial: [], por_auto: [] };

// Cliente falso con la misma semántica de caché que el real: devuelve lo
// guardado salvo que se pida `force`; lo que "responde el servidor" es NUEVO.
let mockCache = null;
const mockServidor = { data: null };
const mockContexto = { bankAccount: null, updateBankAccount: jest.fn() };
jest.mock("@rentacar/mobile-shared", () => {
  const real = jest.requireActual("@rentacar/mobile-shared");
  return {
    ...real,
    useApp: () => mockContexto,
    ApiClient: {
      ...real.ApiClient,
      getCachedGanancias: () => mockCache,
      getMisGanancias: jest.fn(async (opciones = {}) => {
        if (!opciones.force && mockCache) return mockCache;
        mockCache = mockServidor.data;
        return mockCache;
      }),
      getCuentasCobro: jest.fn(() => Promise.resolve([])),
    },
  };
});

const asentar = async () => {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
};

describe("Ganancias · datos frescos al abrir", () => {
  beforeEach(() => {
    mockCache = null;
    mockServidor.data = NUEVO;
  });

  it("con un caché viejo, termina mostrando el saldo actualizado", async () => {
    mockCache = VIEJO;

    const tr = renderTree(<EarningsScreen onBack={() => {}} />);
    await asentar();

    expect(textOf(tr)).toContain("$250.000");
    expect(textOf(tr)).not.toContain("$100.000");
  });

  it("muestra el caché al instante, sin esperar la red", () => {
    mockCache = VIEJO;

    const tr = renderTree(<EarningsScreen onBack={() => {}} />);

    expect(textOf(tr)).toContain("$100.000");
  });

  it("sin caché carga normalmente", async () => {
    const tr = renderTree(<EarningsScreen onBack={() => {}} />);
    await asentar();

    expect(textOf(tr)).toContain("$250.000");
  });
});
