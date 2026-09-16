import { msjError } from "@rentacar/mobile-shared";

describe("msjError", () => {
  it("mantiene mensajes del backend en español", () => {
    expect(msjError({ message: "La reserva ya fue cancelada." })).toMatch(/ya fue cancelada/i);
  });

  it("traduce un 5xx / Error en la solicitud a mensaje de servidor", () => {
    expect(msjError({ status: 500, message: "Internal Server Error" })).toMatch(
      /servidor está con problemas/i
    );
    expect(msjError({ message: "Error en la solicitud: 503" })).toMatch(
      /servidor está con problemas/i
    );
  });

  it("traduce 429 y 401 a acciones concretas", () => {
    expect(msjError({ status: 429, message: "Too Many Requests" })).toMatch(
      /demasiadas peticiones/i
    );
    expect(msjError({ status: 401, message: "Unauthorized" })).toMatch(/sesión expiró/i);
  });

  it("usa mensaje fijo de conexión y no filtra la URL interna", () => {
    const out = msjError({
      esFalloDeConexion: true,
      message: "No se pudo conectar con el servidor (https://internal/api/v1).",
    });
    expect(out).not.toMatch(/internal/i);
    expect(out).toMatch(/no se pudo conectar/i);
  });

  it("limpia prefijos de librería y deja el mensaje humano", () => {
    expect(msjError({ message: "AuthApiError: El correo ya existe" })).toMatch(/el correo ya existe/i);
  });

  it("cae al fallback para lo desconocido, sin filtrar pila interna", () => {
    const out = msjError({ message: "SomeInternalError: stack trace 0xDEAD" });
    expect(out).not.toMatch(/0xDEAD/);
    expect(out).toMatch(/intenta de nuevo/i);
  });

  it("no explota con entrada vacía y respeta el fallback pedido", () => {
    expect(typeof msjError(undefined)).toBe("string");
    expect(msjError(null, "Mensaje custom.")).toBe("Mensaje custom.");
    expect(msjError({}, "Mensaje custom.")).toBe("Mensaje custom.");
  });
});