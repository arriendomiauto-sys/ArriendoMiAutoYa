/**
 * Tras pagar, la pantalla de reserva confirmada muestra cuánto se cobró y
 * cuánto se retiene, para que nadie tenga que adivinar qué pasó con su plata.
 */
import React from "react";
import { ActiveRentalScreen } from "../src/renter/screens/ActiveRentalScreen";
import { renderTree, textOf } from "../test-utils";

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

const confirmada = {
  id: "res-1",
  estado: "confirmada",
  fecha_inicio: "2026-09-23T10:00:00",
  fecha_fin: "2026-09-26T10:00:00",
  cobro: { monto: 66000, neto: 55462, iva: 10538 },
  garantia: { monto: 250000 },
  auto: { marca: "Kia", modelo: "Soluto", anio: 2022 },
};

describe("ActiveRentalScreen · reserva confirmada", () => {
  it("resume lo cobrado hoy y la garantía retenida", () => {
    const t = textOf(renderTree(<ActiveRentalScreen reservation={confirmada} onBack={() => {}} />));
    expect(t).toContain("Resumen del pago");
    expect(t).toContain("Cobrado hoy");
    expect(t).toContain("$66.000");
    expect(t).toContain("Garantía retenida");
    expect(t).toContain("$250.000");
    expect(t).toContain("Se libera al devolver el auto");
  });

  it("si la reserva no trae el desglose del cobro, no inventa un resumen", () => {
    const { cobro, garantia, ...sinDesglose } = confirmada;
    const t = textOf(renderTree(<ActiveRentalScreen reservation={sinDesglose} onBack={() => {}} />));
    expect(t).toContain("Reserva confirmada");
    expect(t).not.toContain("Resumen del pago");
  });

  it("usa monto_hold como garantía cuando la reserva viene de la lista y no trae garantia", () => {
    const { garantia, ...conHold } = confirmada;
    const t = textOf(
      renderTree(<ActiveRentalScreen reservation={{ ...conHold, monto_hold: 250000 }} onBack={() => {}} />)
    );
    expect(t).toContain("$250.000");
  });
});
