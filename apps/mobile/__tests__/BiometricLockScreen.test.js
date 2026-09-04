import React from "react";
import { act } from "react-test-renderer";
import { BiometricLockScreen } from "@rentacar/mobile-shared/screens/BiometricLockScreen";
import { renderTree, textOf, pressText } from "../test-utils";

const asentar = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("BiometricLockScreen", () => {
  it("pide el desbloqueo apenas aparece, sin esperar un toque", async () => {
    const onIntentarDesbloquear = jest.fn().mockResolvedValue(true);
    await act(async () => {
      renderTree(<BiometricLockScreen onIntentarDesbloquear={onIntentarDesbloquear} onLogout={() => {}} />);
      await asentar();
    });
    expect(onIntentarDesbloquear).toHaveBeenCalledTimes(1);
  });

  it("si falla, muestra el error y deja reintentar", async () => {
    const onIntentarDesbloquear = jest.fn().mockResolvedValue(false);
    let tr;
    await act(async () => {
      tr = renderTree(<BiometricLockScreen onIntentarDesbloquear={onIntentarDesbloquear} onLogout={() => {}} />);
      await asentar();
    });
    expect(textOf(tr)).toContain("No se pudo verificar");

    onIntentarDesbloquear.mockResolvedValue(true);
    await act(async () => {
      pressText(tr, "Desbloquear");
      await asentar();
    });
    expect(onIntentarDesbloquear).toHaveBeenCalledTimes(2);
  });

  it("permite cerrar sesión desde la pantalla de bloqueo", async () => {
    const onLogout = jest.fn();
    let tr;
    await act(async () => {
      tr = renderTree(
        <BiometricLockScreen onIntentarDesbloquear={jest.fn().mockResolvedValue(false)} onLogout={onLogout} />
      );
      await asentar();
    });
    act(() => pressText(tr, "Cerrar sesión"));
    expect(onLogout).toHaveBeenCalledTimes(1);
  });
});
