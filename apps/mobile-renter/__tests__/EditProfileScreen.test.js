/**
 * Editar los datos de contacto (nombre / teléfono) después del registro.
 * RegisterScreen los guarda con actualizarPerfilBasico y prometía en un
 * comentario que se completaban "después desde el perfil" — esta pantalla
 * es esa promesa. El teléfono se guarda con el prefijo fijo "+56 9".
 */
import React from "react";
import { act } from "react-test-renderer";
import { EditProfileScreen } from "@rentacar/mobile-shared/screens/EditProfileScreen";
import { renderTree, textOf, pressText } from "../test-utils";

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

const mockActualizarPerfilBasico = jest.fn();
jest.mock("@rentacar/mobile-shared/api/client", () => {
  const real = jest.requireActual("@rentacar/mobile-shared/api/client");
  return {
    ApiClient: { ...real.ApiClient, actualizarPerfilBasico: (...a) => mockActualizarPerfilBasico(...a) },
  };
});

const mockSetCurrentUser = jest.fn();
const mockSyncProfile = jest.fn(() => Promise.resolve());
const mockContexto = {
  currentUser: { id: "u1", nombre: "Ana", telefono: "+56 9 1111 2222", email: "ana@correo.cl" },
  setCurrentUser: mockSetCurrentUser,
  syncProfile: mockSyncProfile,
};
jest.mock("@rentacar/mobile-shared/context/AppContext", () => ({
  useApp: () => mockContexto,
}));

const asentar = () => new Promise((resolve) => setTimeout(resolve, 0));
const porPlaceholder = (tr, ph) => tr.root.findAll((n) => n.props?.placeholder === ph)[0];

const escribir = async (tr, ph, texto) => {
  await act(async () => {
    porPlaceholder(tr, ph).props.onChangeText(texto);
    await asentar();
  });
};

const montar = async () => {
  let tr;
  await act(async () => {
    tr = renderTree(<EditProfileScreen onBack={() => {}} onDone={() => {}} />);
    await asentar();
  });
  return tr;
};

beforeEach(() => {
  mockActualizarPerfilBasico.mockReset();
  mockSetCurrentUser.mockClear();
  mockSyncProfile.mockClear();
  mockContexto.currentUser = { id: "u1", nombre: "Ana", telefono: "+56 9 1111 2222", email: "ana@correo.cl" };
});

describe("EditProfileScreen", () => {
  it("precarga el teléfono sin el prefijo +56 9", async () => {
    const tr = await montar();
    expect(porPlaceholder(tr, "7734 1208").props.value).toBe("1111 2222");
    expect(porPlaceholder(tr, "Ej. Rodrigo Muñoz").props.value).toBe("Ana");
  });

  it("el correo se muestra pero no es editable acá", async () => {
    const tr = await montar();
    expect(textOf(tr)).toContain("ana@correo.cl");
    expect(tr.root.findAll((n) => n.props?.value === "ana@correo.cl").length).toBe(0);
  });

  it("guarda con el teléfono normalizado a +56 9 y refresca el contexto", async () => {
    mockActualizarPerfilBasico.mockResolvedValue({ id: "u1", nombre: "Ana Díaz", telefono: "+56 9 8888 7777" });
    const tr = await montar();

    await escribir(tr, "Ej. Rodrigo Muñoz", "Ana Díaz");
    await escribir(tr, "7734 1208", "8888 7777");

    await act(async () => {
      pressText(tr, "Guardar cambios");
      await asentar();
    });

    expect(mockActualizarPerfilBasico).toHaveBeenCalledTimes(1);
    expect(mockActualizarPerfilBasico.mock.calls[0][0]).toEqual({
      nombre: "Ana Díaz",
      telefono: "+56 9 8888 7777",
    });
    expect(mockSetCurrentUser).toHaveBeenCalledWith({
      id: "u1",
      nombre: "Ana Díaz",
      telefono: "+56 9 8888 7777",
    });
  });

  it("no llama al backend si el teléfono queda con menos de 8 dígitos", async () => {
    const tr = await montar();

    await escribir(tr, "7734 1208", "123");
    await act(async () => {
      pressText(tr, "Guardar cambios");
      await asentar();
    });

    expect(mockActualizarPerfilBasico).not.toHaveBeenCalled();
    expect(textOf(tr)).toContain("Ingresa un móvil de 8 dígitos.");
  });
});
