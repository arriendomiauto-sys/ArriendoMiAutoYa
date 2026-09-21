import React from "react";
import { act } from "react-test-renderer";
import { Icon } from "@rentacar/mobile-shared";
import { OwnerLoginScreen } from "../src/owner/auth/OwnerLoginScreen";
import { OwnerField } from "../src/owner/auth/OwnerField";
import { renderTree, textOf, pressText } from "../test-utils";

const mockLogin = jest.fn();
const mockShowAlert = jest.fn();

jest.mock("@rentacar/mobile-shared/context/AppContext", () => ({
  useApp: () => ({ login: (...a) => mockLogin(...a), loginConProveedor: jest.fn() }),
}));
jest.mock("@rentacar/mobile-shared/utils/alert", () => ({
  showAlert: (...a) => mockShowAlert(...a),
}));

const porTestId = (tr, id) => tr.root.find((n) => n.props?.testID === id && typeof n.type === "function");
const iconos = (tr) => tr.root.findAll((n) => n.type === Icon).map((n) => n.props.name);

describe("OwnerField · rótulo, ícono a la izquierda y ojo con ícono", () => {
  it("con label muestra el rótulo sobre el campo", () => {
    const tr = renderTree(<OwnerField label="Correo" placeholder="Correo electrónico" value="" onChangeText={() => {}} />);
    expect(textOf(tr)).toContain("Correo");
  });

  it("con iconLeft dibuja el ícono antes del input", () => {
    const tr = renderTree(<OwnerField iconLeft="mail" placeholder="Correo" value="" onChangeText={() => {}} />);
    expect(iconos(tr)).toEqual(["mail"]);
  });

  it("con revealIcon el ojo es un ícono, no el texto 'Ver', y sigue alternando", () => {
    const tr = renderTree(<OwnerField placeholder="Clave" value="" onChangeText={() => {}} secure revealIcon />);
    expect(textOf(tr)).not.toContain("Ver");

    const ojo = () => tr.root.find((n) => n.props?.accessibilityRole === "button" && n.props.onPress);
    expect(ojo().props.accessibilityLabel).toBe("Mostrar la contraseña");
    act(() => ojo().props.onPress());
    expect(ojo().props.accessibilityLabel).toBe("Ocultar la contraseña");
    expect(iconos(tr)).toEqual(["eye-off"]);
  });

  it("sin revealIcon conserva el texto Ver de la pantalla de registro", () => {
    const tr = renderTree(<OwnerField placeholder="Clave" value="" onChangeText={() => {}} secure />);
    expect(textOf(tr)).toContain("Ver");
  });
});

describe("OwnerLoginScreen", () => {
  beforeEach(() => {
    mockLogin.mockReset().mockResolvedValue(undefined);
    mockShowAlert.mockReset();
  });

  it("conserva el saludo del dueño", () => {
    const t = textOf(renderTree(<OwnerLoginScreen onNavigate={() => {}} />));
    expect(t).toContain("Bienvenido de nuevo");
    expect(t).toContain("Ingresa para revisar tus autos y tus ganancias.");
  });

  it("los campos llevan rótulo e ícono, igual que en la app de arrendatario", () => {
    const tr = renderTree(<OwnerLoginScreen onNavigate={() => {}} />);
    const t = textOf(tr);
    expect(t).toContain("Correo");
    expect(t).toContain("Contraseña");
    expect(iconos(tr)).toEqual(expect.arrayContaining(["mail", "lock", "eye"]));
  });

  it("ofrece Google y compañía en una fila bajo 'o continúa con'", () => {
    const t = textOf(renderTree(<OwnerLoginScreen onNavigate={() => {}} />));
    expect(t).toContain("o continúa con");
    expect(t).not.toContain("Continuar con Google");
  });

  it("los proveedores van antes del enlace para crear cuenta", () => {
    const t = textOf(renderTree(<OwnerLoginScreen onNavigate={() => {}} />));
    expect(t.indexOf("o continúa con")).toBeGreaterThan(-1);
    expect(t.indexOf("o continúa con")).toBeLessThan(t.indexOf("¿No tienes cuenta?"));
  });

  it("no deja entrar con campos vacíos y avisa", async () => {
    const tr = renderTree(<OwnerLoginScreen onNavigate={() => {}} />);
    await act(async () => porTestId(tr, "btn-login").props.onPress());
    expect(mockLogin).not.toHaveBeenCalled();
    expect(mockShowAlert).toHaveBeenCalledWith("Campos requeridos", expect.any(String));
  });

  it("entra con el correo sin espacios sobrantes", async () => {
    const tr = renderTree(<OwnerLoginScreen onNavigate={() => {}} />);
    act(() => porTestId(tr, "input-email").props.onChangeText(" j.contreras@correo.cl  "));
    act(() => porTestId(tr, "input-password").props.onChangeText("clave-segura"));
    await act(async () => porTestId(tr, "btn-login").props.onPress());
    expect(mockLogin).toHaveBeenCalledWith("j.contreras@correo.cl", "clave-segura");
  });

  it("navega a recuperar contraseña y a crear cuenta", () => {
    const onNavigate = jest.fn();
    const tr = renderTree(<OwnerLoginScreen onNavigate={onNavigate} />);
    pressText(tr, "¿Olvidaste tu contraseña?");
    expect(onNavigate).toHaveBeenLastCalledWith("forgot");
    pressText(tr, "Crear cuenta");
    expect(onNavigate).toHaveBeenLastCalledWith("register");
  });
});
