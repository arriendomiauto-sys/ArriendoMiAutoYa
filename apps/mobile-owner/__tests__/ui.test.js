import React from "react";
import { Button, Badge, EmptyState } from "@rentacar/mobile-shared";
import { renderTree, textOf, pressText } from "../test-utils";

describe("Button", () => {
  it("muestra el label y dispara onPress", () => {
    const onPress = jest.fn();
    const tr = renderTree(<Button label="Guardar" onPress={onPress} />);
    expect(textOf(tr)).toContain("Guardar");
    pressText(tr, "Guardar");
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("oculta el label mientras carga", () => {
    const tr = renderTree(<Button label="Enviar" onPress={() => {}} loading />);
    expect(textOf(tr)).not.toContain("Enviar");
  });

  it("no dispara onPress si disabled", () => {
    const onPress = jest.fn();
    const tr = renderTree(<Button label="X" onPress={onPress} disabled />);
    // TouchableOpacity disabled ignora el press
    expect(() => pressText(tr, "X")).not.toThrow();
    expect(onPress).not.toHaveBeenCalled();
  });
});

describe("Badge", () => {
  it("renderiza el label", () => {
    const tr = renderTree(<Badge variant="success" label="Confirmada" />);
    expect(textOf(tr)).toContain("Confirmada");
  });
});

describe("EmptyState", () => {
  it("muestra título, mensaje y dispara la acción", () => {
    const onAction = jest.fn();
    const tr = renderTree(
      <EmptyState title="Nada aquí" message="Sin resultados" action="Reintentar" onAction={onAction} />
    );
    const t = textOf(tr);
    expect(t).toContain("Nada aquí");
    expect(t).toContain("Sin resultados");
    pressText(tr, "Reintentar");
    expect(onAction).toHaveBeenCalled();
  });
});
