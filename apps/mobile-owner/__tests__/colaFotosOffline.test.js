/**
 * Persistencia local de la cola de fotos del checklist.
 *
 * Es lo que evita perder una foto recién tomada si la conexión se corta
 * antes de que termine de subir (típico en un estacionamiento subterráneo).
 */
import {
  guardarColaFotos,
  leerColaFotos,
  borrarColaFotos,
} from "@rentacar/mobile-shared/utils/colaFotosOffline";

describe("Cola offline de fotos del checklist", () => {
  it("guarda y vuelve a leer la misma cola", async () => {
    const cola = [{ uriLocal: "file:///foto1.jpg", estado: "pendiente" }];
    await guardarColaFotos("res-1", "antes", cola);

    const leida = await leerColaFotos("res-1", "antes");
    expect(leida).toEqual(cola);
  });

  it("sin cola guardada devuelve null, no explota", async () => {
    const leida = await leerColaFotos("res-sin-cola", "antes");
    expect(leida).toBeNull();
  });

  it("distingue entre entrega y devolución de la misma reserva", async () => {
    await guardarColaFotos("res-2", "antes", [{ uriLocal: "a.jpg" }]);
    await guardarColaFotos("res-2", "despues", [{ uriLocal: "b.jpg" }]);

    expect(await leerColaFotos("res-2", "antes")).toEqual([{ uriLocal: "a.jpg" }]);
    expect(await leerColaFotos("res-2", "despues")).toEqual([{ uriLocal: "b.jpg" }]);
  });

  it("borrar deja de encontrarla después", async () => {
    await guardarColaFotos("res-3", "antes", [{ uriLocal: "c.jpg" }]);
    await borrarColaFotos("res-3", "antes");

    expect(await leerColaFotos("res-3", "antes")).toBeNull();
  });

  it("sin reservaId no guarda ni intenta leer nada", async () => {
    await guardarColaFotos(null, "antes", [{ uriLocal: "x.jpg" }]);
    expect(await leerColaFotos(null, "antes")).toBeNull();
  });
});
