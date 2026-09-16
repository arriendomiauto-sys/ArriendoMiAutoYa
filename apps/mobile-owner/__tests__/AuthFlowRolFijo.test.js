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

  it("sin fixedRole, la bienvenida ofrece los dos roles como siempre", () => {
    const tr = renderTree(<AuthFlow />);
    avanzar(700);

    const t = textOf(tr);
    expect(t).toContain("Quiero arrendar");
    expect(t).toContain("Quiero publicar mi auto");
  });
});
