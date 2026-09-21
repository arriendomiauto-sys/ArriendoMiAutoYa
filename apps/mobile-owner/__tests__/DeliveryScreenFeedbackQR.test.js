/**
 * Feedback háptico + destello de éxito en DeliveryScreen al completar la
 * lectura del código QR y la verificación de identidad.
 */
import React from "react";
import { act } from "react-test-renderer";
import { DeliveryScreen } from "@rentacar/mobile-shared/screens/DeliveryScreen";
import { renderTree, textOf, pressText } from "../test-utils";

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

const mockNotificationAsync = jest.fn(() => Promise.resolve());
jest.mock("expo-haptics", () => ({
  notificationAsync: (...a) => mockNotificationAsync(...a),
  impactAsync: jest.fn(() => Promise.resolve()),
  NotificationFeedbackType: { Success: "success", Warning: "warning" },
  ImpactFeedbackStyle: { Light: "light" },
}));

const mockValidarCodigoQR = jest.fn();
const mockConfirmarVerificacion = jest.fn();
jest.mock("@rentacar/mobile-shared/api/client", () => {
  const real = jest.requireActual("@rentacar/mobile-shared/api/client");
  return {
    ApiClient: {
      ...real.ApiClient,
      validarCodigoQR: (...a) => mockValidarCodigoQR(...a),
      confirmarVerificacionIdentidad: (...a) => mockConfirmarVerificacion(...a),
    },
  };
});

jest.mock("@rentacar/mobile-shared/utils/imagenes", () => ({
  elegirImagen: jest.fn(() => Promise.resolve("file://foto.jpg")),
  subirImagenOptimizada: jest.fn(() => Promise.resolve("https://cdn/foto.jpg")),
}));

const asentar = () => new Promise((r) => setTimeout(r, 0));

const reserva = {
  id: "res-1",
  estado: "confirmada",
  lugar_entrega_acordado: "Plaza de Armas",
  auto: { marca: "Kia", modelo: "Rio", anio: 2022, patente: "ABCD12" },
};

let arbol = null;
beforeEach(async () => {
  jest.clearAllMocks();
  const AsyncStorage = require("@react-native-async-storage/async-storage");
  await (AsyncStorage.default || AsyncStorage).clear();
});
afterEach(async () => {
  await act(async () => { await asentar(); });
  if (arbol) arbol.unmount();
  arbol = null;
});

// "Confirmar identidad" también es el título del header en esa etapa, así que
// se presiona el Button por su rol/label accesible, no por texto.
const presionarBoton = async (tr, label) => {
  await act(async () => {
    const boton = tr.root.findAll(
      (n) => n.props?.accessibilityRole === "button" && n.props?.accessibilityLabel === label
    )[0];
    boton.props.onPress();
    await asentar();
  });
};

const escribirCodigo = (tr, valor) => {
  const input = tr.root.findAll(
    (n) => n.props?.placeholder === "Código mostrado en el celular del cliente"
  )[0];
  act(() => input.props.onChangeText(valor));
};

describe("DeliveryScreen · feedback al escanear y verificar", () => {
  it("código válido: vibra en éxito y muestra el destello 'Código verificado'", async () => {
    mockValidarCodigoQR.mockResolvedValue({
      reserva_id: "res-1",
      cliente_nombre: "Juan Pérez",
      auto_marca: "Kia",
      auto_modelo: "Rio",
      auto_patente: "ABCD12",
      lugar_entrega_acordado: "Plaza de Armas",
    });

    const tr = renderTree(<DeliveryScreen reserva={reserva} onBack={() => {}} onCompleteDelivery={() => {}} />);
    arbol = tr;
    escribirCodigo(tr, "COD-123");
    await act(async () => {
      pressText(tr, "Validar código");
      await asentar();
    });

    expect(mockNotificationAsync).toHaveBeenCalledWith("success");
    expect(textOf(tr)).toContain("Código verificado");
    expect(textOf(tr)).toContain("Confirmar identidad");
  });

  it("código inválido: vibra en advertencia", async () => {
    mockValidarCodigoQR.mockRejectedValue(new Error("Código no encontrado"));

    const tr = renderTree(<DeliveryScreen reserva={reserva} onBack={() => {}} onCompleteDelivery={() => {}} />);
    arbol = tr;
    escribirCodigo(tr, "MALO");
    await act(async () => {
      pressText(tr, "Validar código");
      await asentar();
    });

    expect(mockNotificationAsync).toHaveBeenCalledWith("warning");
  });

  it("escanear el QR valida el código leído sin escribir nada", async () => {
    mockValidarCodigoQR.mockResolvedValue({
      reserva_id: "res-1",
      cliente_nombre: "Juan Pérez",
    });

    const tr = renderTree(<DeliveryScreen reserva={reserva} onBack={() => {}} onCompleteDelivery={() => {}} />);
    arbol = tr;

    // Abrir el escáner.
    await act(async () => {
      const abrir = tr.root.findAll(
        (n) => n.props?.accessibilityRole === "button" && n.props?.accessibilityLabel === "Escanear QR del cliente"
      )[0];
      abrir.props.onPress();
      await asentar();
    });

    // La cámara mockeada expone `onBarcodeScanned`: simular la lectura.
    await act(async () => {
      const camara = tr.root.findAll((n) => typeof n.props?.onBarcodeScanned === "function")[0];
      camara.props.onBarcodeScanned({ data: "QR-DESDE-CAMARA" });
      await asentar();
    });

    // BUG-016: el código se normaliza (sin guiones ni espacios) antes de validarlo.
    expect(mockValidarCodigoQR).toHaveBeenCalledWith("QRDESDECAMARA");
    expect(mockNotificationAsync).toHaveBeenCalledWith("success");
    expect(textOf(tr)).toContain("Confirmar identidad");
  });

  it("identidad confirmada: vibra en éxito y muestra 'Identidad verificada'", async () => {
    mockValidarCodigoQR.mockResolvedValue({ reserva_id: "res-1", cliente_nombre: "Juan Pérez" });
    mockConfirmarVerificacion.mockResolvedValue({ siguiente_paso: "checklist_fotos" });

    const tr = renderTree(<DeliveryScreen reserva={reserva} onBack={() => {}} onCompleteDelivery={() => {}} />);
    arbol = tr;
    escribirCodigo(tr, "COD-123");
    await act(async () => {
      pressText(tr, "Validar código");
      await asentar();
    });
    mockNotificationAsync.mockClear();

    await presionarBoton(tr, "Confirmar identidad");

    expect(mockNotificationAsync).toHaveBeenCalledWith("success");
    expect(textOf(tr)).toContain("Identidad verificada");
  });
});
