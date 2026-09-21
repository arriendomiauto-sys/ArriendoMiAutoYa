import React from "react";
import { act } from "react-test-renderer";
import { StyleSheet } from "react-native";
import { Icon, Field, BotonesOAuth, colors } from "@rentacar/mobile-shared";
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

// Caja del campo: el View con borde de 1.5 que envuelve al input.
const cajaDelCampo = (tr) =>
  tr.root.findAll((n) => StyleSheet.flatten(n.props?.style)?.borderWidth === 1.5)[0];
const estiloCaja = (tr) => StyleSheet.flatten(cajaDelCampo(tr).props.style);

// El Field (no el TextInput de adentro) que lleva ese testID.
const campo = (tr, id) => tr.root.findAllByType(Field).find((f) => f.props.testID === id);

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

describe("Field · estados que usa el login", () => {
  it("invalid pone el borde en rojo sin escribir ningún texto debajo", () => {
    const tr = renderTree(<Field label="Clave" value="" onChangeText={() => {}} invalid />);
    expect(estiloCaja(tr).borderColor).toBe(colors.danger);
    expect(textOf(tr)).toBe("Clave");
  });

  it("sin invalid el borde no es rojo", () => {
    const tr = renderTree(<Field label="Clave" value="" onChangeText={() => {}} />);
    expect(estiloCaja(tr).borderColor).not.toBe(colors.danger);
  });

  it("con editable={false} el campo se ve apagado, distinto del editable", () => {
    const activo = renderTree(<Field label="Correo" value="a" onChangeText={() => {}} />);
    const apagado = renderTree(<Field label="Correo" value="a" onChangeText={() => {}} editable={false} />);
    expect(estiloCaja(apagado).backgroundColor).not.toBe(estiloCaja(activo).backgroundColor);
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

describe("BotonesOAuth · bloqueo", () => {
  const botones = (tr) => tr.root.findAll((n) => n.props?.accessibilityLabel?.startsWith?.("Continuar con") && n.props.onPress);

  it("con disabled todos los proveedores quedan bloqueados", () => {
    const lista = botones(renderTree(<BotonesOAuth compact disabled />));
    expect(lista.length).toBeGreaterThan(0);
    lista.forEach((b) => {
      expect(b.props.disabled).toBe(true);
      expect(b.props.accessibilityState.disabled).toBe(true);
    });
  });

  it("sin disabled quedan habilitados", () => {
    botones(renderTree(<BotonesOAuth compact />)).forEach((b) => {
      expect(b.props.disabled).toBe(false);
    });
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

  it("no deja entrar con campos vacíos y lo avisa en la pantalla, sin ventana emergente", async () => {
    const tr = renderTree(<LoginScreen onNavigate={() => {}} />);
    await act(async () => porTestId(tr, "btn-login").props.onPress());
    expect(mockLogin).not.toHaveBeenCalled();
    expect(textOf(tr)).toContain("Ingresa tu correo y tu contraseña.");
    expect(mockShowAlert).not.toHaveBeenCalled();
  });

  it("entra con el correo sin espacios sobrantes", async () => {
    const tr = renderTree(<LoginScreen onNavigate={() => {}} />);
    act(() => porTestId(tr, "input-email").props.onChangeText("  camila@correo.cl "));
    act(() => porTestId(tr, "input-password").props.onChangeText("clave-segura"));
    await act(async () => porTestId(tr, "btn-login").props.onPress());
    expect(mockLogin).toHaveBeenCalledWith("camila@correo.cl", "clave-segura");
  });

  it("credenciales incorrectas: aviso en la pantalla y la contraseña marcada, no el correo", async () => {
    mockLogin.mockRejectedValue(new Error("Invalid login credentials"));
    const tr = renderTree(<LoginScreen onNavigate={() => {}} />);
    act(() => porTestId(tr, "input-email").props.onChangeText("camila@correo.cl"));
    act(() => porTestId(tr, "input-password").props.onChangeText("mala"));
    await act(async () => porTestId(tr, "btn-login").props.onPress());

    expect(textOf(tr)).toContain("Correo o contraseña incorrectos");
    expect(campo(tr, "input-password").props.invalid).toBe(true);
    expect(campo(tr, "input-email").props.invalid).toBeFalsy();
    expect(mockShowAlert).not.toHaveBeenCalled();
  });

  it("credenciales incorrectas: conserva lo escrito y devuelve el foco a la contraseña", async () => {
    mockLogin.mockRejectedValue(new Error("Invalid login credentials"));
    const tr = renderTree(<LoginScreen onNavigate={() => {}} />);
    const enfocar = jest.fn();
    porTestId(tr, "input-password").instance.focus = enfocar;
    act(() => porTestId(tr, "input-email").props.onChangeText("camila@correo.cl"));
    act(() => porTestId(tr, "input-password").props.onChangeText("mala"));
    await act(async () => porTestId(tr, "btn-login").props.onPress());

    expect(enfocar).toHaveBeenCalledTimes(1);
    expect(porTestId(tr, "input-email").props.value).toBe("camila@correo.cl");
    expect(porTestId(tr, "input-password").props.value).toBe("mala");
  });

  it("un error de red se avisa sin marcar la contraseña", async () => {
    mockLogin.mockRejectedValue(new Error("Network request failed"));
    const tr = renderTree(<LoginScreen onNavigate={() => {}} />);
    act(() => porTestId(tr, "input-email").props.onChangeText("camila@correo.cl"));
    act(() => porTestId(tr, "input-password").props.onChangeText("clave"));
    await act(async () => porTestId(tr, "btn-login").props.onPress());

    expect(textOf(tr)).toContain("No se pudo conectar");
    expect(campo(tr, "input-password").props.invalid).toBeFalsy();
  });

  it("al volver a escribir en un campo desaparece el aviso y la marca roja", async () => {
    mockLogin.mockRejectedValue(new Error("Invalid login credentials"));
    const tr = renderTree(<LoginScreen onNavigate={() => {}} />);
    act(() => porTestId(tr, "input-email").props.onChangeText("camila@correo.cl"));
    act(() => porTestId(tr, "input-password").props.onChangeText("mala"));
    await act(async () => porTestId(tr, "btn-login").props.onPress());
    expect(textOf(tr)).toContain("Correo o contraseña incorrectos");

    act(() => porTestId(tr, "input-password").props.onChangeText("mala2"));
    expect(textOf(tr)).not.toContain("Correo o contraseña incorrectos");
    expect(campo(tr, "input-password").props.invalid).toBeFalsy();
  });

  describe("mientras se envía", () => {
    let terminar;
    let tr;
    const onNavigate = jest.fn();

    beforeEach(async () => {
      onNavigate.mockReset();
      mockLogin.mockImplementation(() => new Promise((resolve) => (terminar = resolve)));
      tr = renderTree(<LoginScreen onNavigate={onNavigate} />);
      act(() => porTestId(tr, "input-email").props.onChangeText("camila@correo.cl"));
      act(() => porTestId(tr, "input-password").props.onChangeText("clave"));
      await act(async () => {
        porTestId(tr, "btn-login").props.onPress();
      });
    });

    afterEach(async () => {
      await act(async () => terminar());
    });

    it("el botón muestra que está trabajando", () => {
      expect(porTestId(tr, "btn-login").props.loading).toBe(true);
    });

    it("correo y contraseña quedan bloqueados", () => {
      expect(porTestId(tr, "input-email").props.editable).toBe(false);
      expect(porTestId(tr, "input-password").props.editable).toBe(false);
    });

    it("los accesos con Google/Apple quedan bloqueados", () => {
      const oauth = tr.root.findAll((n) => n.props?.accessibilityLabel?.startsWith?.("Continuar con") && n.props.onPress);
      expect(oauth.length).toBeGreaterThan(0);
      oauth.forEach((b) => expect(b.props.disabled).toBe(true));
    });

    it("'¿Olvidaste tu contraseña?' no navega hasta que responda", () => {
      pressText(tr, "¿Olvidaste tu contraseña?");
      expect(onNavigate).not.toHaveBeenCalled();
    });
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
