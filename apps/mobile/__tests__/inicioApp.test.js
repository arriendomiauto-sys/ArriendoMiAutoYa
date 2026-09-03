import React from "react";
import { act } from "react-test-renderer";
import { AuthFlow } from "@rentacar/mobile-shared";
import { renderTree, textOf } from "../test-utils";

// El flujo de autenticación solo necesita del contexto la bandera de
// onboarding: el resto de la app no se monta en estos tests.
const mockContexto = { onboardingVisto: null, marcarOnboardingVisto: jest.fn() };
jest.mock("@rentacar/mobile-shared/context/AppContext", () => ({
  useApp: () => mockContexto,
}));

function avanzar(ms) {
  act(() => {
    jest.advanceTimersByTime(ms);
  });
}

describe("Arranque de la app · pantallas de presentación", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockContexto.marcarOnboardingVisto = jest.fn();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("muestra el onboarding la primera vez que se abre la app", () => {
    mockContexto.onboardingVisto = false;
    const tr = renderTree(<AuthFlow />);

    // Splash de bienvenida completo.
    expect(textOf(tr)).toContain("Arriendo Mi Auto Ya");

    avanzar(1800);
    const t = textOf(tr);
    // La presentación trae un botón para saltarla: es la señal de que estamos
    // en el onboarding y no en la bienvenida.
    expect(t.toLowerCase()).toMatch(/saltar|omitir|siguiente|comenzar|empezar/);
  });

  it("salta el onboarding cuando ya se vio antes", () => {
    mockContexto.onboardingVisto = true;
    const tr = renderTree(<AuthFlow />);

    // Con el onboarding ya visto el splash es corto.
    avanzar(700);

    const t = textOf(tr);
    expect(t).toMatch(/Iniciar sesión|Crear cuenta|Ya tengo cuenta/i);
    expect(mockContexto.marcarOnboardingVisto).not.toHaveBeenCalled();
  });

  it("marca el onboarding como visto al terminarlo, para que no vuelva a salir", () => {
    mockContexto.onboardingVisto = false;
    const tr = renderTree(<AuthFlow />);
    avanzar(1800);

    // Recorre la presentación hasta el final por el botón de avance.
    for (let i = 0; i < 6; i += 1) {
      if (mockContexto.marcarOnboardingVisto.mock.calls.length) break;
      const botones = tr.root.findAll(
        (n) => typeof n.props?.onPress === "function" && !n.props?.disabled
      );
      if (!botones.length) break;
      act(() => botones[botones.length - 1].props.onPress());
    }

    expect(mockContexto.marcarOnboardingVisto).toHaveBeenCalled();
  });

  it("ante una bandera todavía desconocida muestra la presentación, no la esconde", () => {
    // onboardingVisto null = el almacenamiento aún no responde. Para alguien
    // que abre la app por primera vez, esconder la presentación sería peor que
    // repetirla.
    mockContexto.onboardingVisto = null;
    const tr = renderTree(<AuthFlow />);
    avanzar(1800);

    expect(textOf(tr).toLowerCase()).toMatch(/saltar|omitir|siguiente|comenzar|empezar/);
  });
});
