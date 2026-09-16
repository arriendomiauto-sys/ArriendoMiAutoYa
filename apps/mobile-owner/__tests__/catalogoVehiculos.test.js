/**
 * Catálogo de marcas y modelos.
 *
 * El autocompletado tenía 45 marcas y ningún modelo: cada dueño escribía el
 * modelo a mano y "Grand i10", "grand i 10" y "Grand-i10" terminaban siendo
 * tres autos distintos para el buscador.
 */
import {
  MARCAS,
  MODELOS_POR_MARCA,
  buscarMarcas,
  buscarModelos,
  esMarcaConocida,
  normalizarMarca,
} from "@rentacar/mobile-shared/vehiculo/catalogo";

describe("Catálogo de vehículos", () => {
  it("trae modelos para cada marca del catálogo", () => {
    // Una marca sin modelos deja al dueño escribiendo a mano, que es el
    // problema que este catálogo viene a resolver.
    MARCAS.forEach((marca) => {
      expect(MODELOS_POR_MARCA[marca]?.length).toBeGreaterThan(0);
    });
  });

  it("prioriza las marcas que empiezan con lo escrito", () => {
    // Escribiendo "to" interesa Toyota antes que Foton, aunque las dos
    // contengan "to".
    expect(buscarMarcas("to")[0]).toBe("Toyota");
  });

  it("encuentra marcas con tilde escribiéndolas sin tilde", () => {
    expect(buscarMarcas("citroen")).toContain("Citroën");
  });

  it("ignora guiones y espacios al buscar modelos", () => {
    // Las tres formas de escribir el mismo auto llegan al mismo modelo.
    ["grand i10", "grand-i10", "GRANDI10"].forEach((escrito) => {
      expect(buscarModelos("Hyundai", escrito)).toContain("Grand i10");
    });
  });

  it("sin texto devuelve todos los modelos de la marca", () => {
    expect(buscarModelos("Kia", "").length).toBe(MODELOS_POR_MARCA.Kia.length);
  });

  it("no sugiere modelos de otra marca cuando la marca no está en el catálogo", () => {
    // Preferible una lista vacía y texto libre a sugerir un Corolla para un
    // auto de una marca que no conocemos.
    expect(buscarModelos("MarcaInventada", "co")).toEqual([]);
  });

  it("reconoce la marca sin importar mayúsculas ni tildes", () => {
    expect(esMarcaConocida("toyota")).toBe(true);
    expect(esMarcaConocida("citroen")).toBe(true);
    expect(esMarcaConocida("Tesla")).toBe(false);
  });

  it("normaliza la marca al nombre del catálogo", () => {
    expect(normalizarMarca("volkswagen")).toBe("Volkswagen");
    // Lo que no está en el catálogo se devuelve tal cual: el campo sigue
    // aceptando texto libre.
    expect(normalizarMarca("Tesla")).toBe("Tesla");
  });

  it("cubre bastante más que la lista original de 45 marcas sin modelos", () => {
    const totalModelos = Object.values(MODELOS_POR_MARCA).flat().length;
    expect(MARCAS.length).toBeGreaterThanOrEqual(45);
    expect(totalModelos).toBeGreaterThan(250);
  });
});
