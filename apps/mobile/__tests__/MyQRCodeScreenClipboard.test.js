/**
 * "Toca para copiar" usaba Clipboard de react-native (removido del core) —
 * no crasheaba por el guard `Clipboard?.setString`, pero mostraba "Copiado"
 * sin haber copiado nada de verdad.
 */
import React from "react";
import { act } from "react-test-renderer";
import * as Clipboard from "expo-clipboard";
import { MyQRCodeScreen } from "../src/renter/screens/MyQRCodeScreen";
import { renderTree, textOf, pressText } from "../test-utils";

const mockGenerarCodigoQR = jest.fn();
jest.mock("@rentacar/mobile-shared/api/client", () => {
  const real = jest.requireActual("@rentacar/mobile-shared/api/client");
  return {
    ApiClient: { ...real.ApiClient, generarCodigoQR: (...a) => mockGenerarCodigoQR(...a) },
  };
});

const asentar = () => act(() => new Promise((r) => setTimeout(r, 0)));

const reservation = { id: "res-1", estado: "confirmada", auto: { marca: "Kia", modelo: "Rio" } };

let arbolActual = null;
afterEach(() => {
  if (arbolActual) arbolActual.unmount();
  arbolActual = null;
});

beforeEach(() => {
  jest.clearAllMocks();
  mockGenerarCodigoQR.mockResolvedValue({ codigo_qr_hash: "ABCD1234EFGH", validez_segundos: 120 });
});

describe("MyQRCodeScreen · copiar el código", () => {
  it("copia el código real al portapapeles con expo-clipboard", async () => {
    const tr = renderTree(<MyQRCodeScreen reservation={reservation} onBack={() => {}} />);
    arbolActual = tr;
    await asentar();

    await act(async () => {
      pressText(tr, "Toca para copiar");
      await asentar();
    });

    expect(await Clipboard.getStringAsync()).toBe("ABCD1234EFGH");
    expect(textOf(tr)).toContain("Copiado");
  });
});
