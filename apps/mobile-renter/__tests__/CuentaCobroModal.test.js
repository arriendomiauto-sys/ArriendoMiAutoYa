import React from "react";
import { act } from "react-test-renderer";
import { CuentaCobroModal } from "../src/owner/screens/CuentaCobroModal";
import { renderTree, textOf, pressText } from "../test-utils";

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

const mockAgregar = jest.fn();
jest.mock("@rentacar/mobile-shared", () => {
  const real = jest.requireActual("@rentacar/mobile-shared");
  return { ...real, ApiClient: { ...real.ApiClient, agregarCuentaCobro: (...a) => mockAgregar(...a) } };
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

beforeEach(() => mockAgregar.mockReset());

it("muestra la ayuda de CuentaRUT y los campos", () => {
  const tr = renderTree(<CuentaCobroModal visible onClose={() => {}} onGuardada={() => {}} />);
  const t = textOf(tr);
  expect(t).toContain("CuentaRUT");
  expect(t).toContain("Número de cuenta");
  act(() => tr.unmount());
});

it("no envía con campos incompletos", async () => {
  const tr = renderTree(<CuentaCobroModal visible onClose={() => {}} onGuardada={() => {}} />);
  await presionarYEsperar(tr, "Guardar cuenta");
  expect(mockAgregar).not.toHaveBeenCalled();
  act(() => tr.unmount());
});

it("con nombreTitular del registro/KYC, el titular es no modificable y muestra la validación", () => {
  const tr = renderTree(
    <CuentaCobroModal
      visible
      onClose={() => {}}
      onGuardada={() => {}}
      nombreTitular="Carlos Silva"
      identidadVerificada={true}
    />
  );
  const t = textOf(tr);
  expect(t).toContain("Carlos Silva");
  expect(t).toContain("Nombre validado con tu carnet de identidad (KYC)");

  // No debe haber un TextInput editable con el accessibilityLabel de "Nombre del titular"
  const inputTitular = tr.root.findAll(
    (n) => n.props?.accessibilityLabel === "Nombre del titular" && typeof n.props?.onChangeText === "function"
  );
  expect(inputTitular.length).toBe(0);
  act(() => tr.unmount());
});
