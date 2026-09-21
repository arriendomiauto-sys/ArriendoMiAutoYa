import { traducirErrorAuth, esErrorCredenciales } from "@rentacar/mobile-shared";

describe("traducirErrorAuth", () => {
  it("traduce credenciales inválidas", () => {
    expect(traducirErrorAuth({ message: "Invalid login credentials" })).toMatch(
      /correo o la contraseña/i
    );
  });

  it("traduce correo ya registrado", () => {
    expect(traducirErrorAuth("User already registered")).toMatch(/ya existe una cuenta/i);
  });

  it("traduce errores de red", () => {
    expect(traducirErrorAuth({ message: "Network request failed" })).toMatch(
      /no se pudo conectar/i
    );
  });

  it("da un mensaje genérico para lo desconocido, sin filtrar el error crudo", () => {
    const out = traducirErrorAuth({ message: "SomeInternalError: stack trace 0xDEAD" });
    expect(out).not.toMatch(/0xDEAD/);
    expect(out).toMatch(/intenta de nuevo/i);
  });

  it("no explota con entrada vacía", () => {
    expect(typeof traducirErrorAuth(undefined)).toBe("string");
    expect(typeof traducirErrorAuth("")).toBe("string");
  });
});

describe("esErrorCredenciales", () => {
  it("reconoce el rechazo de correo/contraseña de Supabase, venga como Error o como texto", () => {
    expect(esErrorCredenciales(new Error("Invalid login credentials"))).toBe(true);
    expect(esErrorCredenciales("invalid login credentials")).toBe(true);
  });

  it.each([
    ["sin conexión", new Error("Network request failed")],
    ["correo sin confirmar", new Error("Email not confirmed")],
    ["límite de intentos", new Error("Request rate limit reached")],
    ["error desconocido", new Error("boom")],
  ])("no marca como credenciales un error de %s", (_caso, err) => {
    expect(esErrorCredenciales(err)).toBe(false);
  });

  it("no explota con entrada vacía", () => {
    expect(esErrorCredenciales(undefined)).toBe(false);
    expect(esErrorCredenciales(null)).toBe(false);
  });
});
