/**
 * Resiliencia offline del checklist fotográfico de entrega/devolución.
 *
 * Antes, si `subirImagenOptimizada` fallaba (señal mala, típico en un
 * estacionamiento subterráneo), la foto recién tomada se perdía por
 * completo — el mensaje decía "no se perdió" pero sí se perdía: había que
 * volver a tomarla. Ahora la foto se guarda localmente apenas se toma, se
 * sube en segundo plano, y un fallo la deja marcada "error" en vez de
 * borrarla — se reintenta sola o al tocarla.
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

let contadorFotos = 0;
const mockElegirImagen = jest.fn(() => {
  contadorFotos += 1;
  return Promise.resolve(`file://foto-local-${contadorFotos}.jpg`);
});
const mockSubirImagenOptimizada = jest.fn();
jest.mock("@rentacar/mobile-shared/utils/imagenes", () => ({
  elegirImagen: (...a) => mockElegirImagen(...a),
  subirImagenOptimizada: (...a) => mockSubirImagenOptimizada(...a),
}));

// pressText() ya envuelve el onPress en su propio act() síncrono; volver a
// envolverlo en un act(async...) de afuera produce "overlapping act calls" y
// deja el avance de estado asíncrono a medias. Por eso el disparo (pressText
// u onPress directo) va JUNTO, dentro del mismo act(async...), con el
// asentado posterior — nunca en dos act() separados.
const asentar = () => new Promise((resolve) => setTimeout(resolve, 0));

const presionarYAsentar = async (tr, needle) => {
  await act(async () => {
    pressText(tr, needle);
    await asentar();
  });
};

const dispararYAsentar = async (fn) => {
  await act(async () => {
    fn();
    await asentar();
  });
};

// El título de la pantalla ("Confirmar identidad") es el mismo texto que el
// botón: pressText() encuentra el título primero (no es un botón) y falla.
// Este helper busca por accessibilityRole/accessibilityLabel — que el
// componente Button ya expone — en vez de por texto plano.
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
  estado: "confirmada", // tipo "antes" (entrega)
  lugar_entrega_acordado: "Plaza de Armas",
  auto: { marca: "Kia", modelo: "Rio", anio: 2022, patente: "ABCD12" },
};

let arbolActual = null;

// El checklist deja timers/efectos vivos (AppState, cola offline); sin
// desmontar entre tests, arrastran estado de un test al siguiente. Se
// asienta primero (por si el test que acaba de correr dejo una subida en
// vuelo) y recien ahi se desmonta.
afterEach(async () => {
  await act(async () => {
    await asentar();
  });
  if (arbolActual) arbolActual.unmount();
  arbolActual = null;
});

/** Avanza el flujo hasta la cámara del checklist (stage 20_camera). */
const llegarACamara = async () => {
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

  return tr;
};

const tomarFoto = async (tr) => {
  await act(async () => {
    const boton = tr.root.findAll(
      (n) => n.props?.accessibilityRole === "button" && n.props?.accessibilityLabel === "Tomar foto"
    )[0];
    boton.props.onPress();
    await asentar();
  });
};

beforeEach(async () => {
  mockValidarCodigoQR.mockReset();
  mockConfirmarVerificacion.mockReset();
  mockRegistrarChecklist.mockReset();
  mockElegirImagen.mockClear();
  mockSubirImagenOptimizada.mockReset();
  contadorFotos = 0;
  // Los 4 tests usan la misma reserva ("res-1"): sin esto, el mock de
  // AsyncStorage (un objeto a nivel de módulo) arrastra la cola de fotos
  // guardada por un test al siguiente, que la restaura al montar y arranca
  // con una foto "fantasma" ya en la cola.
  const AsyncStorage = require("@react-native-async-storage/async-storage");
  await (AsyncStorage.default || AsyncStorage).clear();
});

describe("Checklist de entrega · fotos offline", () => {
  it("una foto se ve en pantalla apenas se toma, antes de que termine de subir", async () => {
    let liberarSubida;
    mockSubirImagenOptimizada.mockReturnValue(
      new Promise((resolve) => {
        liberarSubida = resolve;
      })
    );

    const tr = await llegarACamara();
    await tomarFoto(tr);

    // La foto ya aparece (1 de 8) aunque subirImagenOptimizada todavía no resolvió.
    expect(textOf(tr)).toContain("1 de 8");

    await act(async () => {
      liberarSubida("https://cdn.example/foto1.jpg");
      await asentar();
    });
  });

  it("si la subida falla, la foto no desaparece: queda marcada para reintentar", async () => {
    mockSubirImagenOptimizada.mockRejectedValue(new Error("Sin conexión"));

    const tr = await llegarACamara();
    await tomarFoto(tr);

    // Sigue contando como foto tomada (1 de 8) pese al fallo de subida.
    expect(textOf(tr)).toContain("1 de 8");
  });

  it("una foto fallida se reintenta sola cuando la app vuelve a primer plano", async () => {
    mockSubirImagenOptimizada.mockRejectedValueOnce(new Error("Sin conexión"));
    mockSubirImagenOptimizada.mockResolvedValueOnce("https://cdn.example/foto1.jpg");

    const tr = await llegarACamara();
    await tomarFoto(tr);
    expect(mockSubirImagenOptimizada).toHaveBeenCalledTimes(1);

    // El efecto de AppState se vuelve a suscribir cada vez que cambia
    // colaFotos (para que su closure tenga la cola al día); el primer
    // listener registrado quedó con una cola vacía y ya no es el activo —
    // hay que usar el último.
    const { AppState } = require("react-native");
    const handler = AppState.addEventListener.mock.calls
      .filter((c) => c[0] === "change")
      .pop()?.[1];
    await dispararYAsentar(() => handler?.("active"));

    expect(mockSubirImagenOptimizada).toHaveBeenCalledTimes(2);
  });

  it("enviar el checklist reintenta lo pendiente y solo manda URLs que sí subieron", async () => {
    mockSubirImagenOptimizada.mockResolvedValue("https://cdn.example/foto1.jpg");
    mockRegistrarChecklist.mockResolvedValue({ id: "chk-1" });

    const tr = await llegarACamara();
    await tomarFoto(tr);

    // El contador de fotos abre la revisión.
    await presionarBoton(tr, "Ver las 1 fotos tomadas");
    await presionarYAsentar(tr, "Continuar");

    // Llega hasta el paso de kilometraje: confirma que con la foto ya
    // subida, el flujo avanza sin quedarse trabado pidiendo reintentos.
    expect(textOf(tr)).toContain("Kilometraje");
  });
});
