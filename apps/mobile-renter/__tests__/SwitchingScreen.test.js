/**
 * Pantalla de transición: en modo `overlay` (cambio de rol) debe taparlo
 * TODO, no repartirse el alto con la pantalla de atrás. La captura real
 * mostraba el marketplace arriba y "Entrando al modo arrendatario" apretado
 * en la mitad inferior — señal de que el overlay no estaba absolutamente
 * posicionado de verdad.
 */
import React from "react";
import { StyleSheet } from "react-native";
import { SwitchingScreen } from "@rentacar/mobile-shared/screens/SwitchingScreen";
import { renderTree, textOf } from "../test-utils";

describe("SwitchingScreen", () => {
  it("sin overlay, no envuelve en una capa absoluta aparte", () => {
    const tr = renderTree(<SwitchingScreen mode="renter" title="Cargando tu sesión" />);
    expect(textOf(tr)).toContain("Cargando tu sesión");
    // La raíz misma es la vista animada — no hay un wrapper extra.
    const raiz = tr.toJSON();
    expect(raiz.props.style).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ elevation: 999 })])
    );
  });

  it("con overlay, la capa raíz cubre toda la pantalla y queda por encima", () => {
    const tr = renderTree(
      <SwitchingScreen overlay mode="renter" title="Entrando al modo arrendatario" subtitle="Cargando tu búsqueda de autos y tus reservas." />
    );
    expect(textOf(tr)).toContain("Entrando al modo arrendatario");

    const raiz = tr.toJSON();
    const estiloRaiz = StyleSheet.flatten(raiz.props.style);
    expect(estiloRaiz.position).toBe("absolute");
    expect(estiloRaiz.top).toBe(0);
    expect(estiloRaiz.bottom).toBe(0);
    expect(estiloRaiz.elevation).toBeGreaterThan(0);
  });
});
