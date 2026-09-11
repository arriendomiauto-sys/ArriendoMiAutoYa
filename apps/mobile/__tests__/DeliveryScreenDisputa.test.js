/**
 * Al cerrar una devolución con diferencia, el botón decía "Ver la disputa"
 * pero llamaba al mismo handler que "Listo" — nunca navegaba a Disputas.
 */
import React from "react";
import { act } from "react-test-renderer";
import { DeliveryScreen } from "@rentacar/mobile-shared/screens/DeliveryScreen";
import { renderTree, textOf, pressText } from "../test-utils";

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

const mockValidarCodigoQR = jest.fn();
const mockConfirmarVerificacion = jest.fn();
const mockRegistrarChecklist = jest.fn();
const mockAnalizarDanosIA = jest.fn();
jest.mock("@rentacar/mobile-shared/api/client", () => {
  const real = jest.requireActual("@rentacar/mobile-shared/api/client");
  return {
    ApiClient: {
      ...real.ApiClient,
      validarCodigoQR: (...a) => mockValidarCodigoQR(...a),
      confirmarVerificacionIdentidad: (...a) => mockConfirmarVerificacion(...a),
      registrarChecklist: (...a) => mockRegistrarChecklist(...a),
      analizarDanosIA: (...a) => mockAnalizarDanosIA(...a),
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
  estado: "en_curso",
  cliente_id: "cliente-1",
  lugar_entrega_acordado: "Plaza de Armas",
  auto: { marca: "Kia", modelo: "Rio", anio: 2022, patente: "ABCD12" },
};

let arbolActual = null;

beforeEach(async () => {
  const AsyncStorage = require("@react-native-async-storage/async-storage");
  await (AsyncStorage.default || AsyncStorage).clear();
  mockAnalizarDanosIA.mockResolvedValue({ anomalia_detectada: false, probabilidades: {} });
});

afterEach(async () => {
  await act(async () => {
    await asentar();
  });
  if (arbolActual) arbolActual.unmount();
  arbolActual = null;
});

const llegarAlCierreConDisputa = async (onOpenDisputes, onCompleteDelivery) => {
  mockValidarCodigoQR.mockResolvedValue({
    reserva_id: "res-1",
    cliente_nombre: "Juan Pérez",
    auto_marca: "Kia",
    auto_modelo: "Rio",
    auto_patente: "ABCD12",
    lugar_entrega_acordado: "Plaza de Armas",
  });
  mockConfirmarVerificacion.mockResolvedValue({ siguiente_paso: "checklist_fotos" });
  mockRegistrarChecklist.mockResolvedValue({
    mensaje: "ok",
    estado_reserva: "disputada",
    liquidacion_dueno: 0,
  });

  const tr = renderTree(
    <DeliveryScreen
      reserva={reserva}
      onBack={() => {}}
      onCompleteDelivery={onCompleteDelivery}
      onOpenDisputes={onOpenDisputes}
    />
  );
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

  const inputKm = tr.root.findAll((n) => n.props?.placeholder === "48320")[0];
  act(() => inputKm.props.onChangeText("48320"));
  await presionarYAsentar(tr, "Ver la revisión");

  await presionarYAsentar(tr, "Todo en orden, cerrar arriendo");

  return tr;
};

describe("Checklist de devolución · cierre con disputa", () => {
  it("con estado_reserva disputada, 'Ver la disputa' abre Disputas, no 'Listo'", async () => {
    const onOpenDisputes = jest.fn();
    const onCompleteDelivery = jest.fn();
    const tr = await llegarAlCierreConDisputa(onOpenDisputes, onCompleteDelivery);

    expect(textOf(tr)).toContain("Devolución con diferencia");
    expect(textOf(tr)).toContain("Ver la disputa");

    await presionarYAsentar(tr, "Ver la disputa");

    expect(onOpenDisputes).toHaveBeenCalledTimes(1);
    expect(onCompleteDelivery).not.toHaveBeenCalled();
  });

  it("sin onOpenDisputes (compatibilidad), cae a onCompleteDelivery en vez de no hacer nada", async () => {
    const onCompleteDelivery = jest.fn();
    const tr = await llegarAlCierreConDisputa(undefined, onCompleteDelivery);

    await presionarYAsentar(tr, "Ver la disputa");

    expect(onCompleteDelivery).toHaveBeenCalledTimes(1);
  });
});
