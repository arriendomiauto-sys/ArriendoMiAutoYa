import React from "react";
import { act } from "react-test-renderer";
import { useEnvioRecuperacion } from "@rentacar/mobile-shared";
import { renderTree } from "../test-utils";

// Monta el hook real dentro de un componente mínimo y deja su último valor en
// `ref.current`. `resetPassword` es un espía, no una imitación del hook.
function montar(resetPassword) {
  const ref = { current: null };
  function Sonda() {
    ref.current = useEnvioRecuperacion(resetPassword);
    return null;
  }
  renderTree(<Sonda />);
  return ref;
}

const avanzar = async (ms) => {
  await act(async () => {
    jest.advanceTimersByTime(ms);
  });
};

describe("useEnvioRecuperacion", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it("sin correo no llama a resetPassword y pide el correo", async () => {
    const resetPassword = jest.fn();
    const ref = montar(resetPassword);

    await act(async () => ref.current.enviar("   "));

    expect(resetPassword).not.toHaveBeenCalled();
    expect(ref.current.error).toEqual({
      titulo: "Falta el correo",
      mensaje: "Ingresa el correo con el que te registraste.",
    });
    expect(ref.current.enviado).toBe(false);
  });

  it("envía el correo sin espacios sobrantes y pasa a 'enviado' recordando a qué correo", async () => {
    const resetPassword = jest.fn().mockResolvedValue(undefined);
    const ref = montar(resetPassword);

    await act(async () => ref.current.enviar("  camila@correo.cl "));

    expect(resetPassword).toHaveBeenCalledTimes(1);
    expect(resetPassword).toHaveBeenCalledWith("camila@correo.cl");
    expect(ref.current.enviado).toBe(true);
    expect(ref.current.correo).toBe("camila@correo.cl");
    expect(ref.current.error).toBeNull();
  });

  it("si falla NO pasa a 'enviado' y explica el motivo traducido", async () => {
    const resetPassword = jest.fn().mockRejectedValue(new Error("email rate limit exceeded"));
    const ref = montar(resetPassword);

    await act(async () => ref.current.enviar("camila@correo.cl"));

    expect(ref.current.enviado).toBe(false);
    expect(ref.current.error).toEqual({
      titulo: "No se pudo enviar el correo",
      mensaje: "Se enviaron demasiados correos a esta dirección. Espera unos minutos e intenta de nuevo.",
    });
    expect(ref.current.loading).toBe(false);
  });

  it("un segundo envío mientras el primero sigue en curso no vuelve a llamar", async () => {
    let terminar;
    const resetPassword = jest.fn(() => new Promise((resolve) => (terminar = resolve)));
    const ref = montar(resetPassword);

    let primero;
    act(() => {
      primero = ref.current.enviar("camila@correo.cl");
    });
    expect(ref.current.loading).toBe(true);
    await act(async () => ref.current.enviar("camila@correo.cl"));
    expect(resetPassword).toHaveBeenCalledTimes(1);

    await act(async () => {
      terminar();
      await primero;
    });
    expect(ref.current.loading).toBe(false);
  });

  it("tras enviar, el reenvío queda en espera 1:00 y bloqueado", async () => {
    const resetPassword = jest.fn().mockResolvedValue(undefined);
    const ref = montar(resetPassword);

    await act(async () => ref.current.enviar("camila@correo.cl"));

    expect(ref.current.puedeReenviar).toBe(false);
    expect(ref.current.etiquetaEspera).toBe("1:00");
  });

  it("la espera cuenta hacia atrás y pedir de nuevo durante ella NO vuelve a llamar", async () => {
    const resetPassword = jest.fn().mockResolvedValue(undefined);
    const ref = montar(resetPassword);
    await act(async () => ref.current.enviar("camila@correo.cl"));

    await avanzar(18000);
    expect(ref.current.etiquetaEspera).toBe("0:42");

    await act(async () => ref.current.enviar("camila@correo.cl"));
    expect(resetPassword).toHaveBeenCalledTimes(1);
  });

  it("a los 60 s permite reenviar, vuelve a llamar y reinicia la espera", async () => {
    const resetPassword = jest.fn().mockResolvedValue(undefined);
    const ref = montar(resetPassword);
    await act(async () => ref.current.enviar("camila@correo.cl"));

    await avanzar(59000);
    expect(ref.current.puedeReenviar).toBe(false);
    await avanzar(1000);
    expect(ref.current.puedeReenviar).toBe(true);

    await act(async () => ref.current.enviar("camila@correo.cl"));

    expect(resetPassword).toHaveBeenCalledTimes(2);
    expect(ref.current.puedeReenviar).toBe(false);
    expect(ref.current.etiquetaEspera).toBe("1:00");
  });

  it("un fallo al reenviar mantiene la pantalla de 'enviado' y muestra el error", async () => {
    const resetPassword = jest
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("Network request failed"));
    const ref = montar(resetPassword);
    await act(async () => ref.current.enviar("camila@correo.cl"));
    await avanzar(60000);

    await act(async () => ref.current.enviar("camila@correo.cl"));

    expect(ref.current.enviado).toBe(true);
    expect(ref.current.error.titulo).toBe("No se pudo enviar el correo");
  });

  it("limpiarError quita el aviso", async () => {
    const resetPassword = jest.fn();
    const ref = montar(resetPassword);
    await act(async () => ref.current.enviar(""));
    expect(ref.current.error).not.toBeNull();

    act(() => ref.current.limpiarError());

    expect(ref.current.error).toBeNull();
  });
});
