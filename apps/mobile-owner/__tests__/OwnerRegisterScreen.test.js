import React from "react";
import { TextInput } from "react-native";
import { act } from "react-test-renderer";
import { ApiClient, CodigoVerificacion } from "@rentacar/mobile-shared";
import { OwnerRegisterScreen } from "../src/owner/auth/OwnerRegisterScreen";
import { OwnerField } from "../src/owner/auth/OwnerField";
import { renderTree as renderizar, textOf } from "../test-utils";

const mockRegister = jest.fn();
const mockVerifyOtp = jest.fn();

jest.mock("@rentacar/mobile-shared/context/AppContext", () => ({
  useApp: () => ({ register: (...a) => mockRegister(...a), loginConProveedor: jest.fn() }),
}));
jest.mock("@rentacar/mobile-shared/api/supabase", () => ({
  supabase: { auth: { verifyOtp: (...a) => mockVerifyOtp(...a), resend: jest.fn() } },
  getAccessToken: jest.fn(async () => null),
}));

// El paso del código deja un temporizador de reenvío corriendo: se desmonta al terminar cada test.
const montados = [];
const montar = (elemento) => {
  const tr = renderizar(elemento);
  montados.push(tr);
  return tr;
};
afterEach(() => {
  act(() => montados.splice(0).forEach((tr) => tr.unmount()));
});

const porTestId = (tr, id) => tr.root.findAll((n) => n.props?.testID === id && typeof n.type !== "string")[0];
const escribir = (tr, id, texto) => act(() => porTestId(tr, id).props.onChangeText(texto));
const tocar = async (tr, id) => act(async () => porTestId(tr, id).props.onPress());

async function llenarFormulario(tr) {
  escribir(tr, "input-nombre", "Jorge");
  escribir(tr, "input-apellido", "Contreras");
  escribir(tr, "input-email", "j.contreras@correo.cl");
  escribir(tr, "input-password", "autos2026");
  escribir(tr, "input-telefono", "9 8765 4321");
}

async function crearCuenta(tr) {
  llenarFormulario(tr);
  // Abre y revisa términos, luego marca el checkbox
  await tocar(tr, "checkbox-terminos");
  await tocar(tr, "checkbox-terminos");
  await tocar(tr, "btn-continuar");
}

describe("OwnerField · mensajes bajo el campo", () => {
  it("con error escribe el mensaje, marca el borde y lo anuncia como alerta", () => {
    const tr = montar(
      <OwnerField label="Celular" placeholder="9 1234 5678" value="" onChangeText={() => {}} error="El celular tiene 9 dígitos y empieza con 9." />
    );
    expect(textOf(tr)).toContain("El celular tiene 9 dígitos y empieza con 9.");
    expect(tr.root.findAll((n) => n.props?.accessibilityRole === "alert").length).toBeGreaterThan(0);
    const caja = tr.root.findAll((n) => typeof n.props?.className === "string" && n.props.className.includes("h-[52px]"))[0];
    expect(caja.props.className).toContain("border-danger");
  });

  it("con helper y sin error deja la pista en gris", () => {
    const tr = montar(<OwnerField label="Celular" value="" onChangeText={() => {}} helper="Una pista" />);
    expect(textOf(tr)).toContain("Una pista");
  });

  it("el error reemplaza a la pista", () => {
    const tr = montar(<OwnerField label="Celular" value="" onChangeText={() => {}} helper="Una pista" error="Falla" />);
    expect(textOf(tr)).toContain("Falla");
    expect(textOf(tr)).not.toContain("Una pista");
  });
});

describe("OwnerRegisterScreen", () => {
  beforeEach(() => {
    mockRegister.mockReset().mockResolvedValue({});
    mockVerifyOtp.mockReset().mockResolvedValue({ error: null });
    jest.spyOn(ApiClient, "actualizarPerfilBasico").mockResolvedValue({});
  });
  afterEach(() => jest.restoreAllMocks());

  it("paso 1: cabecera de dueño, campos con rótulo y sin RUT ni fecha de nacimiento", () => {
    const t = textOf(montar(<OwnerRegisterScreen onNavigate={() => {}} />));
    expect(t).toContain("Para dueños");
    expect(t).toContain("Paso 1 de 3");
    expect(t).toContain("Crea tu cuenta de dueño");
    for (const rotulo of ["Nombre", "Apellido", "Correo", "Contraseña", "Celular"]) expect(t).toContain(rotulo);
    expect(t).toContain("8 o más caracteres");
    expect(t).toContain("o regístrate con");
    expect(t).not.toMatch(/RUT|nacimiento/i);
  });

  it("con campos vacíos no avanza y dice qué corregir", async () => {
    const tr = montar(<OwnerRegisterScreen onNavigate={() => {}} />);
    await tocar(tr, "btn-continuar");
    const t = textOf(tr);
    expect(t).toContain("Paso 1 de 3");
    expect(t).toContain("Escribe tu nombre como aparece en tu cédula.");
    expect(t).toContain("Escribe un correo válido, como nombre@correo.cl.");
    expect(t).toContain("El celular tiene 9 dígitos y empieza con 9.");
  });

  it("sin aceptar términos no avanza y muestra aviso", async () => {
    const tr = montar(<OwnerRegisterScreen onNavigate={() => {}} />);
    llenarFormulario(tr);
    await tocar(tr, "btn-continuar");
    const t = textOf(tr);
    expect(t).toMatch(/Términos/i);
    expect(mockRegister).not.toHaveBeenCalled();
  });

  it("aceptar crea la cuenta con el rol de dueño y pasa al código", async () => {
    const tr = montar(<OwnerRegisterScreen onNavigate={() => {}} />);
    await crearCuenta(tr);
    expect(mockRegister).toHaveBeenCalledWith("j.contreras@correo.cl", "autos2026", "owner", {
      nombre: "Jorge Contreras",
      telefono: "+56 9 8765 4321",
    });
    expect(textOf(tr)).toContain("Revisa tu correo");
  });

  it("un correo ya registrado vuelve al paso 1 con el aviso y el camino al login", async () => {
    mockRegister.mockRejectedValue(Object.assign(new Error("User already registered"), { code: "already_registered" }));
    const onNavigate = jest.fn();
    const tr = montar(<OwnerRegisterScreen onNavigate={onNavigate} />);
    await crearCuenta(tr);
    expect(textOf(tr)).toContain("Ese correo ya está registrado");
    await tocar(tr, "btn-ir-login");
    expect(onNavigate).toHaveBeenCalledWith("login");
  });

  it("con el código correcto guarda el perfil y muestra la cuenta de dueño creada", async () => {
    const onNavigate = jest.fn();
    const tr = montar(<OwnerRegisterScreen onNavigate={onNavigate} />);
    await crearCuenta(tr);
    act(() => tr.root.findByType(CodigoVerificacion).props.onCambiar("123456"));
    await tocar(tr, "btn-verificar");

    expect(ApiClient.actualizarPerfilBasico).toHaveBeenCalledWith({
      nombre: "Jorge Contreras",
      telefono: "+56 9 8765 4321",
    });
    const t = textOf(tr);
    expect(t).toContain("Cuenta de dueño creada");
    expect(t).toContain("+56 9 8765 4321");
    expect(t).not.toMatch(/RUT/);

    await tocar(tr, "btn-ir-panel");
    expect(onNavigate).toHaveBeenCalledWith("login");
  });

  it("un código que no coincide o venció se explica bajo las casillas", async () => {
    mockVerifyOtp.mockResolvedValue({ error: new Error("expired") });
    const tr = montar(<OwnerRegisterScreen onNavigate={() => {}} />);
    await crearCuenta(tr);
    act(() => tr.root.findByType(CodigoVerificacion).props.onCambiar("000000"));
    await tocar(tr, "btn-verificar");
    expect(textOf(tr)).toContain("El código no coincide o venció. Pide uno nuevo.");
  });
});
