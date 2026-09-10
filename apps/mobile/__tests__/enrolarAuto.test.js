/**
 * Asistente para publicar un auto (carpeta `src/owner/screens/addcar/`): que
 * los errores se vean donde están y a tiempo, y que la tarifa siga la regla
 * de negocio (parte del precio de categoría y solo se puede bajar).
 *
 * El problema original: la patente se validaba solo en el backend, así que
 * una patente mal escrita se descubría al publicar — después de subir nueve
 * fotos y cinco documentos.
 */
import React from "react";
import { act } from "react-test-renderer";
import { AddEditCarScreen } from "../src/owner/screens/AddEditCarScreen";
import { renderTree, textOf, pressText } from "../test-utils";

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

// La pantalla lee del contexto el estado de la tarjeta: sin tarjeta validada
// no deja publicar. El mock se iza sobre el archivo, así que lee de esta
// variable para que cada test pueda cambiar el estado.
const mockUsuario = { valor: { tarjeta_estado: "validada" } };
jest.mock("@rentacar/mobile-shared/context/AppContext", () => ({
  useApp: () => ({ currentUser: mockUsuario.valor }),
}));

const montar = () => renderTree(<AddEditCarScreen onBack={() => {}} onComplete={() => {}} />);

const escribir = (tr, placeholder, texto) => {
  const input = tr.root.findAll(
    (n) => n.props?.placeholder === placeholder && typeof n.props?.onChangeText === "function"
  )[0];
  act(() => input.props.onChangeText(texto));
};

const escribirModelo = (tr, texto) => {
  const input = tr.root.findAll(
    (n) =>
      (n.props?.placeholder === "Elige el modelo" ||
        n.props?.placeholder === "ej. RAV4, Tucson, Swift") &&
      typeof n.props?.onChangeText === "function"
  )[0];
  act(() => input.props.onChangeText(texto));
};

const tocarMapa = (tr, latitude = -37.4712, longitude = -72.3489) => {
  const mapa = tr.root.findAll((n) => typeof n.props?.onPress === "function" && n.props?.initialRegion)[0];
  act(() => mapa.props.onPress({ nativeEvent: { coordinate: { latitude, longitude } } }));
};

const pressA11y = (tr, label) => {
  const node = tr.root.findAll(
    (n) => n.props?.accessibilityLabel === label && typeof n.props?.onPress === "function"
  )[0];
  if (!node) throw new Error(`No hay control con accessibilityLabel "${label}"`);
  if (node.props.disabled === true || node.props.accessibilityState?.disabled === true) return;
  act(() => node.props.onPress());
};

const datosBasicos = (tr, { patente = "BBCL-10", marca = "Toyota", modelo = "RAV4" } = {}) => {
  escribir(tr, "Escribe y elige de la lista", marca);
  escribirModelo(tr, modelo);
  escribir(tr, "ABCD-12", patente);
  tocarMapa(tr);
  escribir(tr, "Av. Alemania 6370, Temuco, Araucanía", "Av. Alemania 6370, Temuco, Araucanía");
};

const irAPaso2 = () => {
  const tr = montar();
  datosBasicos(tr);
  pressText(tr, "Siguiente: tarifa");
  return tr;
};

describe("Publicar un auto · paso 1 (el auto)", () => {
  it("dice de entrada qué hay que tener a mano", () => {
    const t = textOf(montar());
    expect(t).toContain("Ten a mano antes de empezar");
    expect(t).toContain("fotos del auto");
    expect(t).toMatch(/Padrón/);
    expect(t).toContain("5 minutos");
  });

  it("no avanza con el formulario vacío y señala cada campo que falta", () => {
    const tr = montar();
    pressText(tr, "Siguiente: tarifa");

    const t = textOf(tr);
    expect(t).toContain("Elige la marca de tu auto.");
    expect(t).toContain("Escribe el modelo");
    expect(t).toContain("Falta la patente.");
    expect(t).toContain("Paso 1 de 4");
  });

  it("rechaza una patente con formato inválido antes de pedir fotos", () => {
    const tr = montar();
    escribirModelo(tr, "RAV4");
    escribir(tr, "ABCD-12", "XX-1");
    pressText(tr, "Siguiente: tarifa");

    const t = textOf(tr);
    expect(t).toContain("Revisa el formato");
    expect(t).toContain("Paso 1 de 4");
  });

  it("acepta los dos formatos de patente chilena", () => {
    for (const patente of ["BBCL-10", "AB-12-34"]) {
      const tr = montar();
      datosBasicos(tr, { patente });
      pressText(tr, "Siguiente: tarifa");
      expect(textOf(tr)).toContain("Paso 2 de 4");
    }
  });

  it("no acepta autos anteriores al 2000", () => {
    const tr = montar();
    datosBasicos(tr);
    escribir(tr, "2023", "1998");
    pressText(tr, "Siguiente: tarifa");
    expect(textOf(tr)).toContain("del año 2000 en adelante");
  });

  it("no deja avanzar sin fijar el punto en el mapa", () => {
    const tr = montar();
    escribir(tr, "Escribe y elige de la lista", "Toyota");
    escribirModelo(tr, "RAV4");
    escribir(tr, "ABCD-12", "BBCL-10");
    escribir(tr, "Av. Alemania 6370, Temuco, Araucanía", "Av. Alemania 6370, Temuco, Araucanía");
    pressText(tr, "Siguiente: tarifa");

    const t = textOf(tr);
    expect(t).toContain("Fija el punto en el mapa");
    expect(t).toContain("Paso 1 de 4");
  });

  it("al tocar el mapa muestra las coordenadas fijadas", () => {
    const tr = montar();
    tocarMapa(tr, -37.4712, -72.3489);
    expect(textOf(tr)).toContain("-37.47120, -72.34890");
  });

  it("exige una referencia del punto de entrega", () => {
    const tr = montar();
    escribir(tr, "Escribe y elige de la lista", "Toyota");
    escribirModelo(tr, "RAV4");
    escribir(tr, "ABCD-12", "BBCL-10");
    tocarMapa(tr);
    pressText(tr, "Siguiente: tarifa");

    const t = textOf(tr);
    expect(t).toContain("Escribe una referencia del punto de entrega.");
    expect(t).toContain("Paso 1 de 4");
  });

  it("sugiere los modelos de la marca elegida", () => {
    const tr = montar();
    escribir(tr, "Escribe y elige de la lista", "Hyundai");
    escribirModelo(tr, "grand");
    expect(textOf(tr)).toContain("Grand i10");
  });

  it("borra el modelo al cambiar de marca", () => {
    const tr = montar();
    escribir(tr, "Escribe y elige de la lista", "Suzuki");
    escribirModelo(tr, "Swift");
    escribir(tr, "Escribe y elige de la lista", "Toyota");

    const modelo = tr.root.findAll(
      (n) => n.props?.placeholder === "Elige el modelo" && typeof n.props?.onChangeText === "function"
    )[0];
    expect(modelo.props.value).toBe("");
  });

  it("no marca errores antes de que el usuario intente avanzar", () => {
    const t = textOf(montar());
    expect(t).not.toContain("Falta la patente.");
    expect(t).not.toContain("Elige la marca de tu auto.");
  });
});

describe("Publicar un auto · paso 2 (categoría y tarifa)", () => {
  it("parte del precio de categoría fijado por la plataforma", () => {
    const t = textOf(irAPaso2());
    expect(t).toContain("Paso 2 de 4");
    expect(t).toContain("Fijado por RentACar");
    // Sedán por defecto: precio base $55.000.
    expect(t).toContain("$55.000");
  });

  it("deja bajar la tarifa de a $5.000 pero no subirla del precio base", () => {
    const tr = irAPaso2();
    // En el tope, subir está deshabilitado (no cambia nada).
    pressA11y(tr, "Subir la tarifa cinco mil pesos");
    expect(textOf(tr)).toContain("$55.000");
    // Bajar sí funciona.
    pressA11y(tr, "Bajar la tarifa cinco mil pesos");
    expect(textOf(tr)).toContain("$50.000");
  });

  it("con la tarifa elegida sigue al paso de fotos", () => {
    const tr = irAPaso2();
    pressText(tr, "Siguiente: fotos");
    expect(textOf(tr)).toContain("Paso 3 de 4");
  });
});

describe("Publicar un auto · tarjeta requerida", () => {
  const conTarjeta = (estado) => {
    mockUsuario.valor = { tarjeta_estado: estado };
    return montar();
  };

  afterEach(() => {
    mockUsuario.valor = { tarjeta_estado: "validada" };
  });

  it("sin tarjeta no deja entrar al asistente y dice qué hacer", () => {
    const t = textOf(conTarjeta("pendiente"));
    expect(t).toContain("Primero registra tu tarjeta");
    expect(t).toContain("Métodos de pago");
    expect(t).not.toContain("Ten a mano antes de empezar");
  });

  it("con la tarjeta en revisión lo explica en vez de culpar al usuario", () => {
    const t = textOf(conTarjeta("requiere_revision_manual"));
    expect(t).toContain("Estamos revisando tu tarjeta");
    expect(t).toContain("Te avisamos");
  });

  it("con la tarjeta rechazada ofrece registrar otra", () => {
    const t = textOf(conTarjeta("rechazada"));
    expect(t).toContain("Registra otra");
  });
});
