import React from "react";
import { TextInput } from "react-native";
import { CarDetailScreen } from "../src/renter/screens/CarDetailScreen";
import { renderTree, textOf, pressText } from "../test-utils";

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

const car = {
  id: "c1",
  marca: "Suzuki",
  modelo: "Swift",
  anio: 2023,
  tarifa_dia: 40000,
  ubicacion_base: "Los Ángeles",
  fotos: ["https://example.com/1.jpg"],
};

describe("CarDetailScreen · elección de fechas", () => {
  it("la ficha ya no trae el calendario en línea: las fechas viven en su propia pantalla", () => {
    const tr = renderTree(<CarDetailScreen car={car} onBack={() => {}} onProceedToPayment={() => {}} />);

    // En la ficha solo hay auto y anfitrión — ni rastro de retiro/devolución.
    expect(textOf(tr)).not.toContain("Retiro");
    expect(textOf(tr)).not.toContain("Devolución");

    pressText(tr, "Siguiente");

    const t = textOf(tr);
    expect(t).toContain("Retiro");
    expect(t).toContain("Devolución");
    // Los placeholders del formato escrito a mano ya no existen…
    expect(t).not.toContain("AAAA-MM-DD");
    expect(t).not.toContain("HH:MM");
    // …y no queda ningún input tipeable.
    expect(tr.root.findAllByType(TextInput)).toHaveLength(0);
  });

  it("manda al pago las fechas en hora local, tal como se eligieron", () => {
    const onProceedToPayment = jest.fn();
    const tr = renderTree(
      <CarDetailScreen car={car} onBack={() => {}} onProceedToPayment={onProceedToPayment} />
    );

    pressText(tr, "Siguiente");
    pressText(tr, "Confirmar fechas");
    pressText(tr, "Ir a pagar");

    expect(onProceedToPayment).toHaveBeenCalledTimes(1);
    const [autoRecibido, draft] = onProceedToPayment.mock.calls[0];
    expect(autoRecibido).toBe(car);
    // Formato naive que espera el backend: sin "Z" ni desfase de zona.
    expect(draft.fechaInicio).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:00$/);
    expect(draft.fechaFin).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:00$/);
    expect(draft.fechaInicio.endsWith("T10:00:00")).toBe(true);
    expect(draft.fechaFin.endsWith("T18:00:00")).toBe(true);
    expect(new Date(draft.fechaFin) > new Date(draft.fechaInicio)).toBe(true);
    // Por defecto: mañana 10:00 → +4 días 18:00 = 3 días y 8 horas, que la
    // app cobra como 4 (mismo redondeo hacia arriba que el backend).
    expect(draft.dias).toBe(4);
    // El cobro del arriendo = días × tarifa. La garantía (montoHold) es un
    // monto fijo por categoría; el auto de prueba no lo trae → 0.
    expect(draft.montoCobro).toBe(4 * car.tarifa_dia);
    expect(draft.montoHold).toBe(0);
  });
});
