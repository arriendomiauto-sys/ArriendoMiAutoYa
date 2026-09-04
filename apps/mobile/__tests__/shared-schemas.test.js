const {
  validarRutChileno,
  validarPatenteChilena,
  PublicarAutoSchema,
  CrearReservaSchema,
} = require("@rentacar/shared-schemas");

describe("validarRutChileno (Módulo 11)", () => {
  it("acepta RUT válidos con y sin puntos", () => {
    expect(validarRutChileno("17.123.456-5")).toBe(true);
    expect(validarRutChileno("17123456-5")).toBe(true);
    expect(validarRutChileno("18.456.789-K")).toBe(true);
  });

  it("rechaza dígito verificador incorrecto y basura", () => {
    expect(validarRutChileno("18.456.789-0")).toBe(false);
    expect(validarRutChileno("")).toBe(false);
    expect(validarRutChileno("hola")).toBe(false);
    expect(validarRutChileno(null)).toBe(false);
  });
});

describe("validarPatenteChilena", () => {
  it("acepta formato nuevo (4 consonantes + 2 dígitos) y antiguo (2 letras + 4 dígitos)", () => {
    expect(validarPatenteChilena("BBFK-42")).toBe(true);
    expect(validarPatenteChilena("BBFK42")).toBe(true);
    expect(validarPatenteChilena("AB1234")).toBe(true);
  });
  it("rechaza formatos inválidos", () => {
    expect(validarPatenteChilena("A1")).toBe(false);
    expect(validarPatenteChilena("")).toBe(false);
    expect(validarPatenteChilena("AAAA12")).toBe(false); // vocales no permitidas
  });
});

describe("PublicarAutoSchema", () => {
  const base = {
    marca: "Toyota",
    modelo: "RAV4",
    anio: 2023,
    patente: "BBFK-42",
    tarifa_dia: 40000,
    ubicacion_base: "Los Ángeles",
  };

  it("valida un auto correcto", () => {
    expect(PublicarAutoSchema.safeParse(base).success).toBe(true);
  });

  it("rechaza tarifa <= 0, menor a 15000, no múltiplo de 5000 y año fuera de rango", () => {
    expect(PublicarAutoSchema.safeParse({ ...base, tarifa_dia: 0 }).success).toBe(false);
    expect(PublicarAutoSchema.safeParse({ ...base, tarifa_dia: 10000 }).success).toBe(false);
    expect(PublicarAutoSchema.safeParse({ ...base, tarifa_dia: 42000 }).success).toBe(false); // No múltiplo de $5.000
    expect(PublicarAutoSchema.safeParse({ ...base, anio: 1990 }).success).toBe(false);
  });
});

describe("CrearReservaSchema", () => {
  it("rechaza fecha_fin anterior a fecha_inicio", () => {
    const r = CrearReservaSchema.safeParse({
      auto_id: "a1",
      fecha_inicio: "2026-09-05T10:00:00Z",
      fecha_fin: "2026-09-01T10:00:00Z",
      lugar_entrega_acordado: "Plaza",
    });
    expect(r.success).toBe(false);
  });
});
