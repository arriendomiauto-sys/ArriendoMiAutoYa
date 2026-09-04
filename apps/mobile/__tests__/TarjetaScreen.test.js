/**
 * Agregar o reemplazar la tarjeta fuera del enrolamiento inicial — la
 * pieza que faltaba: antes la única forma de cargar una tarjeta era
 * completando todo el KYC de nuevo.
 */
import React from "react";
import { act } from "react-test-renderer";
import { TarjetaScreen } from "@rentacar/mobile-shared/screens/TarjetaScreen";
import { renderTree, textOf, pressText } from "../test-utils";

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

const mockActualizarTarjeta = jest.fn();
jest.mock("@rentacar/mobile-shared/api/client", () => {
  const real = jest.requireActual("@rentacar/mobile-shared/api/client");
  return { ApiClient: { ...real.ApiClient, actualizarTarjeta: (...a) => mockActualizarTarjeta(...a) } };
});

const mockSetCurrentUser = jest.fn();
const mockContexto = {
  currentUser: { id: "u1", nombre: "Renato Soto", tarjeta_estado: "pendiente" },
  setCurrentUser: mockSetCurrentUser,
};
jest.mock("@rentacar/mobile-shared/context/AppContext", () => ({
  useApp: () => mockContexto,
}));

const asentar = () => new Promise((resolve) => setTimeout(resolve, 0));

const llenarFormulario = async (tr) => {
  // Cada campo lee `valor` de su propio closure de props — encadenar los
  // tres onChangeText en el mismo act() sin dejar re-renderizar entre
  // medio hace que cada uno pise el cambio del anterior (los tres parten
  // del mismo `valor` viejo). Un act() por campo deja que React actualice
  // props antes de buscar el siguiente input.
  const porPlaceholder = (ph) => tr.root.findAll((n) => n.props?.placeholder === ph)[0];
  for (const [ph, texto] of [
    ["4242 4242 4242 4242", "4242424242424242"],
    ["MM/AA", "12/30"],
    ["123", "123"],
  ]) {
    await act(async () => {
      porPlaceholder(ph).props.onChangeText(texto);
      await asentar();
    });
  }
};

beforeEach(() => {
  mockActualizarTarjeta.mockReset();
  mockSetCurrentUser.mockClear();
});

describe("TarjetaScreen", () => {
  it("sin tarjeta registrada, lo dice claramente", () => {
    const tr = renderTree(<TarjetaScreen onBack={() => {}} onDone={() => {}} />);
    expect(textOf(tr)).toContain("Sin tarjeta registrada");
  });

  it("con tarjeta ya cargada, muestra los últimos 4 dígitos y su estado", () => {
    mockContexto.currentUser = {
      id: "u1", nombre: "Renato Soto",
      tarjeta_estado: "validada", tarjeta_ultimos4: "4242", tarjeta_marca: "visa",
    };
    const tr = renderTree(<TarjetaScreen onBack={() => {}} onDone={() => {}} />);
    expect(textOf(tr)).toContain("4242");
    expect(textOf(tr)).toContain("Validada");
  });

  it("el nombre del titular no se puede editar: viene de la cuenta verificada", () => {
    mockContexto.currentUser = { id: "u1", nombre: "Renato Soto", tarjeta_estado: "pendiente" };
    const tr = renderTree(<TarjetaScreen onBack={() => {}} onDone={() => {}} />);
    expect(textOf(tr)).toContain("Renato Soto");
    expect(
      tr.root.findAll((n) => n.props?.placeholder === "Como aparece en la tarjeta").length
    ).toBe(0);
  });

  it("al guardar con éxito, actualiza el usuario en contexto y avisa", async () => {
    mockContexto.currentUser = { id: "u1", nombre: "Renato Soto", tarjeta_estado: "pendiente" };
    mockActualizarTarjeta.mockResolvedValue({
      tarjeta_estado: "validada",
      tarjeta_ultimos4: "4242",
      tarjeta_marca: "visa",
      motivo: null,
    });

    let tr;
    await act(async () => {
      tr = renderTree(<TarjetaScreen onBack={() => {}} onDone={() => {}} />);
      await asentar();
    });

    await llenarFormulario(tr);

    await act(async () => {
      pressText(tr, "Guardar tarjeta");
      await asentar();
    });

    expect(mockActualizarTarjeta).toHaveBeenCalledTimes(1);
    const payload = mockActualizarTarjeta.mock.calls[0][0];
    expect(payload.tarjeta_titular).toBe("Renato Soto");
    expect(mockSetCurrentUser).toHaveBeenCalled();
  });
});
