/**
 * La patente del auto no le aporta nada al arrendatario antes de que
 * físicamente retire el vehículo (o el viaje termine) — mostrarla antes
 * solo expone un dato de más. El dueño, en cambio, siempre ve la patente de
 * su propio auto.
 */
import React from "react";
import { act } from "react-test-renderer";
import { RentalChatScreen } from "@rentacar/mobile-shared/screens/RentalChatScreen";
import { PreCheckinModal } from "@rentacar/mobile-shared/screens/PreCheckinModal";
import { renderTree, textOf } from "../test-utils";

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

const mockObtenerMensajes = jest.fn(() => Promise.resolve([]));
jest.mock("@rentacar/mobile-shared/api/client", () => {
  const real = jest.requireActual("@rentacar/mobile-shared/api/client");
  return {
    ApiClient: { ...real.ApiClient, obtenerMensajes: (...a) => mockObtenerMensajes(...a) },
  };
});

jest.mock("@rentacar/mobile-shared/api/chatSocket", () => ({
  conectarChat: () => ({ enviar: () => false, escribir: () => {}, conectado: () => false, cerrar: () => {} }),
}));

jest.mock("@rentacar/mobile-shared/context/AppContext", () => ({
  useApp: () => ({ currentUser: { id: "u1", nombre: "Ana" } }),
}));

const auto = { marca: "Kia", modelo: "Rio", patente: "ABCD12" };

let arbolActual = null;
afterEach(() => {
  if (arbolActual) arbolActual.unmount();
  arbolActual = null;
});

describe("RentalChatScreen · patente en el subtítulo", () => {
  const montar = async (reservation, variant) => {
    let tr;
    await act(async () => {
      tr = renderTree(<RentalChatScreen reservation={reservation} variant={variant} onBack={() => {}} />);
      await new Promise((r) => setTimeout(r, 0));
    });
    arbolActual = tr;
    return tr;
  };

  it("el arrendatario no ve la patente mientras la reserva está 'confirmada'", async () => {
    const tr = await montar({ id: "r1", estado: "confirmada", auto }, "renter");
    expect(textOf(tr)).not.toContain("ABCD12");
    expect(textOf(tr)).toContain("Kia");
  });

  it("el arrendatario sí ve la patente una vez 'en_curso'", async () => {
    const tr = await montar({ id: "r1", estado: "en_curso", auto }, "renter");
    expect(textOf(tr)).toContain("ABCD12");
  });

  it("el dueño siempre ve la patente de su propio auto", async () => {
    const tr = await montar({ id: "r1", estado: "confirmada", auto }, "owner");
    expect(textOf(tr)).toContain("ABCD12");
  });
});

describe("PreCheckinModal · patente 24h antes del retiro", () => {
  it("al cliente no le muestra la patente (todavía no retira el auto)", () => {
    const tr = renderTree(
      <PreCheckinModal
        visible
        reserva={{ id: "r1", auto, lugar_entrega_acordado: "Plaza de Armas" }}
        role="cliente"
        onClose={() => {}}
      />
    );
    arbolActual = tr;
    expect(textOf(tr)).not.toContain("ABCD12");
    expect(textOf(tr)).toContain("Kia");
  });

  it("al dueño sí le muestra la patente de su propio auto", () => {
    const tr = renderTree(
      <PreCheckinModal
        visible
        reserva={{ id: "r1", auto, lugar_entrega_acordado: "Plaza de Armas" }}
        role="dueno"
        onClose={() => {}}
      />
    );
    arbolActual = tr;
    expect(textOf(tr)).toContain("ABCD12");
  });
});
