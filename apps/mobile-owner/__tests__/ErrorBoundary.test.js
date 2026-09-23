/**
 * Sin ErrorBoundary, una excepción no capturada durante el render tumba
 * TODO el árbol de React y deja al usuario con la pantalla en blanco, sin
 * forma de recuperarse salvo cerrar y reabrir la app. Verifica que atrapa
 * el error, muestra el mensaje de respaldo y que "Reintentar" vuelve a
 * intentar renderizar a los hijos.
 */
import React from "react";
import { act } from "react-test-renderer";
import { ErrorBoundary } from "@rentacar/mobile-shared/components/ErrorBoundary";
import { renderTree, textOf, pressText } from "../test-utils";

function ComponenteQueFalla() {
  throw new Error("boom");
}

function ComponenteOk() {
  return null;
}

// React registra un error en consola cuando un componente falla, incluso
// dentro de un ErrorBoundary: es ruido esperado en este test, se silencia
// para no ensuciar la salida.
let spyError;
beforeEach(() => {
  spyError = jest.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  spyError.mockRestore();
});

let arbolActual = null;
afterEach(() => {
  if (arbolActual) arbolActual.unmount();
  arbolActual = null;
});

describe("ErrorBoundary", () => {
  it("renderiza a los hijos normalmente cuando no hay error", () => {
    const tr = renderTree(
      <ErrorBoundary>
        <ComponenteOk />
      </ErrorBoundary>
    );
    arbolActual = tr;
    expect(textOf(tr)).not.toContain("Algo salió mal");
  });

  it("atrapa el error y muestra el mensaje de respaldo con botón de reintentar", () => {
    const tr = renderTree(
      <ErrorBoundary>
        <ComponenteQueFalla />
      </ErrorBoundary>
    );
    arbolActual = tr;
    expect(textOf(tr)).toContain("Algo salió mal");
    expect(textOf(tr)).toContain("Reintentar");
  });

  it("'Reintentar' vuelve a montar a los hijos", () => {
    let falla = true;
    function Hijo() {
      if (falla) throw new Error("boom");
      return null;
    }
    const tr = renderTree(
      <ErrorBoundary>
        <Hijo />
      </ErrorBoundary>
    );
    arbolActual = tr;
    expect(textOf(tr)).toContain("Algo salió mal");

    falla = false;
    act(() => {
      pressText(tr, "Reintentar");
    });

    expect(textOf(tr)).not.toContain("Algo salió mal");
  });
});
