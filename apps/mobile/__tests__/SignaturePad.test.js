/**
 * El pad de firma no se puede probar dibujando de verdad (el gesto depende
 * del motor táctil nativo de React Native, que no corre en este entorno de
 * test — ver DeliveryScreenFirma.test.js), pero sí su estado inicial: sin
 * trazo, muestra el placeholder y no deja borrar nada que no existe.
 */
import React from "react";
import { SignaturePad } from "@rentacar/mobile-shared/components/SignaturePad";
import { renderTree, textOf } from "../test-utils";

describe("SignaturePad", () => {
  it("vacío muestra el placeholder y no llama a onChange", () => {
    const onChange = jest.fn();
    const tr = renderTree(<SignaturePad onChange={onChange} />);
    expect(textOf(tr)).toContain("Firma aquí con el dedo");
    expect(onChange).not.toHaveBeenCalled();
  });

  it("el botón de borrar está deshabilitado sin firma", () => {
    const tr = renderTree(<SignaturePad onChange={() => {}} />);
    const boton = tr.root.findAll((n) => n.props?.children === "Borrar y firmar de nuevo")[0];
    let nodo = boton;
    while (nodo && nodo.props?.disabled === undefined) nodo = nodo.parent;
    expect(nodo?.props?.disabled).toBe(true);
  });
});
