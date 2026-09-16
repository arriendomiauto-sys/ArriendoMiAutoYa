import { urlWeb, baseWebUrl, WEB_URL_PRODUCCION } from "@rentacar/mobile-shared";

// El correo de recuperación de clave se abre en el navegador del usuario:
// si el enlace apunta a localhost o a la IP de la LAN del desarrollador, el
// usuario no puede cambiar su contraseña. Estos casos cubren esa regla.
describe("urlWeb", () => {
  const original = process.env.EXPO_PUBLIC_WEB_URL;

  afterEach(() => {
    process.env.EXPO_PUBLIC_WEB_URL = original;
  });

  const conWebUrl = (valor) => {
    if (valor === undefined) delete process.env.EXPO_PUBLIC_WEB_URL;
    else process.env.EXPO_PUBLIC_WEB_URL = valor;
  };

  it("usa el dominio de producción cuando no hay EXPO_PUBLIC_WEB_URL", () => {
    conWebUrl(undefined);
    expect(urlWeb("restablecer-contrasena")).toBe(`${WEB_URL_PRODUCCION}/restablecer-contrasena`);
  });

  it.each([
    "http://localhost:3000",
    "https://localhost:3000",
    "http://127.0.0.1:3000",
    "https://192.168.1.42:3000",
    "https://10.0.0.5:8081",
    "https://mac-de-dev.local:3000",
    "exp://192.168.1.42:19000",
  ])("ignora %s y cae al dominio público", (valor) => {
    conWebUrl(valor);
    expect(urlWeb("restablecer-contrasena")).toBe(`${WEB_URL_PRODUCCION}/restablecer-contrasena`);
  });

  it("respeta un dominio público configurado", () => {
    conWebUrl("https://staging.arriendomiautoya.cl");
    expect(urlWeb("restablecer-contrasena")).toBe("https://staging.arriendomiautoya.cl/restablecer-contrasena");
  });

  it("no duplica la barra cuando el dominio viene con barra final", () => {
    conWebUrl("https://www.arriendomiautoya.cl/");
    expect(urlWeb("restablecer-contrasena")).toBe("https://www.arriendomiautoya.cl/restablecer-contrasena");
    expect(urlWeb("/restablecer-contrasena")).toBe("https://www.arriendomiautoya.cl/restablecer-contrasena");
  });

  it("devuelve solo el dominio cuando no se pide ruta", () => {
    conWebUrl("https://arriendomiautoya.cl/");
    expect(baseWebUrl()).toBe("https://arriendomiautoya.cl");
    expect(urlWeb()).toBe("https://arriendomiautoya.cl");
  });
});
