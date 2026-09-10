import React from "react";
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

const asentar = () => new Promise((r) => setTimeout(r, 0));

beforeEach(() => mockAgregar.mockReset());

it("muestra la ayuda de CuentaRUT y los campos", () => {
  const t = textOf(renderTree(<CuentaCobroModal visible onClose={() => {}} onGuardada={() => {}} />));
  expect(t).toContain("CuentaRUT");
  expect(t).toContain("Número de cuenta");
});

it("no envía con campos incompletos", async () => {
  const tr = renderTree(<CuentaCobroModal visible onClose={() => {}} onGuardada={() => {}} />);
  pressText(tr, "Guardar cuenta");
  await asentar();
  expect(mockAgregar).not.toHaveBeenCalled();
});
