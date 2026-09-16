import { formatearDireccionChile } from "@rentacar/mobile-shared/utils/direccion";

describe("formatearDireccionChile", () => {
  it("arma calle número, ciudad, comuna y región", () => {
    const geo = {
      street: "Avenida Alemania",
      streetNumber: "6370",
      city: "Temuco",
      district: "Temuco",
      subregion: "Cautín",
      region: "Araucanía",
    };
    // Temuco ciudad == comuna -> la comuna no se repite.
    expect(formatearDireccionChile(geo)).toBe(
      "Avenida Alemania 6370, Temuco, Araucanía",
    );
  });

  it("incluye la comuna cuando difiere de la ciudad", () => {
    const geo = {
      street: "Camino El Alba",
      streetNumber: "1220",
      city: "Santiago",
      district: "Las Condes",
      region: "Región Metropolitana",
    };
    expect(formatearDireccionChile(geo)).toBe(
      "Camino El Alba 1220, Santiago, Las Condes, Región Metropolitana",
    );
  });

  it("usa name cuando no viene la calle y no duplica el número", () => {
    expect(
      formatearDireccionChile({ name: "Ruta 5 Sur Km 500", city: "Los Ángeles", region: "Biobío" }),
    ).toBe("Ruta 5 Sur Km 500, Los Ángeles, Biobío");
  });

  it("descarta niveles vacíos y cae en subregion si no hay ciudad", () => {
    expect(
      formatearDireccionChile({ street: "Prat", streetNumber: "10", subregion: "Osorno", region: "Los Lagos" }),
    ).toBe("Prat 10, Osorno, Los Lagos");
  });

  it("devuelve '' sin datos usables", () => {
    expect(formatearDireccionChile(null)).toBe("");
    expect(formatearDireccionChile({})).toBe("");
  });
});
