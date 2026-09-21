import React from "react";
import { act } from "react-test-renderer";
import { useEnvioLogin } from "@rentacar/mobile-shared";
import { renderTree } from "../test-utils";

// Monta el hook real dentro de un componente mínimo y deja su último valor en
// `ref.current`. `login` es un espía, no una imitación del hook.
function montar(login) {
  const ref = { current: null };
  function Sonda() {
    ref.current = useEnvioLogin(login);
    return null;
  }
  renderTree(<Sonda />);
  return ref;
}

describe("useEnvioLogin", () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it("con algún campo vacío no llama a login y explica qué falta", async () => {
    const login = jest.fn();
    const ref = montar(login);

    await act(async () => ref.current.enviar("camila@correo.cl", "   "));

    expect(login).not.toHaveBeenCalled();
    expect(ref.current.error).toEqual({
      titulo: "Faltan datos",
      mensaje: "Ingresa tu correo y tu contraseña.",
      campo: null,
    });
    expect(ref.current.loading).toBe(false);
  });

  it("llama a login con el correo sin espacios sobrantes y la contraseña tal cual", async () => {
    const login = jest.fn().mockResolvedValue(undefined);
    const ref = montar(login);

    await act(async () => ref.current.enviar("  camila@correo.cl ", " clave con espacios "));

    expect(login).toHaveBeenCalledTimes(1);
    expect(login).toHaveBeenCalledWith("camila@correo.cl", " clave con espacios ");
    expect(ref.current.error).toBeNull();
  });

  it("credenciales incorrectas: aviso propio y marca el campo de contraseña", async () => {
    const login = jest.fn().mockRejectedValue(new Error("Invalid login credentials"));
    const ref = montar(login);

    await act(async () => ref.current.enviar("camila@correo.cl", "mala"));

    expect(ref.current.error).toEqual({
      titulo: "Correo o contraseña incorrectos",
      mensaje: "Revisa los datos e inténtalo de nuevo, o cambia tu contraseña.",
      campo: "password",
    });
  });

  it("un error de red NO marca la contraseña y usa el texto traducido", async () => {
    const login = jest.fn().mockRejectedValue(new Error("Network request failed"));
    const ref = montar(login);

    await act(async () => ref.current.enviar("camila@correo.cl", "clave"));

    expect(ref.current.error).toEqual({
      titulo: "No se pudo iniciar sesión",
      mensaje: "No se pudo conectar. Revisa tu conexión a internet e intenta de nuevo.",
      campo: null,
    });
  });

  it("está cargando mientras login no responde y deja de estarlo al terminar", async () => {
    let terminar;
    const login = jest.fn(() => new Promise((resolve) => (terminar = resolve)));
    const ref = montar(login);

    let envio;
    act(() => {
      envio = ref.current.enviar("camila@correo.cl", "clave");
    });
    expect(ref.current.loading).toBe(true);

    await act(async () => {
      terminar();
      await envio;
    });
    expect(ref.current.loading).toBe(false);
  });

  it("un segundo envío mientras el primero sigue en curso no vuelve a llamar a login", async () => {
    let terminar;
    const login = jest.fn(() => new Promise((resolve) => (terminar = resolve)));
    const ref = montar(login);

    let primero;
    act(() => {
      primero = ref.current.enviar("camila@correo.cl", "clave");
    });
    await act(async () => ref.current.enviar("camila@correo.cl", "clave"));

    expect(login).toHaveBeenCalledTimes(1);

    await act(async () => {
      terminar();
      await primero;
    });
  });

  it("si login no responde en 15 s avisa que no hubo respuesta y desbloquea el formulario", async () => {
    jest.useFakeTimers();
    const login = jest.fn(() => new Promise(() => {}));
    const ref = montar(login);

    act(() => {
      ref.current.enviar("camila@correo.cl", "clave");
    });

    await act(async () => {
      jest.advanceTimersByTime(14999);
    });
    expect(ref.current.loading).toBe(true);
    expect(ref.current.error).toBeNull();

    await act(async () => {
      jest.advanceTimersByTime(1);
    });
    expect(ref.current.loading).toBe(false);
    expect(ref.current.error).toEqual({
      titulo: "Sin respuesta",
      mensaje: "Revisa tu conexión a internet e inténtalo de nuevo.",
      campo: null,
    });
  });

  it("si login responde antes de los 15 s no queda ningún aviso de 'sin respuesta' pendiente", async () => {
    jest.useFakeTimers();
    const login = jest.fn().mockResolvedValue(undefined);
    const ref = montar(login);

    await act(async () => ref.current.enviar("camila@correo.cl", "clave"));
    await act(async () => {
      jest.advanceTimersByTime(20000);
    });

    expect(ref.current.error).toBeNull();
  });

  it("limpiarError quita el aviso, y un nuevo envío también lo reemplaza", async () => {
    const login = jest
      .fn()
      .mockRejectedValueOnce(new Error("Invalid login credentials"))
      .mockRejectedValueOnce(new Error("Invalid login credentials"))
      .mockResolvedValueOnce(undefined);
    const ref = montar(login);

    await act(async () => ref.current.enviar("camila@correo.cl", "mala"));
    expect(ref.current.error).not.toBeNull();

    act(() => ref.current.limpiarError());
    expect(ref.current.error).toBeNull();

    await act(async () => ref.current.enviar("camila@correo.cl", "mala"));
    expect(ref.current.error).not.toBeNull();
    await act(async () => ref.current.enviar("camila@correo.cl", "buena"));
    expect(ref.current.error).toBeNull();
  });
});
