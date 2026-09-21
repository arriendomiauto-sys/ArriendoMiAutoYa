import React from "react";
import { SplashScreen } from "@rentacar/mobile-shared";
import { renderTree, textOf } from "../test-utils";

describe("SplashScreen · Pantalla de carga oficial (Owner)", () => {
  it("variante 'owner' muestra el título, eslogan de dueño y la etiqueta 'Para dueños'", () => {
    const tr = renderTree(<SplashScreen variante="owner" />);
    const t = textOf(tr);

    expect(t).toContain("Arriendo Mi Auto Ya");
    expect(t).toContain("Tu auto, trabajando por ti");
    expect(t).toContain("Para dueños");
    expect(t).toContain("Revisando tu sesión");
    tr.unmount();
  });

  it("variante 'renter' muestra el eslogan de arrendatario", () => {
    const tr = renderTree(<SplashScreen variante="renter" />);
    const t = textOf(tr);

    expect(t).toContain("Arriendo Mi Auto Ya");
    expect(t).toContain("Autos entre personas, cerca");
    tr.unmount();
  });
});
