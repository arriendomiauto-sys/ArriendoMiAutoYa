import React from "react";
import { LegalModal, EDAD_MINIMA_ARRENDATARIO } from "@rentacar/mobile-shared";
import { RegisterScreen } from "@rentacar/mobile-shared/auth/screens/RegisterScreen";
import { renderTree, textOf, pressText } from "../test-utils";

jest.mock("@rentacar/mobile-shared/context/AppContext", () => ({
  useApp: () => ({ register: jest.fn() }),
}));

describe("LegalModal", () => {
  it("muestra el texto de los términos, no solo un link", () => {
    const t = textOf(renderTree(<LegalModal visible doc="terminos" onClose={() => {}} />));
    expect(t).toContain("Términos y Condiciones");
    expect(t).toContain("Requisitos para arrendatarios");
    expect(t).toContain("Hold de garantía");
    expect(t).toContain(`Ser mayor de ${EDAD_MINIMA_ARRENDATARIO - 1} años`);
  });

  it("permite cambiar a la política de privacidad", () => {
    const tr = renderTree(<LegalModal visible doc="terminos" onClose={() => {}} />);
    pressText(tr, "Privacidad");
    const t = textOf(tr);
    expect(t).toContain("Política de Privacidad");
    expect(t).toContain("Ley N° 19.628");
  });

  it("acepta desde el visor y lo cierra", () => {
    const onAccept = jest.fn();
    const onClose = jest.fn();
    const tr = renderTree(<LegalModal visible doc="terminos" onAccept={onAccept} onClose={onClose} />);

    pressText(tr, "Acepto");

    expect(onAccept).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe("RegisterScreen · términos", () => {
  it("ofrece leer términos y privacidad antes de marcar la casilla", () => {
    const tr = renderTree(<RegisterScreen onNavigate={() => {}} role="renter" />);
    const t = textOf(tr);
    expect(t).toContain("Términos y condiciones");
    expect(t).toContain("Política de privacidad");
    expect(t).toContain(`${EDAD_MINIMA_ARRENDATARIO} años o más`);
  });

  it("abre el documento completo desde el registro", () => {
    const tr = renderTree(<RegisterScreen onNavigate={() => {}} role="renter" />);
    expect(textOf(tr)).not.toContain("Hold de garantía");

    pressText(tr, "Términos y condiciones");

    expect(textOf(tr)).toContain("Hold de garantía");
  });
});
