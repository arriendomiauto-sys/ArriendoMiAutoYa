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

// El OwnerField (no el TextInput de adentro) que lleva ese testID.
const campo = (tr, id) => tr.root.findAllByType(OwnerField).find((f) => f.props.testID === id);

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

describe("OwnerField · estados que usa el login", () => {
  // NativeWind deja el estilo en `className`: se compara lo que cambia entre estados.
  const claseCaja = (tr) =>
    tr.root.findAll((n) => typeof n.props?.className === "string" && n.props.className.includes("h-[52px]"))[0].props
      .className;

  it("invalid marca el borde de error y sin invalid no lo hay", () => {
    const normal = renderTree(<OwnerField placeholder="Clave" value="" onChangeText={() => {}} />);
    const malo = renderTree(<OwnerField placeholder="Clave" value="" onChangeText={() => {}} invalid />);
    expect(claseCaja(malo)).toContain("border-danger");
    expect(claseCaja(normal)).not.toContain("border-danger");
  });

  it("con editable={false} la caja cambia respecto de la editable", () => {
    const activo = renderTree(<OwnerField placeholder="Correo" value="a" onChangeText={() => {}} />);
    const apagado = renderTree(<OwnerField placeholder="Correo" value="a" onChangeText={() => {}} editable={false} />);
    expect(claseCaja(apagado)).not.toBe(claseCaja(activo));
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

  it("no deja entrar con campos vacíos y lo avisa en la pantalla, sin ventana emergente", async () => {
    const tr = renderTree(<OwnerLoginScreen onNavigate={() => {}} />);
    await act(async () => porTestId(tr, "btn-login").props.onPress());
    expect(mockLogin).not.toHaveBeenCalled();
    expect(textOf(tr)).toContain("Ingresa tu correo y tu contraseña.");
    expect(mockShowAlert).not.toHaveBeenCalled();
  });

  it("entra con el correo sin espacios sobrantes", async () => {
    const tr = renderTree(<OwnerLoginScreen onNavigate={() => {}} />);
    act(() => porTestId(tr, "input-email").props.onChangeText(" j.contreras@correo.cl  "));
    act(() => porTestId(tr, "input-password").props.onChangeText("clave-segura"));
    await act(async () => porTestId(tr, "btn-login").props.onPress());
    expect(mockLogin).toHaveBeenCalledWith("j.contreras@correo.cl", "clave-segura");
  });

  it("credenciales incorrectas: aviso en la pantalla y la contraseña marcada, no el correo", async () => {
    mockLogin.mockRejectedValue(new Error("Invalid login credentials"));
    const tr = renderTree(<OwnerLoginScreen onNavigate={() => {}} />);
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
    const tr = renderTree(<OwnerLoginScreen onNavigate={() => {}} />);
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
    const tr = renderTree(<OwnerLoginScreen onNavigate={() => {}} />);
    act(() => porTestId(tr, "input-email").props.onChangeText("camila@correo.cl"));
    act(() => porTestId(tr, "input-password").props.onChangeText("clave"));
    await act(async () => porTestId(tr, "btn-login").props.onPress());

    expect(textOf(tr)).toContain("No se pudo conectar");
    expect(campo(tr, "input-password").props.invalid).toBeFalsy();
  });

  it("al volver a escribir en un campo desaparece el aviso y la marca roja", async () => {
    mockLogin.mockRejectedValue(new Error("Invalid login credentials"));
    const tr = renderTree(<OwnerLoginScreen onNavigate={() => {}} />);
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
      tr = renderTree(<OwnerLoginScreen onNavigate={onNavigate} />);
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
    const tr = renderTree(<OwnerLoginScreen onNavigate={onNavigate} />);
    pressText(tr, "¿Olvidaste tu contraseña?");
    expect(onNavigate).toHaveBeenLastCalledWith("forgot");
    pressText(tr, "Crear cuenta");
    expect(onNavigate).toHaveBeenLastCalledWith("register");
  });
});
