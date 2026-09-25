import React from "react";
import { act } from "react-test-renderer";
import { AuthFlow } from "@rentacar/mobile-shared";
import { renderTree, textOf } from "../test-utils";

const mockContexto = { onboardingVisto: true, marcarOnboardingVisto: jest.fn() };
jest.mock("@rentacar/mobile-shared/context/AppContext", () => ({
  useApp: () => mockContexto,
}));

function avanzar(ms) {
  act(() => {
    jest.advanceTimersByTime(ms);
  });
}

describe("AuthFlow · rol fijo", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it("con fixedRole='owner' la bienvenida no ofrece elegir el otro rol", () => {
    const tr = renderTree(<AuthFlow fixedRole="owner" />);
    avanzar(700);

    const t = textOf(tr);
    expect(t).toContain("Quiero publicar mi auto");
    expect(t).not.toContain("Quiero arrendar");
  });

  it("con fixedRole='renter' no hay recuadro de rol: explica cómo funciona el servicio", () => {
    const tr = renderTree(<AuthFlow fixedRole="renter" />);
    avanzar(700);

    const t = textOf(tr);
    expect(t).not.toContain("Quiero arrendar");
    expect(t).not.toContain("Quiero publicar mi auto");
    expect(t).toContain("Encuentra un auto cerca");
    expect(t).toContain("Entrega 100% digital");
    expect(t).toContain("Crear mi cuenta");
  });

  it("el carrusel de la bienvenida avanza solo y se puede elegir un paso tocando su punto", () => {
    const tr = renderTree(<AuthFlow fixedRole="renter" />);
    avanzar(700);
    const pasoActivo = () =>
      tr.root.findAll((n) => n.props?.accessibilityState?.selected === true && /Ir al paso/.test(n.props?.accessibilityLabel || ""))[0]
        ?.props.accessibilityLabel;

    expect(pasoActivo()).toBe("Ir al paso 1 de 4");
    avanzar(4500);
    expect(pasoActivo()).toBe("Ir al paso 2 de 4");

    const punto4 = tr.root.findAll((n) => n.props?.accessibilityLabel === "Ir al paso 4 de 4" && n.props?.onPress)[0];
    act(() => punto4.props.onPress());
    expect(pasoActivo()).toBe("Ir al paso 4 de 4");
  });

  it("sin fixedRole, la bienvenida ofrece los dos roles como siempre", () => {
    const tr = renderTree(<AuthFlow />);
    avanzar(700);

    const t = textOf(tr);
    expect(t).toContain("Quiero arrendar");
    expect(t).toContain("Quiero publicar mi auto");
  });
});
