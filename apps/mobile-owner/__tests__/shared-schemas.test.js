const {
  validarRutChileno,
  formatearRut,
  formatearTelefonoChileno,
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

describe("formatearRut", () => {
  it("formatea RUTs sin formato a estándar con puntos y guion", () => {
    expect(formatearRut("18456789k")).toBe("18.456.789-K");
    expect(formatearRut("213772856")).toBe("21.377.285-6");
    expect(formatearRut("11.111.111-1")).toBe("11.111.111-1");
  });
});

describe("formatearTelefonoChileno", () => {
  it("formatea teléfonos móviles al estándar +56 9 XXXX XXXX", () => {
    expect(formatearTelefonoChileno("932114494")).toBe("+56 9 3211 4494");
    expect(formatearTelefonoChileno("+56932114494")).toBe("+56 9 3211 4494");
    expect(formatearTelefonoChileno("56932114494")).toBe("+56 9 3211 4494");
    expect(formatearTelefonoChileno("32114494")).toBe("+56 9 3211 4494");
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
