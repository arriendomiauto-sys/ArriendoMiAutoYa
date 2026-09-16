import {
  formatearRutEnVivo,
  formatearTelefonoInput,
  normalizarTelefonoCompleto,
  extraerMovilSinPrefijo,
} from "@rentacar/mobile-shared/utils/formato";

describe("formato.js - Utilidades de formateo frontend", () => {
  describe("formatearRutEnVivo", () => {
    it("formatea RUTs progresivamente y con DV", () => {
      expect(formatearRutEnVivo("2")).toBe("2");
      expect(formatearRutEnVivo("21")).toBe("2-1");
      expect(formatearRutEnVivo("213")).toBe("21-3");
      expect(formatearRutEnVivo("213772856")).toBe("21.377.285-6");
      expect(formatearRutEnVivo("18456789k")).toBe("18.456.789-K");
      expect(formatearRutEnVivo("11.111.111-1")).toBe("11.111.111-1");
      expect(formatearRutEnVivo("")).toBe("");
      expect(formatearRutEnVivo(null)).toBe("");
    });

    it("capa a 9 caracteres: pegar o spamear de más no explota el RUT", () => {
      expect(formatearRutEnVivo("21377285600000000")).toBe("21.377.285-6");
      expect(formatearRutEnVivo("999999999999999")).toBe("99.999.999-9");
      expect(formatearRutEnVivo("18.456.789-K y algo más")).toBe("18.456.789-K");
    });
  });

  describe("formatearTelefonoInput", () => {
    it("formatea los 8 dígitos móviles en bloques de 4", () => {
      expect(formatearTelefonoInput("3211")).toBe("3211");
      expect(formatearTelefonoInput("32114494")).toBe("3211 4494");
      expect(formatearTelefonoInput("932114494")).toBe("3211 4494");
      expect(formatearTelefonoInput("+56 9 3211 4494")).toBe("3211 4494");
      expect(formatearTelefonoInput("56932114494")).toBe("3211 4494");
      expect(formatearTelefonoInput("")).toBe("");
    });
  });

  describe("normalizarTelefonoCompleto", () => {
    it("genera siempre el formato completo +56 9 XXXX XXXX", () => {
      expect(normalizarTelefonoCompleto("932114494")).toBe("+56 9 3211 4494");
      expect(normalizarTelefonoCompleto("32114494")).toBe("+56 9 3211 4494");
      expect(normalizarTelefonoCompleto("+56932114494")).toBe("+56 9 3211 4494");
      expect(normalizarTelefonoCompleto("+56 9 3211 4494")).toBe("+56 9 3211 4494");
      expect(normalizarTelefonoCompleto("56978567856")).toBe("+56 9 7856 7856");
      expect(normalizarTelefonoCompleto("")).toBe("");
    });
  });

  describe("extraerMovilSinPrefijo", () => {
    it("extrae los dígitos para mostrar en un campo con prefijo fijo", () => {
      expect(extraerMovilSinPrefijo("+56 9 3211 4494")).toBe("3211 4494");
      expect(extraerMovilSinPrefijo("+56932114494")).toBe("3211 4494");
      expect(extraerMovilSinPrefijo("932114494")).toBe("3211 4494");
      expect(extraerMovilSinPrefijo(null)).toBe("");
    });
  });
});
