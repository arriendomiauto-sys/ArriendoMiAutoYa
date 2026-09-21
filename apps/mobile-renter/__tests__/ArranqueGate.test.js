import React from "react";
import { Text } from "react-native";
import { act } from "react-test-renderer";
import { ArranqueGate, Icon } from "@rentacar/mobile-shared";
import { renderTree, textOf, pressText } from "../test-utils";

const mockApp = { authLoading: true, sesionEstado: "revisando", reintentarSesion: jest.fn() };

jest.mock("@rentacar/mobile-shared/context/AppContext", () => ({
  useApp: () => mockApp,
}));

const Contenido = () => <Text>contenido de la app</Text>;
const gate = (props) => (
  <ArranqueGate {...props}>
    <Contenido />
  </ArranqueGate>
);

const avanzar = (ms) =>
  act(async () => {
    jest.advanceTimersByTime(ms);
  });

describe("Icon · glifo de la pantalla 'Sin conexión'", () => {
  it("'wifi-off' tiene dibujo propio, no el círculo genérico", () => {
    const propio = renderTree(<Icon name="wifi-off" />).toJSON();
    const generico = renderTree(<Icon name="no-existe" />).toJSON();
    expect(propio).not.toEqual(generico);
  });
});

describe("ArranqueGate", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    Object.assign(mockApp, { authLoading: true, sesionEstado: "revisando" });
    mockApp.reintentarSesion.mockReset();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it("mientras revisa la sesión muestra la marca y qué está pasando, no la app", () => {
    const tr = renderTree(gate());
    const t = textOf(tr);
    expect(t).toContain("Arriendo Mi Auto Ya");
    expect(t).toContain("Revisando tu sesión");
    expect(t).not.toContain("contenido de la app");
  });

  it("se anuncia como una carga en curso para los lectores de pantalla", () => {
    const tr = renderTree(gate());
    const carga = tr.root.findAll(
      (n) => n.props?.accessibilityRole === "progressbar" && n.props?.accessibilityLabel === "Revisando tu sesión"
    );
    expect(carga.length).toBeGreaterThan(0);
  });

  it("aunque la sesión responda al instante, la carga se ve 0,9 s para que no parpadee", async () => {
    Object.assign(mockApp, { authLoading: false, sesionEstado: "listo" });
    const tr = renderTree(gate());

    await avanzar(899);
    expect(textOf(tr)).not.toContain("contenido de la app");

    await avanzar(1);
    expect(textOf(tr)).toContain("contenido de la app");
    expect(textOf(tr)).not.toContain("Revisando tu sesión");
  });

  it("si la revisión tarda más de 0,9 s, la carga sigue hasta que termine", async () => {
    const tr = renderTree(gate());
    await avanzar(5000);
    expect(textOf(tr)).toContain("Revisando tu sesión");

    Object.assign(mockApp, { authLoading: false, sesionEstado: "listo" });
    act(() => tr.update(gate()));
    expect(textOf(tr)).toContain("contenido de la app");
  });

  it("sin conexión: lo dice, aclara que la cuenta sigue guardada y NO muestra la app ni el login", async () => {
    Object.assign(mockApp, { authLoading: false, sesionEstado: "sin_conexion" });
    const tr = renderTree(gate());
    const t = textOf(tr);
    expect(t).toContain("Sin conexión");
    expect(t).toContain("Tu cuenta sigue guardada en este teléfono");
    expect(t).toContain("Reintentar");
    expect(t).not.toContain("contenido de la app");
  });

  it("'Reintentar' vuelve a pedir la revisión de la sesión", () => {
    Object.assign(mockApp, { authLoading: false, sesionEstado: "sin_conexion" });
    const tr = renderTree(gate());
    pressText(tr, "Reintentar");
    expect(mockApp.reintentarSesion).toHaveBeenCalledTimes(1);
  });

  it("tras reintentar vuelve a la carga y, si ahora hay red, entra a la app", async () => {
    Object.assign(mockApp, { authLoading: false, sesionEstado: "sin_conexion" });
    const tr = renderTree(gate());

    Object.assign(mockApp, { authLoading: true, sesionEstado: "revisando" });
    act(() => tr.update(gate()));
    expect(textOf(tr)).toContain("Revisando tu sesión");

    Object.assign(mockApp, { authLoading: false, sesionEstado: "listo" });
    await avanzar(900);
    act(() => tr.update(gate()));
    expect(textOf(tr)).toContain("contenido de la app");
  });

  it("la versión de arrendatario no dice 'Para dueños'", () => {
    const t = textOf(renderTree(gate({ variante: "renter" })));
    expect(t).toContain("Autos entre personas, cerca de ti");
    expect(t).not.toContain("Para dueños");
  });

  it("la versión de dueño suma 'Para dueños' y su propio eslogan", () => {
    const t = textOf(renderTree(gate({ variante: "owner" })));
    expect(t).toContain("Tu auto, trabajando por ti");
    expect(t).toContain("Para dueños");
  });
});
