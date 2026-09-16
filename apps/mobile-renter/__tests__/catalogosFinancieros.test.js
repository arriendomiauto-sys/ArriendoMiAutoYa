/**
 * Bancos y tipos de cuenta del formulario de cuenta bancaria del dueño.
 *
 * "Banco" y "tipo de cuenta" eran texto libre: un dueño escribía
 * "bco estado" y otro "BancoEstado", y soporte tenía que descifrar a mano a
 * cuál banco correspondía cada transferencia manual.
 */
import {
  BANCOS_CHILE,
  TIPOS_CUENTA_CHILE,
  buscarBancos,
  esBancoConocido,
} from "@rentacar/mobile-shared/data/catalogosFinancieros";

describe("Catálogo financiero", () => {
  it("prioriza los bancos que empiezan con lo escrito", () => {
    // Escribiendo "banco" debe salir primero uno que empieza así, no uno que
    // solo contiene la palabra en otra parte del nombre.
    expect(buscarBancos("banco")[0].toLowerCase().startsWith("banco")).toBe(true);
  });

  it("sin texto devuelve todos los bancos", () => {
    expect(buscarBancos("").length).toBe(BANCOS_CHILE.length);
  });

  it("encuentra un banco sin importar mayúsculas", () => {
    expect(buscarBancos("SANTANDER")).toContain("Banco Santander Chile");
  });

  it("reconoce un banco del catálogo sin importar mayúsculas ni espacios extra", () => {
    expect(esBancoConocido("banco estado")).toBe(true);
    expect(esBancoConocido("  Banco Estado  ")).toBe(true);
    expect(esBancoConocido("Banco Que No Existe")).toBe(false);
  });

  it("trae los cuatro tipos de cuenta oficiales, sin variantes libres", () => {
    // Son cuatro y se eligen, no se escriben: evita "corriente", "Cta Cte" o
    // "CC" para lo mismo.
    expect(TIPOS_CUENTA_CHILE).toEqual([
      "Cuenta Corriente",
      "Cuenta Vista",
      "Cuenta RUT",
      "Cuenta de Ahorro",
    ]);
  });

  it("incluye los bancos con más operación retail en Chile", () => {
    ["Banco Estado", "Banco de Chile", "BCI", "Banco Santander Chile", "Coopeuch"].forEach((banco) => {
      expect(BANCOS_CHILE).toContain(banco);
    });
  });
});
