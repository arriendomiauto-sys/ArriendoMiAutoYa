import { parsearFechaCarnet, calcularEdad, edadDesdeOcr, EDAD_MINIMA_ARRENDATARIO } from "@rentacar/mobile-shared";

const HOY = new Date(2026, 8, 1); // 1 de septiembre de 2026

describe("parsearFechaCarnet", () => {
  it("lee el ISO que devuelve el OCR en modo mock", () => {
    expect(parsearFechaCarnet("1992-05-14")).toEqual(new Date(1992, 4, 14));
  });

  it("lee los formatos impresos en la cédula chilena", () => {
    const esperado = new Date(1992, 4, 14);
    expect(parsearFechaCarnet("14/05/1992")).toEqual(esperado);
    expect(parsearFechaCarnet("14-05-1992")).toEqual(esperado);
    expect(parsearFechaCarnet("14 MAY 1992")).toEqual(esperado);
    expect(parsearFechaCarnet("14 may 1992")).toEqual(esperado);
  });

  it("descarta fechas imposibles o ilegibles", () => {
    expect(parsearFechaCarnet("31/02/1992")).toBeNull();
    expect(parsearFechaCarnet("14/XYZ/1992")).toBeNull();
    expect(parsearFechaCarnet("no legible")).toBeNull();
    expect(parsearFechaCarnet(null)).toBeNull();
    expect(parsearFechaCarnet("")).toBeNull();
  });
});

describe("calcularEdad", () => {
  it("cuenta años cumplidos, no diferencia de años", () => {
    expect(calcularEdad("1992-05-14", HOY)).toBe(34);
    // Cumple el 30 de septiembre: al 1 de septiembre todavía no los cumple.
    expect(calcularEdad("2005-09-30", HOY)).toBe(20);
    // Cumple justo hoy.
    expect(calcularEdad("2005-09-01", HOY)).toBe(21);
  });

  it("devuelve null cuando la fecha leída no es plausible", () => {
    expect(calcularEdad("2025-01-10", HOY)).toBeNull(); // 1 año: leyó otra fecha
    expect(calcularEdad("1850-01-10", HOY)).toBeNull();
    expect(calcularEdad("ilegible", HOY)).toBeNull();
  });
});

describe("edadDesdeOcr", () => {
  it("saca la edad de la respuesta de /enrolamiento/procesar-documentos", () => {
    const edad = edadDesdeOcr({ fecha_nacimiento: "14 MAY 1992", rut_extraido: "18.456.789-K" });
    expect(edad).toBeGreaterThanOrEqual(EDAD_MINIMA_ARRENDATARIO);
  });

  it("no inventa una edad si el OCR no leyó la fecha", () => {
    expect(edadDesdeOcr({ rut_extraido: "18.456.789-K" })).toBeNull();
    expect(edadDesdeOcr(null)).toBeNull();
  });
});
