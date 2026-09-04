import React from "react";
import { TextInput } from "react-native";
import { act } from "react-test-renderer";
import { FOTOS_AUTO, TOTAL_FOTOS_AUTO } from "@rentacar/mobile-shared";
import { AddEditCarScreen } from "../src/owner/screens/AddEditCarScreen";
import { renderTree, textOf, pressText } from "../test-utils";

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
// La pantalla lee del contexto el estado de la tarjeta: sin tarjeta validada
// no deja publicar. Acá se simula un dueño ya habilitado.
jest.mock("@rentacar/mobile-shared/context/AppContext", () => ({
  useApp: () => ({ currentUser: { tarjeta_estado: "validada" } }),
}));

jest.mock("expo-camera", () => ({
  CameraView: "CameraView",
  useCameraPermissions: () => [{ granted: true }, jest.fn()],
}));

describe("FOTOS_AUTO", () => {
  it("define las 9 tomas del enrolamiento", () => {
    expect(TOTAL_FOTOS_AUTO).toBe(9);
    expect(FOTOS_AUTO).toHaveLength(9);
  });

  it("cubre los cuatro costados, tres del interior, el panel y la limpieza", () => {
    const keys = FOTOS_AUTO.map((s) => s.key);
    expect(keys).toEqual([
      "frontal",
      "trasera",
      "lateral_izquierdo",
      "lateral_derecho",
      "interior_delantero",
      "interior_trasero",
      "maletero",
      "tablero",
      "limpieza",
    ]);
  });

  it("marca para censura solo las tomas donde sale la patente", () => {
    const conPatente = FOTOS_AUTO.filter((s) => s.camara?.censurarPatente).map((s) => s.key);
    expect(conPatente).toEqual(["frontal", "trasera"]);
  });

  it("cada toma trae título, ayuda y guía de cámara", () => {
    FOTOS_AUTO.forEach((slot) => {
      expect(slot.titulo).toBeTruthy();
      expect(slot.ayuda).toBeTruthy();
      expect(slot.camara?.titulo).toBeTruthy();
      expect(slot.camara?.hint).toBeTruthy();
    });
  });
});

describe("AddEditCarScreen · paso de fotos", () => {
  const escribir = (tr, placeholder, valor) => {
    const input = tr.root
      .findAllByType(TextInput)
      .find((n) => n.props.placeholder === placeholder);
    act(() => input.props.onChangeText(valor));
  };

  const irAFotos = () => {
    const tr = renderTree(<AddEditCarScreen onBack={() => {}} onComplete={() => {}} />);
    escribir(tr, "Escribe y elige de la lista", "Toyota");
    // Con una marca del catálogo el campo de modelo ofrece sus modelos, así
    // que el placeholder deja de ser el de texto libre.
    escribir(tr, "Elige el modelo", "Yaris");
    escribir(tr, "ABCD-12", "BBCL-10");
    // El punto de entrega ya no viene pre-rellenado: hay que fijarlo.
    const mapa = tr.root.findAll(
      (n) => typeof n.props?.onPress === "function" && n.props?.initialRegion
    )[0];
    act(() => mapa.props.onPress({ nativeEvent: { coordinate: { latitude: -37.47, longitude: -72.35 } } }));
    escribir(tr, "ej. Copec Av. Alemania / Plaza de Armas", "Copec Av. Alemania");
    pressText(tr, "Continuar"); // paso 1 -> 2
    pressText(tr, "Continuar"); // paso 2 -> 3
    return tr;
  };

  it("pide las 9 fotos con una casilla guiada cada una", () => {
    const t = textOf(irAFotos());
    FOTOS_AUTO.forEach((slot) => expect(t).toContain(slot.titulo));
    expect(t).toContain(`0 de ${TOTAL_FOTOS_AUTO} fotos`);
  });

  it("avisa que la patente se tapa antes de publicar", () => {
    expect(textOf(irAFotos())).toContain("tapamos la patente");
  });

  it("no deja avanzar a documentos sin las fotos", () => {
    const tr = irAFotos();
    pressText(tr, "Continuar");
    // Sigue en el paso de fotos: los documentos no aparecieron.
    expect(textOf(tr)).not.toContain("Documentos del vehiculo");
  });
});
