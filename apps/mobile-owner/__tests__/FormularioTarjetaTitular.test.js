/**
 * Protocolo de seguridad: el nombre del titular de la tarjeta no se escribe
 * a mano — se usa el nombre verificado de la cuenta y queda de solo
 * lectura, para que no exista la posibilidad de cargar una tarjeta de otra
 * persona por error (o a propósito).
 */
import React from "react";
import { act } from "react-test-renderer";
import { FormularioTarjeta } from "@rentacar/mobile-shared/components/FormularioTarjeta";
import { renderTree, textOf } from "../test-utils";

describe("FormularioTarjeta · titular bloqueado", () => {
  it("sin nombreTitular, el campo sigue siendo editable (compatibilidad)", () => {
    const tr = renderTree(
      <FormularioTarjeta valor={{ numero: "", vencimiento: "", cvv: "", nombre: "" }} onChange={() => {}} />
    );
    const input = tr.root.findAll((n) => n.props?.placeholder === "Como aparece en la tarjeta")[0];
    expect(input).toBeTruthy();
  });

  it("con nombreTitular, el campo se autocompleta y deja de ser editable", () => {
    let valorActual = { numero: "", vencimiento: "", cvv: "", nombre: "" };
    const onChange = jest.fn((v) => {
      valorActual = v;
    });

    let tr;
    act(() => {
      tr = renderTree(
        <FormularioTarjeta valor={valorActual} onChange={onChange} nombreTitular="Renato Soto" />
      );
    });

    // Se sincroniza solo, sin que el usuario toque nada.
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ nombre: "Renato Soto" }));
    expect(textOf(tr)).toContain("Renato Soto");
    expect(textOf(tr)).toContain("debe estar a tu propio nombre");

    // Ya no hay un TextInput editable para el titular.
    const input = tr.root.findAll((n) => n.props?.placeholder === "Como aparece en la tarjeta");
    expect(input.length).toBe(0);
  });
});
