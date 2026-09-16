/**
 * Cuenta de cobro del dueño: banco y tipo de cuenta se eligen, no se escriben.
 *
 * Antes eran texto libre: un dueño escribía "bco estado" y otro
 * "BancoEstado", y soporte tenía que descifrar a mano a cuál banco real
 * correspondía cada transferencia manual — el universo de bancos con
 * operación retail en Chile es finito, así que no había razón para dejarlo
 * abierto como si fuera el modelo de un auto.
 *
 * El formulario vivía embebido en EarningsScreen; con los pagos automáticos
 * pasó a `CuentaCobroModal` (Task 9) y EarningsScreen ahora solo muestra la
 * lista de cuentas. Estas pruebas se repuntaron al modal, que conserva el
 * mismo `CampoConSugerencias` de bancos y los mismos chips de tipo de cuenta.
 */
import React from "react";
import { act } from "react-test-renderer";
import { CuentaCobroModal } from "../src/owner/screens/CuentaCobroModal";
import { renderTree, textOf, pressText } from "../test-utils";

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

const mockAgregar = jest.fn(() => Promise.resolve({ id: "c1" }));

jest.mock("@rentacar/mobile-shared", () => {
  const real = jest.requireActual("@rentacar/mobile-shared");
  return {
    ...real,
    ApiClient: { ...real.ApiClient, agregarCuentaCobro: (...a) => mockAgregar(...a) },
  };
});

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

const abrirFormulario = () =>
  renderTree(<CuentaCobroModal visible onClose={() => {}} onGuardada={() => {}} />);

beforeEach(() => {
  mockAgregar.mockClear();
});

describe("Cuenta de cobro del dueño", () => {
  it("ofrece el banco como una lista para elegir, no un campo libre", () => {
    const tr = abrirFormulario();

    act(() => porEtiqueta(tr, "Banco").props.onChangeText("estado"));

    expect(textOf(tr)).toContain("Banco Estado");
  });

  it("elegir un banco de la lista deja el nombre escrito igual para todos", () => {
    const tr = abrirFormulario();

    act(() => porEtiqueta(tr, "Banco").props.onChangeText("estado"));
    pressText(tr, "Banco Estado");

    expect(porEtiqueta(tr, "Banco").props.value).toBe("Banco Estado");
  });

  it("el tipo de cuenta se elige entre las cuatro opciones oficiales, no se escribe", () => {
    const tr = abrirFormulario();

    const t = textOf(tr);
    ["Cuenta Corriente", "Cuenta Vista", "Cuenta RUT", "Cuenta de Ahorro"].forEach((tipo) => {
      expect(t).toContain(tipo);
    });
  });

  it("no deja guardar sin elegir banco y tipo de cuenta", async () => {
    const tr = abrirFormulario();
    await presionarYEsperar(tr, "Guardar cuenta");

    expect(mockAgregar).not.toHaveBeenCalled();
  });

  it("con banco, tipo de cuenta y el resto de los datos, guarda la cuenta", async () => {
    const tr = abrirFormulario();

    act(() => porEtiqueta(tr, "Banco").props.onChangeText("Banco Estado"));
    pressText(tr, "Cuenta RUT");
    act(() => porEtiqueta(tr, "Número de cuenta").props.onChangeText("1234567"));
    act(() => porEtiqueta(tr, "Nombre del titular").props.onChangeText("Juan Pérez"));
    act(() => porEtiqueta(tr, "RUT del titular").props.onChangeText("12.345.678-9"));

    await presionarYEsperar(tr, "Guardar cuenta");

    expect(mockAgregar).toHaveBeenCalledWith(
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
