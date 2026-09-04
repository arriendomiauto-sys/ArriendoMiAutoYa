/**
 * Cuenta bancaria del dueño: banco y tipo de cuenta se eligen, no se escriben.
 *
 * Antes eran texto libre: un dueño escribía "bco estado" y otro
 * "BancoEstado", y soporte tenía que descifrar a mano a cuál banco real
 * correspondía cada transferencia manual — el universo de bancos con
 * operación retail en Chile es finito, así que no había razón para dejarlo
 * abierto como si fuera el modelo de un auto.
 */
import React from "react";
import { act } from "react-test-renderer";
import { EarningsScreen } from "../src/owner/screens/EarningsScreen";
import { renderTree, textOf, pressText } from "../test-utils";

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

const mockUpdateBankAccount = jest.fn(() => Promise.resolve());
const mockContexto = { bankAccount: null, updateBankAccount: mockUpdateBankAccount };

jest.mock("@rentacar/mobile-shared", () => {
  const real = jest.requireActual("@rentacar/mobile-shared");
  return {
    ...real,
    useApp: () => mockContexto,
    ApiClient: { ...real.ApiClient, getMisGanancias: jest.fn(() => Promise.resolve(null)) },
  };
});

// getMisGanancias() encadena dos promesas (la del mock + el await de
// cargar()); un solo microtask no alcanza a asentarlas, y la que queda
// pendiente resuelve después de que el test terminó, contra un árbol que el
// test siguiente ya desmontó.
const asentar = async () => {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
};

// pressText() dispara onPress con un act() síncrono; handleSaveBank es
// async y React se queja de que el act(async …) no se esperó — con timing
// suficientemente ajustado, la aserción siguiente llega antes de que la
// promesa de guardado se resuelva. Este helper local sí la espera.
const presionarYEsperar = async (tr, needle) => {
  const flat = (c) => (Array.isArray(c) ? c.filter((x) => typeof x === "string").join("") : c);
  const match = tr.root.findAll((n) => {
    const c = flat(n.props?.children);
    return typeof c === "string" && c.includes(needle);
  });
  let node = match[0];
  while (node && !node.props?.onPress) node = node.parent;
  if (!node) throw new Error(`No hay onPress cerca de "${needle}"`);
  await act(async () => {
    await node.props.onPress();
  });
};

const porEtiqueta = (tr, etiqueta) =>
  tr.root.findAll(
    (n) => n.props?.accessibilityLabel === etiqueta && typeof n.props?.onChangeText === "function"
  )[0];

let arbolActual = null;

// Cada EarningsScreen deja un fetch de getMisGanancias en vuelo al montarse;
// sin desmontar entre tests, esas promesas resuelven contra árboles de un
// test anterior y react-test-renderer termina con ".root on unmounted
// test renderer" en el test que viene después.
afterEach(() => {
  if (arbolActual) arbolActual.unmount();
  arbolActual = null;
});

const abrirFormulario = async () => {
  const tr = renderTree(<EarningsScreen onBack={() => {}} onOpenDisputes={() => {}} />);
  arbolActual = tr;
  await asentar();
  pressText(tr, "Configurar");
  return tr;
};

beforeEach(() => {
  mockUpdateBankAccount.mockClear();
  mockContexto.bankAccount = null;
});

describe("Cuenta bancaria del dueño", () => {
  it("ofrece el banco como una lista para elegir, no un campo libre", async () => {
    const tr = await abrirFormulario();

    act(() => porEtiqueta(tr, "Banco").props.onChangeText("estado"));

    expect(textOf(tr)).toContain("Banco Estado");
  });

  it("elegir un banco de la lista deja el nombre escrito igual para todos", async () => {
    const tr = await abrirFormulario();

    act(() => porEtiqueta(tr, "Banco").props.onChangeText("estado"));
    pressText(tr, "Banco Estado");

    expect(porEtiqueta(tr, "Banco").props.value).toBe("Banco Estado");
  });

  it("el tipo de cuenta se elige entre las cuatro opciones oficiales, no se escribe", async () => {
    const tr = await abrirFormulario();

    const t = textOf(tr);
    ["Cuenta Corriente", "Cuenta Vista", "Cuenta RUT", "Cuenta de Ahorro"].forEach((tipo) => {
      expect(t).toContain(tipo);
    });
  });

  it("no deja guardar sin elegir banco y tipo de cuenta", async () => {
    const tr = await abrirFormulario();
    await presionarYEsperar(tr, "Guardar cuenta");

    expect(mockUpdateBankAccount).not.toHaveBeenCalled();
  });

  it("con banco, tipo de cuenta y el resto de los datos, guarda la cuenta", async () => {
    const tr = await abrirFormulario();

    act(() => porEtiqueta(tr, "Banco").props.onChangeText("Banco Estado"));
    pressText(tr, "Cuenta RUT");
    act(() => porEtiqueta(tr, "Número de cuenta").props.onChangeText("1234567"));
    act(() => porEtiqueta(tr, "Nombre del titular").props.onChangeText("Juan Pérez"));
    act(() => porEtiqueta(tr, "RUT del titular").props.onChangeText("12.345.678-9"));

    await presionarYEsperar(tr, "Guardar cuenta");

    expect(mockUpdateBankAccount).toHaveBeenCalledWith(
      expect.objectContaining({
        banco: "Banco Estado",
        tipo_cuenta: "Cuenta RUT",
        numero: "1234567",
        titular: "Juan Pérez",
        rut: "12.345.678-9",
      })
    );
  });
});
