import React from "react";
import { CarCard } from "../src/renter/components/CarCard";
import { renderTree, textOf, pressText } from "../test-utils";

const car = {
  id: "c1",
  marca: "Suzuki",
  modelo: "Swift",
  anio: 2023,
  tarifa_dia: 38000,
  ubicacion_base: "Providencia",
  equipamiento: { ac: true, doble_traccion: true },
  rating_promedio: 4.8,
};

describe("CarCard", () => {
  it("muestra marca, modelo, ubicación, precio y rating", () => {
    const t = textOf(renderTree(<CarCard car={car} onPress={() => {}} />));
    expect(t).toContain("Suzuki Swift 2023");
    expect(t).toContain("Providencia");
    expect(t).toContain("38.000");
    expect(t).toContain("4.8");
  });

  it("pasa el auto completo a onPress", () => {
    const onPress = jest.fn();
    const tr = renderTree(<CarCard car={car} onPress={onPress} />);
    pressText(tr, "Suzuki Swift");
    expect(onPress).toHaveBeenCalledWith(car);
  });

  it("no explota con un auto sin equipamiento ni rating", () => {
    const t = textOf(
      renderTree(<CarCard car={{ id: "c2", marca: "Kia", modelo: "Rio", tarifa_dia: 20000 }} onPress={() => {}} />)
    );
    expect(t).toContain("Kia Rio");
  });
});
