import React from "react";
import { AlertaInline, Icon } from "@rentacar/mobile-shared";
import { renderTree, textOf } from "../test-utils";

describe("AlertaInline", () => {
  it("muestra el título y el mensaje", () => {
    const tr = renderTree(
      <AlertaInline titulo="Correo o contraseña incorrectos" mensaje="Revisa los datos." />
    );
    const texto = textOf(tr);
    expect(texto).toContain("Correo o contraseña incorrectos");
    expect(texto).toContain("Revisa los datos.");
  });

  it("se anuncia como alerta para los lectores de pantalla", () => {
    const tr = renderTree(<AlertaInline titulo="Sin respuesta" mensaje="Revisa tu conexión." />);
    const alertas = tr.root.findAll((n) => n.props?.accessibilityRole === "alert");
    expect(alertas.length).toBeGreaterThan(0);
  });

  it("lleva un ícono de advertencia, para que no dependa solo del color", () => {
    const tr = renderTree(<AlertaInline titulo="Sin respuesta" mensaje="Revisa tu conexión." />);
    expect(tr.root.findAll((n) => n.type === Icon && n.props.name === "alert")).toHaveLength(1);
  });

  it("acepta testID para poder encontrarla en las pantallas", () => {
    const tr = renderTree(<AlertaInline testID="aviso-login" titulo="t" mensaje="m" />);
    expect(tr.root.findAll((n) => n.props?.testID === "aviso-login").length).toBeGreaterThan(0);
  });
});
