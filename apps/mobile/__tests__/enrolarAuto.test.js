/**
 * Enrolamiento de un auto: que los errores se vean donde están y a tiempo.
 *
 * El problema que estos casos fijan: la patente se validaba solo en el
 * backend, así que una patente mal escrita se descubría al publicar — después
 * de subir ocho fotos y cuatro documentos legales.
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

// Escribe en el input cuyo placeholder coincide. El act() no es decorativo:
// sin él el estado queda pendiente y el press siguiente lee el formulario
// viejo, con lo que el test pasaría por la razón equivocada.
// Se exige onChangeText además del placeholder: los campos con sugerencias
// reciben el placeholder como prop y también aparecerían en la búsqueda, pero
// el que escribe es el TextInput de adentro.
const escribir = (tr, placeholder, texto) => {
  const input = tr.root.findAll(
    (n) => n.props?.placeholder === placeholder && typeof n.props?.onChangeText === "function"
  )[0];
  act(() => input.props.onChangeText(texto));
};

// El placeholder del modelo cambia según si la marca está en el catálogo:
// con una marca conocida se ofrecen sus modelos, si no queda texto libre.
const escribirModelo = (tr, texto) => {
  const input = tr.root.findAll(
    (n) =>
      (n.props?.placeholder === "Elige el modelo" ||
        n.props?.placeholder === "ej. RAV4, Tucson, Swift") &&
      typeof n.props?.onChangeText === "function"
  )[0];
  act(() => input.props.onChangeText(texto));
};

// Toca el mapa, que es como el dueño fija el punto de entrega.
const tocarMapa = (tr, latitude = -37.4712, longitude = -72.3489) => {
  const mapa = tr.root.findAll((n) => typeof n.props?.onPress === "function" && n.props?.initialRegion)[0];
  act(() => mapa.props.onPress({ nativeEvent: { coordinate: { latitude, longitude } } }));
};

const datosBasicos = (tr, { patente = "BBCL-10", marca = "Toyota", modelo = "RAV4" } = {}) => {
  escribir(tr, "Escribe y elige de la lista", marca);
  escribirModelo(tr, modelo);
  escribir(tr, "ABCD-12", patente);
  // El punto de entrega ya no viene pre-rellenado con Plaza de Armas para
  // todos: hay que fijarlo en el mapa y describirlo.
  tocarMapa(tr);
  escribir(tr, "ej. Copec Av. Alemania / Plaza de Armas", "Copec Av. Alemania");
};

describe("Publicar un auto · paso 1", () => {
  it("dice de entrada qué hay que tener a mano", () => {
    // Antes, que hacían falta 8 fotos y el padrón se descubría en los pasos
    // 3 y 4, con el dueño ya metido en el flujo.
    const t = textOf(montar());
    expect(t).toContain("Ten a mano antes de empezar");
    expect(t).toContain("fotos del auto");
    expect(t).toMatch(/Padrón/);
    expect(t).toContain("5 minutos");
  });

  it("no avanza con el formulario vacío y señala cada campo que falta", () => {
    const tr = montar();
    pressText(tr, "Continuar");

    const t = textOf(tr);
    expect(t).toContain("Elige la marca de tu auto.");
    expect(t).toContain("Escribe el modelo");
    expect(t).toContain("Falta la patente.");
    // Sigue en el paso 1.
    expect(t).toContain("Paso 1 de 4");
  });

  it("rechaza una patente con formato inválido antes de pedir fotos", () => {
    const tr = montar();
    escribirModelo(tr, "RAV4");
    escribir(tr, "ABCD-12", "XX-1");
    pressText(tr, "Continuar");

    const t = textOf(tr);
    expect(t).toContain("Revisa el formato");
    expect(t).toContain("Paso 1 de 4");
  });

  it("acepta los dos formatos de patente chilena", () => {
    for (const patente of ["BBCL-10", "AB-12-34"]) {
      const tr = montar();
      datosBasicos(tr, { patente });
      pressText(tr, "Continuar");

      expect(textOf(tr)).toContain("Paso 2 de 4");
    }
  });

  it("no acepta autos anteriores al 2000", () => {
    const tr = montar();
    datosBasicos(tr);
    escribir(tr, "2023", "1998");
    pressText(tr, "Continuar");

    expect(textOf(tr)).toContain("del año 2000 en adelante");
  });

  it("no deja publicar sin fijar el punto en el mapa", () => {
    // Antes el formulario nacía con las coordenadas de Plaza de Armas: todos
    // los autos caían sobre el mismo pin y el mapa dejaba de decir dónde
    // estaba cada uno.
    const tr = montar();
    escribir(tr, "Escribe y elige de la lista", "Toyota");
    escribirModelo(tr, "RAV4");
    escribir(tr, "ABCD-12", "BBCL-10");
    escribir(tr, "ej. Copec Av. Alemania / Plaza de Armas", "Copec Av. Alemania");
    pressText(tr, "Continuar");

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
    // Antes venía pre-rellenado con "Plaza de Armas, Los Ángeles" para todos:
    // el dueño lo dejaba tal cual y el arrendatario iba a un punto que nadie
    // había elegido.
    const tr = montar();
    escribir(tr, "Escribe y elige de la lista", "Toyota");
    escribirModelo(tr, "RAV4");
    escribir(tr, "ABCD-12", "BBCL-10");
    tocarMapa(tr);
    pressText(tr, "Continuar");

    const t = textOf(tr);
    expect(t).toContain("Escribe una referencia del punto de entrega.");
    expect(t).toContain("Paso 1 de 4");
  });

  it("sugiere los modelos de la marca elegida", () => {
    // El catálogo no tenía modelos: cada dueño escribía el suyo y "Grand i10",
    // "grand i 10" y "Grand-i10" quedaban como tres autos distintos.
    const tr = montar();
    escribir(tr, "Escribe y elige de la lista", "Hyundai");
    escribirModelo(tr, "grand");

    expect(textOf(tr)).toContain("Grand i10");
  });

  it("borra el modelo al cambiar de marca", () => {
    // Un Swift no existe en Toyota: dejarlo escrito confunde más que ayudar.
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
    // Un formulario recién abierto no debe estar pintado de rojo.
    const t = textOf(montar());
    expect(t).not.toContain("Falta la patente.");
    expect(t).not.toContain("Elige la marca de tu auto.");
  });
});

describe("Publicar un auto · paso 2", () => {
  const llegarAPaso2 = () => {
    const tr = montar();
    datosBasicos(tr);
    pressText(tr, "Continuar");
    return tr;
  };

  it("exige una tarifa mayor a cero y válida", () => {
    const tr = llegarAPaso2();
    escribir(tr, "ej. 45000", "0");
    pressText(tr, "Continuar");

    const t = textOf(tr);
    expect(t).toContain("La tarifa mínima es de $15.000 CLP");
    expect(t).toContain("Paso 2 de 4");
  });

  it("con una tarifa válida sigue al paso de fotos", () => {
    const tr = llegarAPaso2();
    escribir(tr, "ej. 45000", "45000");
    pressText(tr, "Continuar");

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
    // El backend rechaza igual, pero enterarse después de ocho fotos y cuatro
    // documentos sería la peor forma de descubrirlo.
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
