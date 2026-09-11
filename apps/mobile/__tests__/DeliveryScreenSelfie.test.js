/**
 * El paso de firma mostraba una "cámara facial" puramente decorativa —
 * ningún CameraView detrás, ninguna captura real, solo un ícono y una
 * promesa de "tu rostro se compara con la cédula". Ahora abre
 * SelfieLivenessModal de verdad y sube la foto.
 */
import React from "react";
import { act } from "react-test-renderer";
import { DeliveryScreen } from "@rentacar/mobile-shared/screens/DeliveryScreen";
import { SelfieLivenessModal } from "@rentacar/mobile-shared/components/SelfieLivenessModal";
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
  const AsyncStorage = require("@react-native-async-storage/async-storage");
  await (AsyncStorage.default || AsyncStorage).clear();
  jest.clearAllMocks();
  mockElegirImagen.mockResolvedValue("file://foto-local.jpg");
  mockSubirImagenOptimizada.mockResolvedValue("https://cdn.example/foto1.jpg");
});

afterEach(() => {
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

describe("Checklist de entrega · selfie de verificación", () => {
  it("ya no promete comparar el rostro sin capturar nada — toca para abrir la cámara real", async () => {
    const tr = await llegarALaFirma();
    expect(textOf(tr)).toContain("Toca para tomar tu selfie");

    const modal = tr.root.findByType(SelfieLivenessModal);
    expect(modal.props.visible).toBe(false);
  });

  it("al capturar la selfie, la sube y la muestra en el círculo", async () => {
    const tr = await llegarALaFirma();

    await presionarYAsentar(tr, "Toca para tomar tu selfie");
    let modal = tr.root.findByType(SelfieLivenessModal);
    expect(modal.props.visible).toBe(true);

    await act(async () => {
      modal.props.onCaptured({ frontalUri: "file://selfie-frontal.jpg", movimientoUri: "file://selfie-mov.jpg" });
      await asentar();
    });

    expect(mockSubirImagenOptimizada).toHaveBeenCalledWith(
      "file://selfie-frontal.jpg",
      expect.objectContaining({ bucket: "checklists" })
    );
    expect(textOf(tr)).toContain("Selfie capturada");
  });

  it("la selfie viaja en su propio campo del checklist (selfie_entrega_url)", async () => {
    mockRegistrarChecklist.mockResolvedValue({ mensaje: "ok", estado_reserva: "en_curso" });
    const tr = await llegarALaFirma();

    await presionarYAsentar(tr, "Toca para tomar tu selfie");
    const modal = tr.root.findByType(SelfieLivenessModal);
    await act(async () => {
      modal.props.onCaptured({ frontalUri: "file://selfie-frontal.jpg" });
      await asentar();
    });

    const { SignaturePad } = require("@rentacar/mobile-shared/components/SignaturePad");
    const pad = tr.root.findByType(SignaturePad);
    await act(async () => {
      pad.props.onChange("M 10 10 L 40 20");
      await asentar();
    });

    await presionarYAsentar(tr, "Firmar y entregar las llaves");

    expect(mockRegistrarChecklist).toHaveBeenCalledTimes(1);
    const payload = mockRegistrarChecklist.mock.calls[0][1];
    expect(payload.selfie_entrega_url).toBe("https://cdn.example/foto1.jpg");
    expect(payload.notas).toBeUndefined();
  });
});
