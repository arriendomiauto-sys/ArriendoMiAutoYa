/**
 * Firma digital del contrato en la entrega: antes solo había una pantalla
 * de "pásale el teléfono" con un botón que firmaba solo con tocarlo, sin
 * capturar ningún trazo. Ahora un SignaturePad real bloquea el botón hasta
 * que efectivamente se dibuja algo.
 */
import React from "react";
import { act } from "react-test-renderer";
import { DeliveryScreen } from "@rentacar/mobile-shared/screens/DeliveryScreen";
import { SignaturePad } from "@rentacar/mobile-shared/components/SignaturePad";
import { renderTree, textOf, pressText } from "../test-utils";

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

const mockValidarCodigoQR = jest.fn();
const mockConfirmarVerificacion = jest.fn();
const mockRegistrarChecklist = jest.fn();
jest.mock("@rentacar/mobile-shared/api/client", () => {
  const real = jest.requireActual("@rentacar/mobile-shared/api/client");
  return {
    ApiClient: {
      ...real.ApiClient,
      validarCodigoQR: (...a) => mockValidarCodigoQR(...a),
      confirmarVerificacionIdentidad: (...a) => mockConfirmarVerificacion(...a),
      registrarChecklist: (...a) => mockRegistrarChecklist(...a),
    },
  };
});

const mockElegirImagen = jest.fn(() => Promise.resolve("file://foto-local.jpg"));
const mockSubirImagenOptimizada = jest.fn(() => Promise.resolve("https://cdn.example/foto1.jpg"));
jest.mock("@rentacar/mobile-shared/utils/imagenes", () => ({
  elegirImagen: (...a) => mockElegirImagen(...a),
  subirImagenOptimizada: (...a) => mockSubirImagenOptimizada(...a),
}));

const asentar = () => new Promise((resolve) => setTimeout(resolve, 0));

const presionarYAsentar = async (tr, needle) => {
  await act(async () => {
    pressText(tr, needle);
    await asentar();
  });
};

const presionarBoton = async (tr, label) => {
  await act(async () => {
    const boton = tr.root.findAll(
      (n) => n.props?.accessibilityRole === "button" && n.props?.accessibilityLabel === label
    )[0];
    boton.props.onPress();
    await asentar();
  });
};

const reserva = {
  id: "res-1",
  estado: "confirmada",
  lugar_entrega_acordado: "Plaza de Armas",
  auto: { marca: "Kia", modelo: "Rio", anio: 2022, patente: "ABCD12" },
};

let arbolActual = null;

beforeEach(async () => {
  // Los tests reusan la misma reserva ("res-1"): sin esto, la cola de fotos
  // guardada por un test queda en el mock de AsyncStorage (a nivel de
  // módulo) y el siguiente test la restaura al montar.
  const AsyncStorage = require("@react-native-async-storage/async-storage");
  await (AsyncStorage.default || AsyncStorage).clear();
});

afterEach(async () => {
  await act(async () => {
    await asentar();
  });
  if (arbolActual) arbolActual.unmount();
  arbolActual = null;
});

const llegarALaFirma = async () => {
  mockValidarCodigoQR.mockResolvedValue({
    reserva_id: "res-1",
    cliente_nombre: "Juan Pérez",
    auto_marca: "Kia",
    auto_modelo: "Rio",
    auto_patente: "ABCD12",
    lugar_entrega_acordado: "Plaza de Armas",
  });
  mockConfirmarVerificacion.mockResolvedValue({ siguiente_paso: "checklist_fotos" });

  const tr = renderTree(<DeliveryScreen reserva={reserva} onBack={() => {}} onCompleteDelivery={() => {}} />);
  arbolActual = tr;

  const inputCodigo = tr.root.findAll(
    (n) => n.props?.placeholder === "Código mostrado en el celular del cliente"
  )[0];
  act(() => inputCodigo.props.onChangeText("COD-123"));
  await presionarYAsentar(tr, "Validar código");
  await presionarBoton(tr, "Confirmar identidad");

  await act(async () => {
    const shutter = tr.root.findAll(
      (n) => n.props?.accessibilityRole === "button" && n.props?.accessibilityLabel === "Tomar foto"
    )[0];
    shutter.props.onPress();
    await asentar();
  });

  await presionarBoton(tr, "Ver las 1 fotos tomadas");
  await presionarYAsentar(tr, "Continuar");

  const inputKm = tr.root.findAll((n) => n.props?.placeholder === "48320")[0];
  act(() => inputKm.props.onChangeText("48320"));
  await presionarYAsentar(tr, "Ir a la firma");

  return tr;
};

describe("Checklist de entrega · firma digital", () => {
  it("sin firmar, el botón de firmar y entregar está deshabilitado", async () => {
    const tr = await llegarALaFirma();
    expect(textOf(tr)).toContain("Firma del contrato");

    const boton = tr.root.findAll(
      (n) => n.props?.accessibilityRole === "button" && n.props?.accessibilityLabel === "Firmar y entregar las llaves"
    )[0];
    expect(boton.props.accessibilityState?.disabled).toBe(true);

    // Tocarlo sin firma no avanza de pantalla.
    await presionarYAsentar(tr, "Firmar y entregar las llaves");
    expect(textOf(tr)).toContain("Firma del contrato");
    expect(mockRegistrarChecklist).not.toHaveBeenCalled();
  });

  it("al dibujar un trazo, el botón se habilita y la firma viaja al backend", async () => {
    mockRegistrarChecklist.mockResolvedValue({ mensaje: "ok", estado_reserva: "en_curso" });
    const tr = await llegarALaFirma();

    // SignaturePad resuelve el gesto de dibujo con el motor táctil nativo de
    // React Native (PanResponder + TouchHistoryMath), que no se puede
    // simular con eventos sintéticos sueltos en este entorno de test. Acá
    // se prueba la integración con DeliveryScreen tal cual la usa: a través
    // del `onChange` que DeliveryScreen le pasó — el mismo callback
    // (`setFirmaSvg`) que SignaturePad invocaría de verdad al terminar un trazo.
    const pad = tr.root.findByType(SignaturePad);
    await act(async () => {
      pad.props.onChange("M 10 10 L 40 20");
      await asentar();
    });

    const boton = tr.root.findAll(
      (n) => n.props?.accessibilityRole === "button" && n.props?.accessibilityLabel === "Firmar y entregar las llaves"
    )[0];
    expect(boton.props.accessibilityState?.disabled).toBe(false);

    await presionarYAsentar(tr, "Firmar y entregar las llaves");
    expect(mockRegistrarChecklist).toHaveBeenCalledTimes(1);
    const payload = mockRegistrarChecklist.mock.calls[0][1];
    expect(typeof payload.firma_svg).toBe("string");
    expect(payload.firma_svg.length).toBeGreaterThan(0);
  });
});
