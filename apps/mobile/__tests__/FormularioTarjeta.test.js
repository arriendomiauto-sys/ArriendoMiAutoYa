/**
 * Formulario de tarjeta de crédito.
 *
 * Se pide dentro del KYC porque sin tarjeta validada no se puede arrendar ni
 * publicar un auto. Validar acá el número con Luhn evita gastarle al usuario
 * un intento contra la pasarela por un dígito mal tecleado.
 */
import {
  numeroTarjetaValido,
  vencimientoValido,
  detectarMarca,
  validarFormularioTarjeta,
  tokenizarTarjeta,
} from "@rentacar/mobile-shared/components/FormularioTarjeta";

describe("Número de tarjeta", () => {
  it("acepta números válidos de las marcas que circulan en Chile", () => {
    expect(numeroTarjetaValido("4242 4242 4242 4242")).toBe(true); // Visa
    expect(numeroTarjetaValido("5555 5555 5555 4444")).toBe(true); // Mastercard
    expect(numeroTarjetaValido("3782 822463 10005")).toBe(true); // Amex
  });

  it("rechaza un número con un dígito cambiado", () => {
    expect(numeroTarjetaValido("4242 4242 4242 4243")).toBe(false);
  });

  it("rechaza números demasiado cortos o largos", () => {
    expect(numeroTarjetaValido("4242")).toBe(false);
    expect(numeroTarjetaValido("4242424242424242424242")).toBe(false);
  });

  it("reconoce la marca por el prefijo", () => {
    expect(detectarMarca("4242 4242 4242 4242")).toBe("visa");
    expect(detectarMarca("5555 5555 5555 4444")).toBe("mastercard");
    expect(detectarMarca("3782 822463 10005")).toBe("amex");
    expect(detectarMarca("9999 9999 9999 9999")).toBe("otra");
  });
});

describe("Vencimiento", () => {
  const hoy = new Date(2026, 8, 3); // septiembre de 2026

  it("acepta una fecha futura en formato MM/AA", () => {
    expect(vencimientoValido("12/28", hoy)).toBe(true);
  });

  it("acepta el mes en curso: la tarjeta vence al final del mes", () => {
    expect(vencimientoValido("09/26", hoy)).toBe(true);
  });

  it("rechaza una tarjeta vencida", () => {
    expect(vencimientoValido("08/26", hoy)).toBe(false);
  });

  it("rechaza un mes que no existe o un formato raro", () => {
    expect(vencimientoValido("13/28", hoy)).toBe(false);
    expect(vencimientoValido("2028-12", hoy)).toBe(false);
  });
});

describe("Validación del formulario", () => {
  const valida = {
    numero: "4242 4242 4242 4242",
    vencimiento: "12/30",
    cvv: "123",
    nombre: "Ana Soto",
  };

  it("una tarjeta completa y correcta no deja errores", () => {
    expect(validarFormularioTarjeta(valida)).toEqual({});
  });

  it("señala cada campo que falta por separado", () => {
    const e = validarFormularioTarjeta({ numero: "", vencimiento: "", cvv: "" });
    expect(e.numero).toBeTruthy();
    expect(e.vencimiento).toBeTruthy();
    expect(e.cvv).toBeTruthy();
  });

  it("un código de seguridad de menos de 3 dígitos no pasa", () => {
    expect(validarFormularioTarjeta({ ...valida, cvv: "12" }).cvv).toBeTruthy();
  });
});

describe("Tokenización", () => {
  it("al backend solo viajan el token, los últimos 4 y la marca", () => {
    const datos = tokenizarTarjeta({ numero: "4242 4242 4242 4242", nombre: "Ana Soto" });

    expect(datos.tarjeta_ultimos4).toBe("4242");
    expect(datos.tarjeta_marca).toBe("visa");
    expect(datos.tarjeta_token).toBeTruthy();

    // El número completo no puede salir del teléfono por ningún campo.
    const serializado = JSON.stringify(datos);
    expect(serializado).not.toContain("4242424242424242");
  });
});
