/**
 * El perfil del arrendatario tiene una fila "Antecedentes" que abre la pantalla de certificados y
 * muestra en qué estado están.
 */
import React from "react";
import { act } from "react-test-renderer";
import { RenterProfileScreen } from "../src/renter/screens/RenterProfileScreen";
import { renderTree, pressText, textOf } from "../test-utils";

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock("@rentacar/mobile-shared/api/client", () => {
  const real = jest.requireActual("@rentacar/mobile-shared/api/client");
  real.ApiClient.getCalificaciones = jest.fn(() => Promise.resolve([]));
  return { ...real, ApiClient: real.ApiClient };
});

let mockUsuario;
jest.mock("@rentacar/mobile-shared/context/AppContext", () => ({
  useApp: () => ({ currentUser: mockUsuario, reservations: [], logout: jest.fn(), setMode: jest.fn(), isLoggedIn: true }),
}));

const asentar = () => new Promise((resolve) => setTimeout(resolve, 0));
const montar = async (props = {}) => {
  let tr;
  await act(async () => {
    tr = renderTree(<RenterProfileScreen {...props} />);
    await asentar();
  });
  return tr;
};

const usuario = (antecedentes_estado) => ({
  id: "u1", nombre: "Ana", email: "ana@correo.cl", estado_documentos: "verificado", antecedentes_estado,
});

describe("Perfil del arrendatario · Antecedentes", () => {
  it("la fila 'Antecedentes' abre la pantalla de certificados", async () => {
    mockUsuario = usuario("pendiente");
    const onOpenAntecedentes = jest.fn();
    const tr = await montar({ onOpenAntecedentes });

    act(() => pressText(tr, "Antecedentes"));

    expect(onOpenAntecedentes).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["limpio", "Aprobados"],
    ["revision", "En revisión"],
    ["bloqueado", "Contacta a soporte"],
    ["pendiente", "Pendiente"],
    [undefined, "Pendiente"],
  ])("con estado %s muestra '%s'", async (estado, meta) => {
    mockUsuario = usuario(estado);
    const tr = await montar();

    expect(textOf(tr)).toContain(meta);
  });
});

describe("Perfil del arrendatario · aviso destacado de antecedentes", () => {
  const banner = (tr) => tr.root.findAll((n) => n.props?.testID === "banner-antecedentes" && n.props.onPress)[0];

  it("mientras falten, hay un aviso arriba del menú que abre la pantalla de certificados", async () => {
    mockUsuario = usuario("pendiente");
    const onOpenAntecedentes = jest.fn();
    const tr = await montar({ onOpenAntecedentes, antecedentesObligatorios: true });

    expect(textOf(tr)).toContain("Sube tus antecedentes y tu hoja de vida");
    expect(textOf(tr)).toContain("Son obligatorios para reservar");
    act(() => banner(tr).props.onPress());
    expect(onOpenAntecedentes).toHaveBeenCalledTimes(1);
  });

  it("si hoy no se exigen, no dice que son obligatorios", async () => {
    mockUsuario = usuario("pendiente");
    const tr = await montar({ antecedentesObligatorios: false });

    expect(textOf(tr)).toContain("Sube tus antecedentes y tu hoja de vida");
    expect(textOf(tr)).not.toContain("obligatorios");
  });

  it("en revisión lo dice sin pedir nada más", async () => {
    mockUsuario = usuario("revision");
    const tr = await montar();
    expect(textOf(tr)).toContain("Estamos revisando tus certificados");
  });

  it("aprobados, el aviso desaparece", async () => {
    mockUsuario = usuario("limpio");
    const tr = await montar();
    expect(banner(tr)).toBeUndefined();
  });

  it("el estado que llega del servidor manda sobre el del perfil cargado", async () => {
    mockUsuario = usuario("pendiente");
    const tr = await montar({ estadoAntecedentes: "limpio" });
    expect(banner(tr)).toBeUndefined();
    expect(textOf(tr)).toContain("Aprobados");
  });
});
