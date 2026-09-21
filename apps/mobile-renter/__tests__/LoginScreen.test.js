import React from "react";
import { act } from "react-test-renderer";
import { Icon, Field, BotonesOAuth } from "@rentacar/mobile-shared";
import { LoginScreen } from "@rentacar/mobile-shared/auth/screens/LoginScreen";
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

describe("Icon · glifos que pide el login", () => {
  it.each(["mail", "eye", "eye-off"])("'%s' tiene dibujo propio, no el círculo genérico", (nombre) => {
    const propio = renderTree(<Icon name={nombre} />).toJSON();
    const generico = renderTree(<Icon name="no-existe" />).toJSON();
    expect(propio).not.toEqual(generico);
  });
});

describe("Field · ícono a la izquierda y ojo con ícono", () => {
  it("con iconLeft dibuja el ícono antes del input", () => {
    const tr = renderTree(<Field label="Correo" value="" onChangeText={() => {}} iconLeft="mail" />);
    const iconos = tr.root.findAll((n) => n.type === Icon && n.props.name === "mail");
    expect(iconos).toHaveLength(1);
  });

  it("con revealIcon el ojo es un ícono, no el texto 'Ver', y sigue alternando", () => {
    const tr = renderTree(<Field label="Clave" value="" onChangeText={() => {}} secure revealIcon />);
    expect(textOf(tr)).not.toContain("Ver");

    const ojo = () => tr.root.find((n) => n.props?.accessibilityRole === "button" && n.props.onPress);
    expect(ojo().props.accessibilityLabel).toBe("Mostrar la contraseña");
    act(() => ojo().props.onPress());
    expect(ojo().props.accessibilityLabel).toBe("Ocultar la contraseña");
    expect(tr.root.findAll((n) => n.type === Icon && n.props.name === "eye-off")).toHaveLength(1);
  });

  it("sin revealIcon conserva el texto Ver/Ocultar de las demás pantallas", () => {
    const tr = renderTree(<Field label="Clave" value="" onChangeText={() => {}} secure />);
    expect(textOf(tr)).toContain("Ver");
  });
});

describe("BotonesOAuth · variante en fila", () => {
  it("compact separa con 'o continúa con' y usa el nombre corto del proveedor", () => {
    const t = textOf(renderTree(<BotonesOAuth compact />));
    expect(t).toContain("o continúa con");
    expect(t).not.toContain("Continuar con Google");
    expect(t).toContain("Google");
  });

  it("sin compact se ve como siempre", () => {
    const t = textOf(renderTree(<BotonesOAuth />));
    expect(t).toContain("Continuar con Google");
  });
});

describe("LoginScreen · arrendatario", () => {
  beforeEach(() => {
    mockLogin.mockReset().mockResolvedValue(undefined);
    mockShowAlert.mockReset();
  });

  it("saluda con título y bajada propios", () => {
    const t = textOf(renderTree(<LoginScreen onNavigate={() => {}} />));
    expect(t).toContain("Hola de nuevo");
    expect(t).toContain("Ingresa para retomar tu próximo arriendo.");
  });

  it("los dos campos llevan ícono", () => {
    const tr = renderTree(<LoginScreen onNavigate={() => {}} />);
    const nombres = tr.root.findAll((n) => n.type === Icon).map((n) => n.props.name);
    expect(nombres).toEqual(expect.arrayContaining(["mail", "lock"]));
  });

  it("no deja entrar con campos vacíos y avisa", async () => {
    const tr = renderTree(<LoginScreen onNavigate={() => {}} />);
    await act(async () => porTestId(tr, "btn-login").props.onPress());
    expect(mockLogin).not.toHaveBeenCalled();
    expect(mockShowAlert).toHaveBeenCalledWith("Campos requeridos", expect.any(String));
  });

  it("entra con el correo sin espacios sobrantes", async () => {
    const tr = renderTree(<LoginScreen onNavigate={() => {}} />);
    act(() => porTestId(tr, "input-email").props.onChangeText("  camila@correo.cl "));
    act(() => porTestId(tr, "input-password").props.onChangeText("clave-segura"));
    await act(async () => porTestId(tr, "btn-login").props.onPress());
    expect(mockLogin).toHaveBeenCalledWith("camila@correo.cl", "clave-segura");
  });

  it("muestra el error traducido si el login falla", async () => {
    mockLogin.mockRejectedValue(new Error("Invalid login credentials"));
    const tr = renderTree(<LoginScreen onNavigate={() => {}} />);
    act(() => porTestId(tr, "input-email").props.onChangeText("camila@correo.cl"));
    act(() => porTestId(tr, "input-password").props.onChangeText("mala"));
    await act(async () => porTestId(tr, "btn-login").props.onPress());
    expect(mockShowAlert).toHaveBeenCalledWith("No se pudo iniciar sesión", expect.any(String));
  });

  it("navega a recuperar contraseña y a crear cuenta", () => {
    const onNavigate = jest.fn();
    const tr = renderTree(<LoginScreen onNavigate={onNavigate} />);
    pressText(tr, "¿Olvidaste tu contraseña?");
    expect(onNavigate).toHaveBeenLastCalledWith("forgot");
    pressText(tr, "Crear cuenta");
    expect(onNavigate).toHaveBeenLastCalledWith("register");
  });
});
